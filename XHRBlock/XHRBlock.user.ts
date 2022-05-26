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

  type RequiredPauseOptions = Omit<Required<PauseOptions>, 'matchUrl'> &
    Pick<PauseOptions, 'matchUrl'>

  const defaultPauseOptions = {
    sendAfterResume: true,
  } as const

  /** Whether requests are currently paused */
  let paused = false

  // Hijack open to add metadata to instances
  XMLHttpRequest.prototype.open = new Proxy(XMLHttpRequest.prototype.open, {
    apply(
      target,
      thisArg: XMLHttpRequest,
      args: Parameters<typeof XMLHttpRequest['prototype']['open']>,
    ) {
      thisArg.method = args[0]
      thisArg.url = args[1]
      return Reflect.apply(target, thisArg, args)
    },
  })

  // Hijack send for pausing
  XMLHttpRequest.prototype.send = new Proxy(XMLHttpRequest.prototype.send, {
    apply(target, thisArg: XMLHttpRequest, args: XHRArgs) {
      if (
        !paused ||
        (pauseOptions.matchUrl &&
          thisArg.url?.toString().match(pauseOptions.matchUrl))
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
  let pauseOptions: RequiredPauseOptions = defaultPauseOptions

  /** Get default options for `pause()` */
  const getDefaultPauseOptions = (
    options: PauseOptions,
  ): RequiredPauseOptions => ({
    ...defaultPauseOptions,
    ...options,
  })

  const log = (...args: any[]) => {
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

interface XMLHttpRequest {
  /** HTTP method */
  method?: string | undefined
  /** Target URI */
  url?: string | URL | undefined
}

/** Arguments passed to `XMLHttpRequest.send()` */
type XHRArgs = Parameters<typeof XMLHttpRequest['prototype']['send']>

interface PendingRequest {
  thisArg: any
  args: XHRArgs
}

interface PauseOptions {
  /**
   * Provide a regular expression URL's must match to be paused.
   * If not passed, all requests will be paused
   */
  matchUrl?: RegExp | undefined

  /**
   * Whether to send paused requests after resuming.
   * If this is disabled, any requests that were paused will be discarded
   * instead of going through
   * @default true
   */
  sendAfterResume?: boolean | undefined
}

/** Temporarily pause and resume XHR requests */
interface XHRBlock {
  /**
   * Whether to log debug info
   * @default false
   */
  debug: boolean

  /**
   * Requests to be sent on resume.
   * Only filled if sendAfterResume is enabled
   */
  pendingRequests: PendingRequest[]

  /**
   * Pause outgoing XHR requests
   * @param options Configuration options
   */
  pause(options: PauseOptions): void

  /** Resume outgoing XHR requests */
  resume(): void
}

/** Temporarily pause and resume XHR requests */
declare var XHRBlock: XHRBlock
