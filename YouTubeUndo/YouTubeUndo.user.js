// ==UserScript==
// @name        YouTube Undo
// @description Undo and redo changes in playback position on YouTube
// @version     0.2.1
// @author      Adam Thompson-Sharpe
// @namespace   MysteryBlokHed
// @license     GPL-3.0
// @copyright   2022 Adam Thomspon-Sharpe
// @homepageURL https://gitlab.com/MysteryBlokHed/userscripts/-/tree/main/YouTubeUndo
// @supportURL  https://gitlab.com/MysteryBlokHed/userscripts/-/issues
// @match       *://*.youtube.com/*
// @grant       none
// ==/UserScript==
;(() => {
  /** Whether to log basic debug events */
  const DEBUG_LOGS = true
  const debug = DEBUG_LOGS
    ? (...args) => console.debug('[YouTube Undo]', ...args)
    : () => {}
  /** The interval **in seconds** to check the player's current time */
  const ROUGH_TIME_RATE = 2
  /** Time change events */
  const timeChanges = []
  /** Keep track of the current player time while no events are in the array */
  let roughTime = 0
  /**
   * Track the index in the array that matches the current state of undo's/redo's.
   * Used to allow undoing and redoing back and forth
   */
  let undoPoint = -1
  const addChange = change => {
    debug('Adding change event to', timeChanges)
    timeChanges.length = undoPoint + 1
    timeChanges.push(change)
    undoPoint = timeChanges.length - 1
    debug('After:', timeChanges)
  }
  /** The current time change event, using `undoPoint` */
  const currentChange = () => {
    var _a
    return (_a = timeChanges[undoPoint]) !== null && _a !== void 0 ? _a : null
  }
  /** The last time change event in the list */
  const lastChange = () =>
    timeChanges.length ? timeChanges[timeChanges.length - 1] : null
  /** Get the last change's time if it exists, otherwise use the rough time */
  const lastOrRough = () => {
    var _a, _b
    return (_b =
      (_a = lastChange()) === null || _a === void 0 ? void 0 : _a.after) !==
      null && _b !== void 0
      ? _b
      : roughTime
  }
  // prettier-ignore
  /** The YouTube player */
  const getPlayer = () => document.getElementById('movie_player');
  /** Set up event listeners and intervals */
  const setup = () => {
    var _a
    const player = getPlayer()
    if (!player) return
    debug('Player found, running setup')
    setInterval(() => {
      const currentTime = player.getCurrentTime()
      roughTime = currentTime
    }, ROUGH_TIME_RATE * 1000)
    // Clear events on location changes
    window.addEventListener('yt-navigate-finish', () => {
      debug('Navigate finished')
      debug('Player:', player)
      timeChanges.length = 0
      undoPoint = -1
      debug('New page, clearing event list')
    })
    // Watch for playbar clicks
    ;(_a = document.querySelector('div.ytp-progress-bar')) === null ||
    _a === void 0
      ? void 0
      : _a.addEventListener('click', () => {
          const currentTime = player.getCurrentTime()
          addChange({
            before: lastOrRough(),
            after: currentTime,
          })
          roughTime = currentTime
          debug('Added time change for playbar seek', lastChange())
        })
    // Watch for keypresses
    window.addEventListener('keydown', ev => {
      if (ev.key.match(/^(?:\d|j|l|ArrowLeft|ArrowRight)$/i)) {
        // A key that might change the current time
        const last = lastChange()
        const currentTime = player.getCurrentTime()
        debug('Time-changing key pressed')
        debug('Last:', last)
        debug('Current:', currentTime)
        if (!last) debug('Rough Time:', roughTime)
        if (
          (last === null || last === void 0 ? void 0 : last.after) !==
          currentTime
        ) {
          addChange({
            before: lastOrRough(),
            after: currentTime,
          })
        }
      } else if (ev.ctrlKey && ev.key.toLowerCase() === 'z') {
        // Ctrl + Z
        const undoTo = currentChange()
        debug('Ctrl + Z pressed')
        debug('Full list:', timeChanges)
        debug('Undoing to:', undoTo, 'at index', undoPoint)
        if (undoTo) player.seekTo(undoTo.before)
        if (undoPoint >= 0) undoPoint--
      } else if (ev.ctrlKey && ev.key.toLowerCase() === 'y') {
        // Ctrl + Y
        if (undoPoint < timeChanges.length - 1) undoPoint++
        const redoTo = currentChange()
        debug('Ctrl + Y pressed')
        debug('Full list:', timeChanges)
        debug('Redoing to:', redoTo, 'at index', undoPoint)
        if (redoTo) player.seekTo(redoTo.after)
      }
    })
  }
  if (!getPlayer()) {
    debug('Player not found!')
    debug('Page is probably not an active video.')
    const listener = () => {
      debug('Re-checking for player...')
      if (getPlayer()) {
        setup()
        window.removeEventListener('yt-navigate-finish', listener)
      }
    }
    window.addEventListener('yt-navigate-finish', listener)
  } else {
    setup()
  }
})()
