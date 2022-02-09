// ==UserScript==
// @name        Wordle Finder
// @description Find words on Wordle
// @version     0.1.1
// @author      Adam Thompson-Sharpe
// @license     GPL-3.0
// @match       *://*.powerlanguage.co.uk/wordle*
// @require     https://gitlab.com/MysteryBlokHed/greasetools/-/raw/v0.4.0/greasetools.user.js
// @resource    wordList https://gitlab.com/MysteryBlokHed/userscripts/-/raw/main/WordleFinder/words.txt
// @grant       GM.getResourceUrl
// @grant       GM.xmlHttpRequest
// ==/UserScript==
/// <reference types="greasetools" />
;(async () => {
  const { xhrPromise } = GreaseTools

  /** A custom event used to fake key presses */
  class GameKeyPressEvent extends Event {
    public readonly detail: { key: string }

    constructor(
      type: string,
      key: string,
      eventInitDict?: EventInit | undefined,
    ) {
      super(type, eventInitDict)
      this.detail = { key }
    }
  }

  type Evaluation = 'absent' | 'present' | 'correct'
  type RowEvaluation =
    | [Evaluation, Evaluation, Evaluation, Evaluation, Evaluation]
    | null
  type GameStatus = 'IN_PROGRESS' | 'WIN'

  /** Describes the state of the game. Found encoded in localStorage under the key 'gameState' */
  interface GameState {
    /** A list of chosen words or empty strings for unreached rows */
    boardState: [string, string, string, string, string]
    /** Evaulations for each row */
    evaluations: [
      RowEvaluation,
      RowEvaluation,
      RowEvaluation,
      RowEvaluation,
      RowEvaluation,
      RowEvaluation,
    ]
    /** Whether the game is in progress or done */
    gameStatus: GameStatus
    /** Whether hard mode is enabled */
    hardMode: boolean
    /** Timestamp for the last solve */
    lastCompletedTs: number | null
    /** Timestamp for the last play time */
    lastPlayedTs: number | null
    restoringFromLocalStorage: null
    /** Active row number */
    rowIndex: number
    /** Correct word */
    solution: string
  }

  /** Game state from `gameState` in `localStorage` */
  const gameState = (() => {
    const stateString = localStorage.getItem('gameState')
    if (!stateString) throw new Error('Failed to get game state')
    const stateObj = JSON.parse(stateString)

    /** Should contain all keys from GameState object */
    const requiredKeys = [
      'boardState',
      'evaluations',
      'gameStatus',
      'hardMode',
      'lastCompletedTs',
      'lastPlayedTs',
      'restoringFromLocalStorage',
      'rowIndex',
      'solution',
    ] as const

    if (
      Object.keys(stateObj).every(key =>
        (requiredKeys as readonly string[]).includes(key),
      )
    )
      return stateObj as GameState

    throw new Error('Unexpected/missing keys in game state')
  })()

  /** The list of possible words */
  const wordList: string[] | null = GM.getResourceUrl!
    ? await new Promise<string[]>(resolve =>
        GM.getResourceUrl('wordList').then(blob =>
          fetch(blob).then(result =>
            result.text().then(text => resolve(text.split('\n'))),
          ),
        ),
      )
    : GM.xmlHttpRequest!
    ? await new Promise<string[]>(resolve => {
        xhrPromise({
          method: 'GET',
          url: 'https://gitlab.com/MysteryBlokHed/userscripts/-/raw/main/WordleFinder/words.txt',
        }).then(result => resolve(result.responseText.split('\n')))
      })
    : null

  const unusedLetters: string[] = []
  const misplacedLetters: [letter: string, place: number][] = []
  const correctLetters: [letter: String, place: number][] = []

  /** The shadow root with the game's elements */
  const gameRoot = document.querySelector('game-app')?.shadowRoot
  if (!gameRoot)
    throw new Error('Could not find game-app element and/or its shadow root')

  /** The div containing the game contents */
  const gameDiv = gameRoot.querySelector('#game')
  if (!gameDiv) throw new Error('Could not find #game on the shadow root')

  /**
   * Press a key
   * @param key The key to press, eg. 'a' or 'Enter' (case-sensitive)
   */
  const press = (key: string) =>
    gameDiv.dispatchEvent(new GameKeyPressEvent('game-key-press', key))

  /** Clear the active guess */
  const clearGuess = () => {
    const row = Array.from(gameRoot.querySelectorAll('game-row[letters]')).find(
      el => el.getAttribute('letters')!.length > 0,
    )
    if (!row) return

    for (let i = 0; i < row.getAttribute('letters')!.length; i++)
      press('Backspace')
  }

  /**
   * Submit a guess
   * @throws {Error} Thrown if a guess is not 5 characters
   */
  const submitGuess = (guess: string) => {
    clearGuess()
    if (guess.length !== 5)
      throw new Error('Guess attempted with word that is not 5 characters')
    for (const char of guess) press(char)
    press('Enter')
  }

  /** Get a list of finished rows' shadowRoots */
  const finishedRows = () => {
    const rows = Array.from(gameRoot.querySelectorAll('game-row[letters]'))
    return rows
      .filter(row => row.shadowRoot?.querySelector('game-tile[evaluation]'))
      .map(row => row.shadowRoot!)
  }

  /** Get the last submitted row */
  const lastRow = () => {
    const rows = finishedRows()
    if (rows.length) return rows[rows.length - 1]
    else return null
  }

  /** Check if the last guess was correct */
  const wasCorrect = () =>
    lastRow()?.querySelectorAll('game-tile[evaluation=correct]').length === 5

  /** Update the unused, misplaced, and correct letters based on all past words */
  const updateLetters = () => {
    unusedLetters.length = 0
    misplacedLetters.length = 0
    correctLetters.length = 0

    finishedRows()?.forEach(row =>
      row?.querySelectorAll('game-tile[evaluation]').forEach((el, i) => {
        // Get the result of each tile
        const evaluation = el.getAttribute('evaluation')!
        // Tile is not present in word
        if (evaluation === 'absent')
          unusedLetters.push(el.getAttribute('letter') ?? '')
        // Tile is in the word, but misplaced
        else if (evaluation === 'present')
          misplacedLetters.push([el.getAttribute('letter') ?? '', i])
        // Tile is in the right place
        else if (evaluation === 'correct')
          correctLetters.push([el.getAttribute('letter') ?? '', i])
      }),
    )
  }

  /** Get a regular expression to match dictionary words with */
  const dictRegex = () => {
    let regexp = ''

    for (let i = 0; i < 5; i++) {
      // If we know a letter is in this position, only match that letter
      const correctLetter = correctLetters.find(([_, place]) => place === i)
      if (correctLetter) {
        regexp += correctLetter[0]
        continue
      }

      let letters = 'abcdefghijklmnopqrstuvwxyz'
      // Remove unused letters
      unusedLetters.forEach(letter => (letters = letters.replace(letter, '')))
      // If there are any letters not in this position, don't use them
      const filteredMisplaced = misplacedLetters.filter(
        ([_, place]) => place === i,
      )
      filteredMisplaced.forEach(
        ([letter]) => (letters = letters.replace(letter, '')),
      )

      regexp += `[${letters}]`
    }

    return new RegExp(`^${regexp}$`, 'i')
  }

  // If the Wordle is already done, don't do anything
  if (wasCorrect()) return console.log('Word already found')

  // Progressive solve
  let attempts = 0

  /** Loop to guess words */
  const guess = () => {
    if (!wordList)
      throw new Error('Progressive solve attempt with no word list')
    if (attempts > 6) throw new Error('Could not find word')

    updateLetters()
    const regex = dictRegex()

    /**
     * The next word to guess.
     * Found by finding a word in the dictionary that matches the generated regex
     * and that contains all existing but misplaced letters
     */
    const nextWord = wordList.find(
      word =>
        word.match(regex) &&
        misplacedLetters.every(([letter]) => word.includes(letter)),
    )
    if (!nextWord) throw new Error('No matching words left in dictionary')
    submitGuess(nextWord)

    if (wasCorrect()) return console.log('Word found:', nextWord)

    attempts++
    setTimeout(() => guess(), 3000)
  }

  /** Keyboard element */
  const keyboard = gameRoot
    .querySelector('game-keyboard')
    ?.shadowRoot?.querySelector('#keyboard')
  if (!keyboard) return

  // Stop button from pushing the keyboard offscreen
  const styleSheet = (keyboard.parentNode as ShadowRoot).styleSheets[0]
  const deleteIndex = (
    Array.from(styleSheet.cssRules) as CSSStyleRule[]
  ).findIndex(style => style.selectorText === ':host')
  styleSheet.deleteRule(deleteIndex)

  const buttonRow = document.createElement('div')
  buttonRow.className = 'row'
  const progressiveButton = document.createElement('button')
  progressiveButton.setAttribute('data-key', '←')
  progressiveButton.innerText = 'Cheat (Progressive)'

  if (wordList) {
    progressiveButton.setAttribute('data-state', 'correct')
    progressiveButton.onclick = () => {
      attempts = finishedRows().length + 1

      // If the player hasn't guessed anything else yet
      if (attempts === 1) {
        console.log('1 attempt')
        // Use 'crane' as the first word since 3blue1brown said so
        submitGuess('crane')
        if (wasCorrect()) return console.log('Word found: crane')
      }

      guess()
      progressiveButton.setAttribute('data-state', 'absent')
      progressiveButton.disabled = true
    }
  } else {
    progressiveButton.setAttribute('data-state', 'absent')
  }

  const instantButton = document.createElement('button')
  instantButton.setAttribute('data-key', '←')
  instantButton.innerText = 'Cheat (Instant)'
  instantButton.setAttribute('data-state', 'correct')
  instantButton.onclick = () => submitGuess(gameState.solution)

  buttonRow.appendChild(progressiveButton)
  buttonRow.appendChild(instantButton)
  keyboard.prepend(buttonRow)
})()
