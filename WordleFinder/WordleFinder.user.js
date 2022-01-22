// ==UserScript==
// @name        Wordle Finder
// @description Find words on Wordle
// @version     0.1.0
// @author      Adam Thompson-Sharpe
// @license     GPL-3.0
// @match       *://*.powerlanguage.co.uk/wordle*
// @resource    wordList https://gist.githubusercontent.com/MysteryBlokHed/0adc3a53f8e801d513a6f64eabbcb9e7/raw/f3ce36148c8a92200b82deb14399424d67889211/a
// @grant       GM.getResourceUrl
// ==/UserScript==
;(async () => {
  /** A custom event used to fake key presses */
  class GameKeyPressEvent extends Event {
    constructor(type, key, eventInitDict) {
      super(type, eventInitDict)
      this.detail = { key }
    }
  }
  /** The list of possible words */
  const wordList = GM.getResourceUrl
    ? await new Promise(resolve =>
        GM.getResourceUrl('wordList').then(blob =>
          fetch(blob).then(result =>
            result.text().then(text => resolve(text.split('\n'))),
          ),
        ),
      )
    : await new Promise(resolve => {
        fetch(
          'https://gist.githubusercontent.com/MysteryBlokHed/0adc3a53f8e801d513a6f64eabbcb9e7/raw/f3ce36148c8a92200b82deb14399424d67889211/a',
        ).then(result => result.text().then(text => resolve(text.split('\n'))))
      })
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
  /** Submit a guess */
  const submitGuess = guess => {
    clearGuess()
    if (guess.length !== 5) console.log('<5 character guess attempted')
    for (const char of guess) press(char)
    press('Enter')
  }
  /** Get a list of finished rows */
  const finishedRows = () => {
    const rows = Array.from(gameRoot.querySelectorAll('game-row[letters]'))
    return rows.filter(row =>
      row.shadowRoot?.querySelector('game-tile[evaluation]'),
    )
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
  /** Update the unused, misplaced, and correct letters based on the last word */
  const updateLetters = () => {
    console.log('updating letters')
    console.log('last:', lastRow())
    lastRow()
      ?.shadowRoot?.querySelectorAll('game-tile[evaluation]')
      .forEach((el, i) => {
        console.log('el,i:', el, i)
        // Get the result of each tile
        const evaluation = el.getAttribute('evaluation')
        // Tile is not present in word
        if (evaluation === 'absent')
          unusedLetters.push(el.getAttribute('letter') ?? '')
        // Tile is in the word, but misplaced
        else if (evaluation === 'present')
          misplacedLetters.push([el.getAttribute('letter') ?? '', i])
        // Tile is in the right place
        else if (evaluation === 'correct')
          correctLetters.push([el.getAttribute('letter') ?? '', i])
      })
    console.log('unused:', unusedLetters)
    console.log('present:', misplacedLetters)
    console.log('correct:', correctLetters)
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
      // Remove unused letters from bank
      unusedLetters.forEach(letter => (letters = letters.replace(letter, '')))
      regexp += `[${letters}]`
    }
    console.log('generated expression:', regexp)
    return new RegExp(regexp, 'i')
  }
  let attempts = 1
  const randomWord = wordList[Math.floor(Math.random() * wordList.length)]
  submitGuess(randomWord)
  // Start with a random word
  if (wasCorrect()) return console.log('Word found:', randomWord)
  const guess = () => {
    if (attempts > 5) throw new Error('Could not find word')
    const nextWord = wordList.find(word => word.match(dictRegex()))
    if (!nextWord) throw new Error('No matching words left in dictionary')
    submitGuess(nextWord)
    if (wasCorrect()) return console.log('Word found:', nextWord)
    updateLetters()
    attempts++
    setTimeout(() => guess(), 3000)
  }
  guess()
})()
