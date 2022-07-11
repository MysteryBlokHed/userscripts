// ==UserScript==
// @name        InitLive Devtools
// @description Ignore restrictions when scheduling/unscheduling shifts
// @version     0.1.0
// @author      Adam Thompson-Sharpe
// @namespace   MysteryBlokHed
// @license     GPL-3.0
// @copyright   2022 Adam Thomspon-Sharpe
// @homepageURL https://gitlab.com/MysteryBlokHed/userscripts/-/tree/main/InitLiveDevtools
// @supportURL  https://gitlab.com/MysteryBlokHed/userscripts/-/issues
// @match       *://app.initlive.com/*
// @grant       none
// ==/UserScript==
;(() => {
  const debugFn = (log: boolean) =>
    log
      ? (...data: any[]) => console.debug('[InitLive Devtools]', ...data)
      : () => {}

  /** Get shift card elements */
  const shiftCards = () =>
    document.querySelectorAll<HTMLDivElement>('.card-board > div')

  /** Convert one or more shifts to a list of numbers */
  const convertShifts = (id: string | number | Array<string | number>) => {
    if (typeof id !== 'object') id = [id]
    return id.map(id => (typeof id === 'string' ? parseInt(id) : id))
  }

  /**
   * Gets the `eventUserAccountId` property, which is used for some requests
   * @param user The user ID
   * @param event The event ID
   * @param auth Auth token
   */
  const getEventUserAccountId = (
    user: string | number,
    event: string | number,
    auth: string,
  ) => {
    const time = new Date().toISOString()
    return fetch(
      `https://app.initlive.com/EventUserAccounts/getEventUserAccount?eventId=${event}&time=${time}&userAccountId=${user}`,
      {
        method: 'GET',
        headers: {
          Accept: '*/*',
          Authorization: auth,
        },
      },
    )
      .then(r => r.json())
      .then(json => json.eventUserAccountId)
  }

  const validateRemoveShiftOptions = (
    options?: RemoveShiftOptions,
  ): Required<RemoveShiftOptions> => {
    const auth = options?.auth || JSON.parse(localStorage['authToken'])
    const user = options?.user || JSON.parse(localStorage['userAccountId'])
    const event =
      options?.event || JSON.parse(localStorage['mainNavCurrentEventId'])
    const isEventUserAccountId = options?.isEventUserAccountId ?? false

    if (!auth) {
      throw new TypeError(
        '[InitLive Devtools] User ID was not provided and could not be inferred from localStorage',
      )
    }
    if (!user) {
      throw new TypeError(
        '[InitLive Devtools] User ID was not provided and could not be inferred from localStorage',
      )
    }
    if (!event) {
      throw new TypeError(
        '[InitLive Devtools] Event ID was not provided and could not be inferred from localStorage',
      )
    }

    return { auth, user, event, isEventUserAccountId }
  }

  const validateAddShiftOptions = (
    options?: AddShiftOptions,
  ): Required<AddShiftOptions> => {
    const { auth, user, event, isEventUserAccountId } =
      validateRemoveShiftOptions(options)
    const org = options?.org || JSON.parse(localStorage['mainNavCurrentOrgId'])

    if (!org) {
      throw new TypeError(
        '[InitLive Devtools] Org ID was not provided and could not be inferred from localStorage',
      )
    }

    return { auth, user, org, event, isEventUserAccountId }
  }

  window.ILDevtools = {
    debug: true,

    showShiftIds() {
      const debug = debugFn(ILDevtools.debug)

      // Verify active page
      if (window.location.hash.includes('shift-selection')) {
        debug('On shift selection page')

        // Get all shift cards
        const cards = shiftCards()
        if (!cards) debug('Failed to get cards')

        // Add ID to each
        cards.forEach(el => {
          const shiftId = el.id.replace('card_', '')

          const label = document.createElement('span')
          label.innerText = `Shift ID: ${shiftId}`
          el.querySelector('input')?.parentElement?.appendChild(label)

          debug('Added shift ID', shiftId, 'to', el, 'with element', label)
        })
      } else {
        debug('Not on shift selection page')
      }
    },

    showShiftChecks() {
      const debug = debugFn(ILDevtools.debug)

      // Verify active page
      if (window.location.hash.includes('shift-selection')) {
        debug('On shift selection page')

        // Get all shift cards
        const checkboxes = document.querySelectorAll('.card-board > div input')
        if (!checkboxes) debug('Failed to get checkboxes')

        // Enable & show checkboxes
        checkboxes.forEach(el => {
          el.removeAttribute('disabled')
          el.className = el.className.replace(/\s*ng-hide/, '')
        })
      } else {
        debug('Not on shift selection page')
      }
    },

    async scheduleShift(id, options) {
      const debug = debugFn(ILDevtools.debug)
      const { auth, user, org, event, isEventUserAccountId } =
        validateAddShiftOptions(options)
      const ids = convertShifts(id)

      const eventUserId = isEventUserAccountId
        ? user
        : await getEventUserAccountId(user, event, auth)

      debug('Event User ID:', eventUserId)
      debug('Scheduling for shift(s)', ids, 'for org', org, 'and event', event)

      return await fetch(
        `https://app.initlive.com/api/v1/organizations/${org}/events/${event}/shiftRoles`,
        {
          method: 'POST',
          headers: {
            Accept: '*/*',
            Authorization: auth,
            'Content-Type': 'application/json;charset=utf-8',
          },
          body: JSON.stringify({
            eventUserAccountIds: [eventUserId],
            eventShiftRoleIds: ids,
          }),
        },
      )
    },

    async unscheduleShift(id, options) {
      const debug = debugFn(ILDevtools.debug)
      const { auth, user, event, isEventUserAccountId } =
        validateRemoveShiftOptions(options)
      const ids = convertShifts(id)

      const eventUserId = isEventUserAccountId
        ? user
        : await getEventUserAccountId(user, event, auth)

      debug('Event User ID:', eventUserId)
      debug('Unscheduling for shift(s)', ids, 'for event', event)

      const bulk = ids.map(id => ({
        event_user_Id: eventUserId,
        event_shift_role_Id: id,
      }))

      return fetch(
        'https://app.initlive.com/EventShiftRoleUserAccounts/delete/bulk',
        {
          method: 'POST',
          headers: {
            Accept: '*/*',
            Authorization: auth,
            'Content-Type': 'application/json;charset=utf-8',
          },
          body: JSON.stringify(bulk),
        },
      )
    },
  }
})()

