# Wordle Devtools

Functions and objects to mess with Wordle from the developer console.

## Use

This script will simply add some objects and functions to the global window object,
letting you use them from the developer console. This isn't really geared towards
being a library, but it could be used as one by `@require`ing the JS file.

Functions and variables are on the global `WordleDev` object:

```javascript
const { gameState, statistics } = WordleDev
console.log(gameState.solution) // Logs the current Wordle's solution
console.log(statistics.winPercentage) // Logs the current win percentage
statistics.winPercentage = 100 // Sets win percentage to 100
```

Types can be used in TypeScript by adding
a reference to the location of the TS source file:

```typescript
/// <reference path="path/to/WordleDevtools.user.ts" />
```

Available functions/objects:

| Key        | Type     | Description                                                                                                                |
| :--------- | :------- | :------------------------------------------------------------------------------------------------------------------------- |
| gameState  | object   | The current state of the game. Modifying a key on this object will automatically update the stored value                   |
| statistics | object   | The user's statistics, such as guess percentage. Modifying a key on this object will automatically update the stored value |
| press      | function | Simulate a keypress. The passed key should be a string such as `'a'` or `'Backspace'`                                      |
| guess      | function | Pass a word to guess                                                                                                       |
| undoGuess  | function | Undoes the last guess and reloads the page (required to update). Pass `false` to disable page reloading                    |
| clearBoard | function | Clear all guesses on the board. Pass `false` to disable page reloading                                                     |
