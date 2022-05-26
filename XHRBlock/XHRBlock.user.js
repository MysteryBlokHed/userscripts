// ==UserScript==
// @name        XHR Block
// @description Temporarily pause and resume XHR requests from the console
// @version     0.1.0
// @author      Adam Thompson-Sharpe
// @namespace   MysteryBlokHed
// @license     GPL-3.0
// @copyright   2022 Adam Thomspon-Sharpe
// @homepageURL https://gitlab.com/MysteryBlokHed/userscripts/-/tree/main/XHRBlock
// @supportURL  https://gitlab.com/MysteryBlokHed/userscripts/-/issues
// @match       <all_urls>
// @grant       none
// ==/UserScript==
;(() => {
  if (window.XHRBlock) return
  const defaultPauseOptions = {
    sendAfterResume: true,
  }
  /** Whether requests are currently paused */
  let paused = false
  // Hijack open to add metadata to instances
  XMLHttpRequest.prototype.open = new Proxy(XMLHttpRequest.prototype.open, {
    apply(target, thisArg, args) {
      thisArg.method = args[0]
      thisArg.url = args[1]
      return Reflect.apply(target, thisArg, args)
    },
  })
  // Hijack send for pausing
  XMLHttpRequest.prototype.send = new Proxy(XMLHttpRequest.prototype.send, {
    apply(target, thisArg, args) {
      var _a
      if (
        !paused ||
        (pauseOptions.matchUrl &&
          ((_a = thisArg.url) === null || _a === void 0
            ? void 0
            : _a.toString().match(pauseOptions.matchUrl)))
      ) {
        return Reflect.apply(target, thisArg, args)
      }
      const requestInfo = { thisArg, args }
      log('Paused request', requestInfo)
      // Queue requests if option is enabled
      if (pauseOptions.sendAfterResume) {
        log('Adding to pending requests')
        window.XHRBlock.pendingRequests.push(requestInfo)
      }
    },
  })
  /** Current pause options */
  let pauseOptions = defaultPauseOptions
  /** Get default options for `pause()` */
  const getDefaultPauseOptions = options =>
    Object.assign(Object.assign({}, defaultPauseOptions), options)
  const log = (...args) => {
    if (window.XHRBlock.debug) console.log('[XHRBlock]', ...args)
  }
  window.XHRBlock = {
    debug: true,
    pendingRequests: [],
    pause(options) {
      if (paused) return
      paused = true
      pauseOptions = getDefaultPauseOptions(options)
      log('Requests paused')
      log('Passed pause options:', options)
      log('Options with defaults:', pauseOptions)
    },
    resume() {
      if (!paused) return
      paused = false
      log('Requests resumed')
      // Send queued requests if option is enabled
      if (pauseOptions.sendAfterResume) {
        log(
          'sendAfterResume enabled, sending',
          window.XHRBlock.pendingRequests.length,
          'pending requests',
        )
        for (const request of window.XHRBlock.pendingRequests) {
          log('Sending request', request)
          Reflect.apply(
            XMLHttpRequest.prototype.send,
            request.thisArg,
            request.args,
          )
        }
        log('Done sending pending requests')
      }
    },
  }
})()
