// ==UserScript==
// @name        Wordle Finder
// @description Find words on Wordle
// @version     0.3.2
// @author      Adam Thompson-Sharpe
// @license     GPL-3.0
// @match       *://*.nytimes.com/games/wordle*
// @match       *://*.powerlanguage.co.uk/wordle*
// @require     https://gitlab.com/MysteryBlokHed/greasetools/-/raw/v0.4.0/greasetools.user.js
// @resource    wordList https://gitlab.com/MysteryBlokHed/userscripts/-/raw/main/WordleFinder/words.txt
// @grant       GM.getResourceUrl
// @grant       GM.xmlHttpRequest
// ==/UserScript==
/// <reference types="greasetools" />
;(async () => {
  const xhrPromise = window.GreaseTools?.xhrPromise
  const GM = window.GM ?? {}
  /** A custom event used to fake key presses */
  class GameKeyPressEvent extends Event {
    constructor(type, key, eventInitDict) {
      super(type, eventInitDict)
      this.detail = { key }
    }
  }
  const getState = () => {
    const stateString = localStorage.getItem('nyt-wordle-state')
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
    ]
    if (Object.keys(stateObj).every(key => requiredKeys.includes(key)))
      return stateObj
    throw new Error('Unexpected/missing keys in game state')
  }
  /**
   * Game state that automatically modifies localStorage values on change
   * and checks localStorage values on get
   */
  const gameState = new Proxy(getState(), {
    set(target, key, value, receiver) {
      const result = Reflect.set(target, key, value, receiver)
      localStorage.setItem('nyt-wordle-state', JSON.stringify(target))
      return result
    },
    get(target, key, receiver) {
      const state = localStorage.getItem('nyt-wordle-state')
      if (!state) return Reflect.get(target, key, receiver)
      target[key] = getState()[key]
      return Reflect.get(target, key, receiver)
    },
  })
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
  const keyboard = gameRoot
    .querySelector('game-keyboard')
    ?.shadowRoot?.querySelector('#keyboard')
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
