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
  /** Whether to log basic debug events */
  const DEBUG_LOGS = false
  const debug = DEBUG_LOGS
    ? (...args: any[]) => console.debug('[YouTube Undo]', ...args)
    : () => {}

  /** The interval **in seconds** to check the player's current time */
  const ROUGH_TIME_RATE = 2

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

  /** Keep track of the current player time while no events are in the array */
  let roughTime = 0

  setInterval(() => {
    const currentTime = player.getCurrentTime()
    roughTime = currentTime
  }, ROUGH_TIME_RATE * 1000)

  /** Time change events */
  const timeChanges: TimeChange[] = []

  /** The last time change event */
  const lastChange = () =>
    timeChanges.length ? timeChanges[timeChanges.length - 1] : null

  const lastOrRough = () => lastChange()?.after ?? roughTime

  // prettier-ignore
  const player = document.getElementById(
    'movie_player',
  ) as HTMLDivElement & YouTubePlayer

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
  document
    .querySelector<HTMLDivElement>('div.ytp-progress-bar')
    ?.addEventListener('click', () => {
      const currentTime = player.getCurrentTime()
      timeChanges.push({
        before: lastOrRough(),
        after: currentTime,
      })

      roughTime = currentTime
      debug('Added time change for playbar seek', lastChange()!)
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

      if (last?.after !== currentTime) {
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