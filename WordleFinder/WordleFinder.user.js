// ==UserScript==
// @name        Wordle Finder
// @description Find words on Wordle
// @version     0.3.7
// @author      Adam Thompson-Sharpe
// @namespace   MysteryBlokHed
// @license     GPL-3.0
// @match       *://*.nytimes.com/games/wordle*
// @match       *://*.powerlanguage.co.uk/wordle*
// @require     https://gitlab.com/MysteryBlokHed/greasetools/-/raw/v0.5.0/greasetools.user.js
// @require     https://gitlab.com/MysteryBlokHed/ls-proxy/-/raw/v0.3.1/ls-proxy.user.js
// @resource    wordList https://gitlab.com/MysteryBlokHed/userscripts/-/raw/main/WordleFinder/words.txt
// @grant       GM.getResourceUrl
// @grant       GM.xmlHttpRequest
// ==/UserScript==
/// <reference types="greasetools" />
/// <reference types="ls-proxy" />
;(async () => {
  var _a, _b, _c
  const { xhrPromise } = GreaseTools
  const { storeObject, Validations } = LSProxy
  /** A custom event used to fake key presses */
  class GameKeyPressEvent extends Event {
    constructor(type, key, eventInitDict) {
      super(type, eventInitDict)
      this.detail = { key }
    }
  }
  const validate = value => {
    const requiredKeys = ['boardState', 'evaluations', 'gameStatus', 'solution']
    if (!Validations.keys(value, requiredKeys)) {
      return false
    } else if (
      !Validations.types(value, {
        boardState: 'object',
        evaluations: 'object',
        gameStatus: 'string',
        solution: 'string',
      })
    ) {
      return false
    }
    return true
  }
  /**
   * Game state that automatically modifies localStorage values on change
   * and checks localStorage values on get
   */
  const gameState = storeObject(
    localStorage['gameState'] ? 'gameState' : 'nyt-wordle-state',
    {
      boardState: ['', '', '', '', '', ''],
      evaluations: [null, null, null, null, null, null],
      gameStatus: 'IN_PROGRESS',
      solution: 'trace',
    },
    { partial: true, validate },
  )
  /** The list of possible words */
  const wordList = GM.getResourceUrl
    ? await new Promise(resolve =>
        GM.getResourceUrl('wordList').then(blob =>
          fetch(blob).then(result =>
            result.text().then(text => resolve(text.split('\n'))),
          ),
        ),
      )
    : GM.xmlHttpRequest && xhrPromise
    ? await new Promise(resolve => {
        xhrPromise({
          method: 'GET',
          url: 'https://gitlab.com/MysteryBlokHed/userscripts/-/raw/main/WordleFinder/words.txt',
        }).then(result => resolve(result.responseText.split('\n')))
      })
    : null
  const unusedLetters = []
  const misplacedLetters = []
  const correctLetters = []
  /** The shadow root with the game's elements */
  const gameRoot =
    (_a = document.querySelector('game-app')) === null || _a === void 0
      ? void 0
      : _a.shadowRoot
  if (!gameRoot)
    throw new Error('Could not find game-app element and/or its shadow root')
  /** The div containing the game contents */
  const gameDiv = gameRoot.querySelector('#game')
  if (!gameDiv) throw new Error('Could not find #game on the shadow root')
  /**
   * Press a key
   * @param key The key to press, eg. 'a' or 'Enter' (case-sensitive)
   */
  const press = key =>
    gameDiv.dispatchEvent(new GameKeyPressEvent('game-key-press', key))
  /** Clear the active guess */
  const clearGuess = () => {
    const row = Array.from(gameRoot.querySelectorAll('game-row[letters]')).find(
      el => el.getAttribute('letters').length > 0,
    )
    if (!row) return
    for (let i = 0; i < row.getAttribute('letters').length; i++)
      press('Backspace')
  }
  /**
   * Submit a guess
   * @throws {Error} Thrown if a guess is not 5 characters
   */
  const submitGuess = guess => {
    clearGuess()
    if (guess.length !== 5)
      throw new Error('Guess attempted with word that is not 5 characters')
    for (const char of guess) press(char)
    press('Enter')
  }
  const lettersAndEvaluations = () => {
    const words = gameState.boardState
    const evaluations = gameState.evaluations
    const result = []
    for (const [i, word] of words.entries()) {
      if (!word || !evaluations[i]) return result
      result.push([])
      for (const [j, char] of word.split('').entries()) {
        result[i].push([char, evaluations[i][j]])
      }
    }
    return result
  }
  const finishedRowCount = () =>
    gameState.boardState.filter(word => word).length + 1
  /** Check if the last guess was correct */
  const wasCorrect = () => gameState.gameStatus === 'WIN'
  /** Update the unused, misplaced, and correct letters based on all past words */
  const updateLetters = () => {
    unusedLetters.length = 0
    misplacedLetters.length = 0
    correctLetters.length = 0
    for (const word of lettersAndEvaluations()) {
      for (const [i, [char, evaluation]] of word.entries()) {
        switch (evaluation) {
          case 'absent':
            unusedLetters.push(char)
            break
          case 'present':
            misplacedLetters.push([char, i])
            break
          case 'correct':
            correctLetters.push([char, i])
            break
        }
      }
    }
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
  const keyboard =
    (_c =
      (_b = gameRoot.querySelector('game-keyboard')) === null || _b === void 0
        ? void 0
        : _b.shadowRoot) === null || _c === void 0
      ? void 0
      : _c.querySelector('#keyboard')
  if (!keyboard) return
  // Stop button from pushing the keyboard offscreen
  const styleSheet = keyboard.parentNode.styleSheets[0]
  const deleteIndex = Array.from(styleSheet.cssRules).findIndex(
    style => style.selectorText === ':host',
  )
  styleSheet.deleteRule(deleteIndex)
  const buttonRow = document.createElement('div')
  buttonRow.className = 'row'
  const progressiveButton = document.createElement('button')
  progressiveButton.setAttribute('data-key', '←')
  progressiveButton.innerText = 'Cheat (Progressive)'
  if (wordList) {
    progressiveButton.setAttribute('data-state', 'correct')
    progressiveButton.onclick = () => {
      attempts = finishedRowCount()
      // If the player hasn't guessed anything else yet
      if (attempts === 1) {
        console.log('1 attempt')
        // Use 'trace' as the first word since 3blue1brown said so
        submitGuess('trace')
        if (wasCorrect()) return console.log('Word found: trace')
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
