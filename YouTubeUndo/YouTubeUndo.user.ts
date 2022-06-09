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
  const DEBUG_LOGS = true
  const debug = DEBUG_LOGS
    ? (...args: any[]) => console.debug('[YouTube Undo]', ...args)
    : () => {}

  /** A partial version of the YouTube Player interface used by the UserScript */
  interface YouTubePlayer {
    getCurrentTime(): number
    seekTo(time: number): void
  }

  interface TimeChange {
    /** The time before the change */
    before: number
    /** The time after the change */
    after: number
  }

  /** Time change events */
  const timeChanges: TimeChange[] = []

  /** The last time change event */
  const lastChange = () =>
    timeChanges.length ? timeChanges[timeChanges.length - 1] : null

  // prettier-ignore
  const player = document.getElementById(
    'movie_player',
  ) as HTMLDivElement & YouTubePlayer

  if (!player) {
    console.error('[YouTube Undo]', 'Player not found!')
    return
  }

  /** Keep track of the current player time while no events are in the array */
  let roughTime = 0

  setInterval(() => {
    if (!timeChanges.length) roughTime = player.getCurrentTime()
  }, 2000)

  window.addEventListener('keydown', ev => {
    if (ev.key.match(/^(?:\d|j|l|ArrowLeft|ArrowRight)$/i)) {
      // A key that might change the current time

      const last = lastChange()
      const time = player.getCurrentTime()

      debug('Time-changing key pressed')
      debug('Last:', last)
      debug('Current:', time)
      if (!last) debug('Rough Time:', roughTime)
      debug('Condition check:', last?.after !== time)

      if (last?.after !== time) {
        timeChanges.push({
          before: last?.after ?? roughTime,
          after: time,
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
