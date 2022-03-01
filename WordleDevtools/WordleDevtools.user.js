// ==UserScript==
// @name        Wordle Devtools
// @description Functions and objects to mess with Wordle from the developer console
// @version     0.1.0
// @author      Adam Thompson-Sharpe
// @namespace   MysteryBlokHed
// @license     GPL-3.0
// @copyright   2022 Adam Thomspon-Sharpe
// @match       *://*.nytimes.com/games/wordle*
// @match       *://*.powerlanguage.co.uk/wordle*
// @require     https://gitlab.com/MysteryBlokHed/ls-proxy/-/raw/v0.3.1/ls-proxy.user.js
// ==/UserScript==
/// <reference types="ls-proxy" />
;(() => {
  var _a, _b
  const { storeObject, Validations } = LSProxy
  const gameEl =
    (_b =
      (_a = document.querySelector('game-app')) === null || _a === void 0
        ? void 0
        : _a.shadowRoot) === null || _b === void 0
      ? void 0
      : _b.querySelector('#game')
  class WordleKeyEvent extends Event {
    constructor(key, eventInitDict) {
      super('game-key-press', eventInitDict)
      this.detail = { key }
    }
  }
  const gameState = storeObject(
    'nyt-wordle-state',
    {
      boardState: Array(6).fill(''),
      evaluations: Array(6).fill(null),
      gameStatus: 'IN_PROGRESS',
      hardMode: false,
      lastCompletedTs: null,
      lastPlayedTs: null,
      restoringFromLocalStorage: null,
      rowIndex: 0,
      solution: 'trace',
    },
    {
      validate: value =>
        Validations.keys(value, [
          'boardState',
          'evaluations',
          'gameStatus',
          'hardMode',
          'lastCompletedTs',
          'lastPlayedTs',
          'restoringFromLocalStorage',
          'rowIndex',
          'solution',
        ]),
    },
  )
  const statistics = storeObject(
    'nyt-wordle-statistics',
    {
      averageGuesses: 0,
      currentStreak: 0,
      gamesPlayed: 0,
      gamesWon: 0,
      guesses: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, fail: 0 },
      maxStreak: 0,
      winPercentage: 0,
    },
    {
      validate(value) {
        // Validate main object
        const mainKeys = [
          'averageGuesses',
          'currentStreak',
          'gamesPlayed',
          'gamesWon',
          'guesses',
          'maxStreak',
          'winPercentage',
        ]
        if (!Validations.keys(value, mainKeys)) {
          return false
        }
        // Validate guesses
        const guessesKeys = ['1', '2', '3', '4', '5', '6', 'fail']
        if (!Validations.keys(value.guesses, guessesKeys)) {
          return false
        }
        return true
      },
    },
  )
  window.WordleDev = {
    gameState,
    statistics,
    press(key) {
      gameEl === null || gameEl === void 0
        ? void 0
        : gameEl.dispatchEvent(new WordleKeyEvent(key))
    },
    guess(guess) {
      if (guess.length !== 5) throw new Error('Invalid guess length')
      for (let i = 0; i < 5; i++) this.press('Backspace')
      for (const char of guess) this.press(char)
      this.press('Enter')
    },
    undoGuess(reload = true) {
      const { boardState, evaluations } = this.gameState
      const row = evaluations.indexOf(null) - 1
      boardState[row] = ''
      evaluations[row] = null
      this.gameState.gameStatus = 'IN_PROGRESS'
      this.gameState.rowIndex = row
      if (reload) location.reload()
    },
    clearBoard(reload = true) {
      const { evaluations } = this.gameState
      const rows = evaluations.indexOf(null)
      for (let i = 0; i < rows; i++) this.undoGuess(false)
      if (reload) location.reload()
    },
  }
})()
