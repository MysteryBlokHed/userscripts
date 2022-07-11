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
  const debugFn = log =>
    log ? (...data) => console.debug('[InitLive Devtools]', ...data) : () => {}
  /** Get shift card elements */
  const shiftCards = () => document.querySelectorAll('.card-board > div')
  /** Convert one or more shifts to a list of numbers */
  const convertShifts = id => {
    if (typeof id !== 'object') id = [id]
    return id.map(id => (typeof id === 'string' ? parseInt(id) : id))
  }
  /**
   * Gets the `eventUserAccountId` property, which is used for some requests
   * @param user The user ID
   * @param event The event ID
   * @param auth Auth token
   */
  const getEventUserAccountId = async (user, event, auth) => {
    const time = new Date().toISOString()
    const response = await fetch(
      `https://app.initlive.com/EventUserAccounts/getEventUserAccount?eventId=${event}&time=${time}&userAccountId=${user}`,
      {
        method: 'GET',
        headers: {
          Accept: '*/*',
          Authorization: auth,
        },
      },
    ).then(r => r.json())
    return response.eventUserAccountId
  }
  const validateUnscheduleShiftOptions = options => {
    var _a
    const auth =
      (options === null || options === void 0 ? void 0 : options.auth) ||
      JSON.parse(localStorage['authToken'])
    const user =
      (options === null || options === void 0 ? void 0 : options.user) ||
      JSON.parse(localStorage['userAccountId'])
    const event =
      (options === null || options === void 0 ? void 0 : options.event) ||
      JSON.parse(localStorage['mainNavCurrentEventId'])
    const isEventUserAccountId =
      (_a =
        options === null || options === void 0
          ? void 0
          : options.isEventUserAccountId) !== null && _a !== void 0
        ? _a
        : false
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
  const validateScheduleShiftOptions = options => {
    const { auth, user, event, isEventUserAccountId } =
      validateUnscheduleShiftOptions(options)
    const org =
      (options === null || options === void 0 ? void 0 : options.org) ||
      JSON.parse(localStorage['mainNavCurrentOrgId'])
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
          var _a, _b
          const shiftId = el.id.replace('card_', '')
          const label = document.createElement('span')
          label.innerText = `Shift ID: ${shiftId}`
          ;(_b =
            (_a = el.querySelector('input')) === null || _a === void 0
              ? void 0
              : _a.parentElement) === null || _b === void 0
            ? void 0
            : _b.appendChild(label)
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
        validateScheduleShiftOptions(options)
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
        validateUnscheduleShiftOptions(options)
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
