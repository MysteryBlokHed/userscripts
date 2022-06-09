// ==UserScript==
// @name        YouTube Undo
// @description Undo changes in playback position on YouTube
// @version     0.1.0
// @author      Adam Thompson-Sharpe
// @namespace   MysteryBlokHed
// @license     GPL-3.0
// @copyright   2022 Adam Thomspon-Sharpe
// @homepageURL https://gitlab.com/MysteryBlokHed/userscripts/-/tree/main/YouTubeUndo
// @supportURL  https://gitlab.com/MysteryBlokHed/userscripts/-/issues
// @match       *://*.youtube.com/watch*
// @grant       none
// ==/UserScript==
;(() => {
  var _a
  /** Whether to log basic debug events */
  const DEBUG_LOGS = false
  const debug = DEBUG_LOGS
    ? (...args) => console.debug('[YouTube Undo]', ...args)
    : () => {}
  /** The interval **in seconds** to check the player's current time */
  const ROUGH_TIME_RATE = 2
  /** Keep track of the current player time while no events are in the array */
  let roughTime = 0
  setInterval(() => {
    const currentTime = player.getCurrentTime()
    roughTime = currentTime
  }, ROUGH_TIME_RATE * 1000)
  /** Time change events */
  const timeChanges = []
  /** The last time change event */
  const lastChange = () =>
    timeChanges.length ? timeChanges[timeChanges.length - 1] : null
  const lastOrRough = () => {
    var _a, _b
    return (_b =
      (_a = lastChange()) === null || _a === void 0 ? void 0 : _a.after) !==
      null && _b !== void 0
      ? _b
      : roughTime
  }
  // prettier-ignore
  const player = document.getElementById('movie_player');
  if (!player) {
    console.error('[YouTube Undo]', 'Player not found!')
    return
  }
  // Clear events on location changes
  window.addEventListener('yt-navigate-finish', () => {
    timeChanges.length = 0
    debug('New video, clearing event list')
  })
  // Watch for playbar clicks
  ;(_a = document.querySelector('div.ytp-progress-bar')) === null ||
  _a === void 0
    ? void 0
    : _a.addEventListener('click', () => {
        const currentTime = player.getCurrentTime()
        timeChanges.push({
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
        (last === null || last === void 0 ? void 0 : last.after) !== currentTime
      ) {
        timeChanges.push({
          before: lastOrRough(),
          after: currentTime,
        })
      }
    } else if (ev.ctrlKey && ev.key.toLowerCase() == 'z') {
      // Ctrl + Z
      const last = lastChange()
      debug('Ctrl + Z pressed')
      debug('Last:', last)
      if (last) {
        player.seekTo(last.before)
        timeChanges.pop()
      }
    }
  })
})()
