// ==UserScript==
// @name        Omegle Grabber
// @description Get IP addresses on multiple video chat sites
// @version     0.3.1
// @author      Adam Thompson-Sharpe
// @license     GPL-3.0
// @match       *://*.omegle.com/*
// @match       *://*.ome.tv/*
// @match       *://*.chathub.cam/*
// @match       *://*.emeraldchat.com/*
// @grant       GM.xmlHttpRequest
// @require     https://gitlab.com/MysteryBlokHed/greasetools/-/raw/v0.4.0/greasetools.user.js
// ==/UserScript==
/// <reference types="greasetools" />
;(() => {
  const { xhrPromise } = GreaseTools

  const SiteMap = {
    'www.omegle.com': 'omegle',
    'ome.tv': 'ometv',
    'chathub.cam': 'chathub',
    'www.emeraldchat.com': 'emeraldchat',
  } as const

  type SiteLocation = keyof typeof SiteMap
  type SiteName = typeof SiteMap[SiteLocation]

  let currentIp: string = 'Not Found'

  interface IpInfo {
    ip: string
    country?: string
    region?: string
    city?: string
    org?: string
  }

  /** Per-site logic to get the IP and add its info to the page */
  interface Site {
    /**
     * Given an RTCIceCandidate, should return either the IP address of the target
     * if the provided candidate has it, or null if the candidate does not
     * @param candidate Some ICE candidate for an RTCPeerConnection
     */
    getIp(candidate: RTCIceCandidate | RTCIceCandidateInit): string | null
    /**
     * Should add the given message somewhere the user can easily see it.
     * It's safe to assume that this will only even be called after `getIp`
     */
    addIpInfo(message: string): void
    /** Called whenever an RTCPeerConnection is closed */
    rtcClose?(): void
  }

  /** Interface for a site that needs to store the type of the last candidate */
  interface LastCandidateSite extends Site {
    /** The type of the last ICE candidate to be connected to */
    lastCandidateType: RTCIceCandidateType | null
  }

  /** Interface for a site that needs a reference to the IP info element */
  interface IpElSite extends Site {
    /** The element containing the IP info */
    ipInfoEl?: HTMLElement
  }

  const srflxIp = (candidate: RTCIceCandidateInit) => {
    if (!candidate.candidate || !candidate.candidate.includes('typ srflx'))
      return null

    const addresses = candidate.candidate.match(
      /\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}/g,
    )

    return addresses ? addresses[0] ?? null : null
  }

  const Sites: Record<SiteName, Site> = {
    // TODO: Verify that this actually works
    // I'm IP banned from Omegle so I'm writing this from what I vaguely remember working last time
    omegle: {
      getIp: srflxIp,

      addIpInfo(message) {
        const chatbox = document.querySelector(
          '.logbox .logitem',
        ) as HTMLElement | null
        if (!chatbox) return
        chatbox.innerText = message
      },
    },

    ometv: {
      lastCandidateType: 'relay',

      getIp(candidate: RTCIceCandidate) {
        const lastCandidateType = this.lastCandidateType
        this.lastCandidateType = candidate.type

        if (candidate.type === 'relay' && lastCandidateType !== 'relay')
          return candidate.address
        return null
      },

      addIpInfo(message) {
        const chat = document.querySelector('.message.system')
        if (!chat) return

        const messageContainer = document.createElement('div')
        messageContainer.className = 'message in'
        messageContainer.style.textAlign = 'center'
        const messageEl = document.createElement('span')
        messageEl.innerText = message

        messageContainer.appendChild(messageEl)
        chat.prepend(messageContainer)
      },
    } as LastCandidateSite,

    chathub: {
      getIp: srflxIp,

      addIpInfo(message) {
        const chatbox = document.querySelector(
          '#message-section',
        ) as HTMLElement | null
        if (!chatbox) return

        const messageEl = document.createElement('p')
        messageEl.style.textAlign = 'center'
        messageEl.innerText = message
        chatbox.prepend(messageEl)
      },
    },

    emeraldchat: {
      getIp: srflxIp,

      addIpInfo(message) {
        if (!this.ipInfoEl) {
          const chatbox = document.querySelector(
            '#messages',
          ) as HTMLElement | null
          if (!chatbox) return

          this.ipInfoEl = document.createElement('p')
          this.ipInfoEl.style.textAlign = 'center'
          chatbox.prepend(this.ipInfoEl)
        }

        this.ipInfoEl.innerText = message
      },

      rtcClose() {
        this.addIpInfo(currentIp)
      },
    } as IpElSite,
  }

  /**
   * Get the active site
   * @returns The active site
   * @throws {Error} Thrown if an unsupported site is visited
   */
  const getSite = (): SiteName => {
    if (location.hostname in SiteMap)
      return SiteMap[location.hostname as SiteLocation]
    throw new Error('Activated on unsupported site')
  }

  /** The active site */
  const site = getSite()

  /** Some sites hijack most logging functions, but they tend to forget about groups */
  const groupLog = (...data: any[]) => {
    console.groupCollapsed(...data)
    console.groupEnd()
  }

  /** Look up ip info */
  const findIpInfo = (ip: string): Promise<IpInfo> =>
    new Promise(resolve => {
      xhrPromise({
        method: 'GET',
        url: `https://ipinfo.io/${ip}/json`,
      })
        .then(({ responseText }) => {
          const info = JSON.parse(responseText) as Record<string, string>
          resolve({ ip, ...info })
        })
        .catch(() => {
          groupLog('Failed to get IP info from ipinfo.io')
          resolve({ ip })
        })
    })

  /** Add IP info to the chatbox */
  const addIpInfo = (
    ip: string,
    country = 'Not Found',
    region = 'Not Found',
    city = 'Not Found',
    org = 'Not Found',
  ) => {
    Sites[site].addIpInfo(`\
Relay IP: ${ip}
Country: ${country}
Region: ${region}
City: ${city}
Org: ${org}\n`)
  }

  /**
   * Proxy handler for the RTCPeerConnection.prototype.addIceCandidate function
   */
  const addIceCandidateHandler: ProxyHandler<
    typeof RTCPeerConnection['prototype']['addIceCandidate']
  > = {
    apply(target, thisArg: RTCPeerConnection, args: [RTCIceCandidate, ...any]) {
      const candidate = args[0]

      console.groupCollapsed('Candidate', candidate, 'added')
      groupLog('Type:\t\t', candidate.type)
      groupLog('Address:\t', candidate.address)
      groupLog('Related:\t', candidate.relatedAddress)
      console.groupEnd()

      const ip = Sites[site].getIp(candidate)
      if (ip && ip !== currentIp) {
        currentIp = ip
        groupLog('IP FOUND:', currentIp)
        findIpInfo(currentIp).then(info => {
          groupLog('IP INFO:', info)
          addIpInfo(info.ip, info.country, info.region, info.city, info.org)
        })
      }

      return Reflect.apply(target, thisArg, args)
    },
  }

  /**
   * Proxy handler for the RTCPeerConnection.prototype.close function
   */
  const closeHandler: ProxyHandler<
    typeof RTCPeerConnection['prototype']['close']
  > = {
    apply(target, thisArg: RTCPeerConnection, args) {
      currentIp = 'Not Found'

      // Call rtcClose if defined
      Sites[site].rtcClose?.()

      return Reflect.apply(target, thisArg, args)
    },
  }

  RTCPeerConnection.prototype.addIceCandidate = new Proxy(
    RTCPeerConnection.prototype.addIceCandidate,
    addIceCandidateHandler,
  )

  RTCPeerConnection.prototype.close = new Proxy(
    RTCPeerConnection.prototype.close,
    closeHandler,
  )
})()
