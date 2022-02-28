// ==UserScript==
// @name        Wordle Devtools
// @description Functions and objects to mess with Wordle from the developer console
// @version     0.1.0
// @author      Adam Thompson-Sharpe
// @license     GPL-3.0
// @match       *://*.nytimes.com/games/wordle*
// @match       *://*.powerlanguage.co.uk/wordle*
// @require     https://gitlab.com/MysteryBlokHed/ls-proxy/-/raw/v0.3.1/ls-proxy.user.js
// ==/UserScript==
/// <reference types="ls-proxy" />
;(() => {
  const { storeObject, Validations } = LSProxy

  const gameEl = document
    .querySelector('game-app')
    ?.shadowRoot?.querySelector('#game')

  class WordleKeyEvent extends Event {
    public readonly detail: { key: string }

    constructor(key: string, eventInitDict?: EventInit) {
      super('game-key-press', eventInitDict)
      this.detail = { key }
    }
  }

  const gameState = storeObject<GameState>(
    'nyt-wordle-state',
    {
      boardState: Array(6).fill('') as GameState['boardState'],
      evaluations: Array(6).fill(null) as GameState['evaluations'],
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

  const statistics = storeObject<Statistics>(
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
        if (
          !Validations.keys(value, [
            'averageGuesses',
            'currentStreak',
            'gamesPlayed',
            'gamesWon',
            'guesses',
            'maxStreak',
            'winPercentage',
          ])
        ) {
          return false
        }

        // Validate guesses
        if (
          !Validations.keys(value.guesses, [
            '1',
            '2',
            '3',
            '4',
            '5',
            '6',
            'fail',
          ])
        ) {
          return false
        }

        return true
      },
    },
  )

  window.WordleDev = {
    gameState,
    statistics,

    press(key: string) {
      gameEl?.dispatchEvent(new WordleKeyEvent(key))
    },

    guess(guess: string) {
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
  }
})()

type Evaluation = 'absent' | 'present' | 'correct'
type RowEvaluation =
  | [Evaluation, Evaluation, Evaluation, Evaluation, Evaluation]
  | null
type GameStatus = 'IN_PROGRESS' | 'WIN' | 'FAIL'

interface GameState {
  /** A list of chosen words or empty strings for unreached rows */
  boardState: [string, string, string, string, string, string]
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

interface Statistics {
  averageGuesses: number
  currentStreak: number
  gamesPlayed: number
  gamesWon: number
  guesses: Record<1 | 2 | 3 | 4 | 5 | 6 | 'fail', number>
  maxStreak: number
  winPercentage: number
}

interface WordleDev {
  /**
   * The game's state.
   * Values are automatically updated in localStorage when you modify this object
   */
  gameState: GameState
  /**
   * The game's statistics.
   * Values are automatically updated in localStorage when you modify this object
   */
  statistics: Statistics
  /** Dispatch a key event to Wordle */
  press(key: string): void
  /** Guess a word */
  guess(guess: string): void
  /** Undo an entered guess */
  undoGuess(reload?: boolean): void
}

declare var WordleDev: WordleDev