interface RemoveShiftOptions {
  /** The user ID (attempts to infer if not provided) */
  user?: string | number
  /** The event ID (attempts to infer if not provided) */
  event?: string | number
  /**
   * Whether the provided ID is the eventUserAccountId.
   * Only change this if the `user` parameter being passed is the result of `getEventUserAccountId`
   * @default false
   */
  isEventUserAccountId?: boolean | undefined
  /**
   * Auth token (attempts to infer if not provided)
   * @example 'Basic Szdlc0EyfUMtb29SfDtAKHZxNyI9OkkqLHlxPlR4KlpifURVcEZqWGxOdHMrLntmQkM3anc='
   *
   */
  auth?: string
}

interface AddShiftOptions extends RemoveShiftOptions {
  /** The organization ID (attempts to infer if not provided) */
  org?: string | number
}

interface ILDevtools {
  /**
   * Whether to log debug messages
   * @default true
   */
  debug: boolean

  /** Show shift IDs on the shift selection page */
  showShiftIds(): void

  /** Show/enable hidden/disabled checkboxes for shfits */
  showShiftChecks(): void

  /** Schedule yourself for a shift or shifts */
  scheduleShift(
    id: string | number | Array<string | number>,
    options?: AddShiftOptions,
  ): Promise<Response>

  /** Unschedule yourself for a shift or shifts */
  unscheduleShift(
    id: string | number | Array<string | number>,
    options?: RemoveShiftOptions,
  ): Promise<Response>
}

declare var ILDevtools: ILDevtools
