// ==UserScript==
// @name        Omegle Grabber
// @description Get IP addresses on multiple video chat sites
// @version     0.7.0
// @author      Adam Thompson-Sharpe
// @namespace   MysteryBlokHed
// @license     GPL-3.0
// @copyright   2022 Adam Thomspon-Sharpe
// @homepageURL https://gitlab.com/MysteryBlokHed/userscripts/-/tree/main/OmegleGrabber
// @supportURL  https://gitlab.com/MysteryBlokHed/userscripts/-/issues
// @match       *://*.omegle.com/*
// @match       *://*.ome.tv/*
// @match       *://*.chathub.cam/*
// @match       *://*.emeraldchat.com/*
// @match       *://*.camsurf.com/*
// @match       *://*.strangercam.com/*
// @match       *://*.allotalk.com/*
// @require     https://gitlab.com/MysteryBlokHed/greasetools/-/raw/v0.5.0/greasetools.user.js
// @grant       GM.xmlHttpRequest
// ==/UserScript==
/// <reference types="greasetools" />
;(() => {
  const { xhrPromise } = GreaseTools

  const SiteMap = {
    'www.omegle.com': 'omegle',
    'ome.tv': 'ometv',
    'chathub.cam': 'chathub',
    'www.emeraldchat.com': 'emeraldchat',
    'camsurf.com': 'camsurf',
    'strangercam.com': 'strangerOrAllo',
    'app.strangercam.com': 'strangerOrAllo',
    'randomchat.allotalk.com': 'strangerOrAllo',
  } as const

  type SiteLocation = keyof typeof SiteMap
  type SiteName = typeof SiteMap[SiteLocation]

  let currentIp: string = 'Not Found'

  interface IpInfo {
    ip: string
    country?: string | undefined
    region?: string | undefined
    city?: string | undefined
    org?: string | undefined
    loc?: string | undefined
    tz?: string | undefined
  }

  /** Per-site logic to get the IP and add its info to the page */
  interface Site {
    /** Called when the site finishes loading */
    onload?(): void
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

  const removeWhenExists = (getEl: () => Element | undefined | null) => {
    const interval = setInterval(() => {
      const el = getEl()
      if (el) {
        el.remove()
        clearInterval(interval)
      }
    }, 500)
  }

  const Sites: Record<SiteName, Site> = {
    omegle: {
      getIp: srflxIp,

      onload() {
        removeWhenExists(() => document.querySelector('#videologo'))
      },

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

      onload() {
        removeWhenExists(() =>
          document.querySelector('.remote-video__watermark'),
        )
      },

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

    camsurf: {
      getIp: srflxIp,

      addIpInfo(message) {
        const chatbox = document.querySelector(
          '.rv_head.chat-ava > p',
        ) as HTMLElement | null
        console.log(chatbox)
        if (!chatbox) return

        chatbox.innerText = message
      },
    },

    strangerOrAllo: {
      getIp: srflxIp,

      addIpInfo(message) {
        const chatBody = document.querySelector(
          '.chat-body',
        ) as HTMLElement | null
        if (!chatBody) return

        const remoteChat = document.createElement('div')
        remoteChat.className = 'remote-chat'
        const container = document.createElement('div')
        const ipInfo = document.createElement('span')
        ipInfo.className = 'server-msg'
        ipInfo.innerText = message

        container.appendChild(ipInfo)
        remoteChat.appendChild(container)
        chatBody.prepend(remoteChat)
      },
    },
  }

  /**
   * Get the active site
   * @returns The active site
   * @throws {Error} Thrown if an unsupported site is visited
   */
  const getSite = (): SiteName => {
    if (location.hostname in SiteMap)
      return SiteMap[location.hostname as SiteLocation]
    throw new Error(`Activated on unsupported site (${location.hostname})`)
  }

  /** The active site */
  const site = getSite()

  window.addEventListener('load', () => Sites[site].onload?.())

  /** Some sites hijack most logging functions, but they tend to forget about groups */
  const groupLog = (...data: any[]) => {
    console.groupCollapsed(...data)
    console.groupEnd()
  }

  type CountryResponse = {
    name: {
      common: string
      official: string
    }
    /** Flag emoji for the country */
    flag: string
  } & Record<string, any>

  /**
   * @param code A two-letter country code
   * @returns A Promise that resolves with the country's full name and its flag emoji,
   * or rejects with the message returned by the API in case of failure
   */
  const fullCountry = (code: string): Promise<string> =>
    new Promise(async (resolve, reject) => {
      const result = await fetch(
        `https://restcountries.com/v3.1/alpha/${code.toUpperCase()}`,
      )
      const response = JSON.parse(await result.text())[0] as CountryResponse
      if (result.status !== 200) reject(response.text)
      resolve(
        `${response.name.common} ${response.flag} (${code.toUpperCase()})`,
      )
    })

  /** Look up ip info */
  const findIpInfo = (ip: string): Promise<IpInfo> =>
    new Promise(resolve => {
      xhrPromise({
        method: 'GET',
        url: `https://ipinfo.io/${ip}/json`,
      })
        .then(async ({ responseText }) => {
          const info = JSON.parse(responseText) as Record<string, string>
          resolve({
            ip,
            country: await fullCountry(info.country).catch(() => info.country),
            region: info.region,
            city: info.city,
            org: info.org,
            loc: info.loc,
            tz: info.timezone,
          })
        })
        .catch(() => {
          groupLog('Failed to get IP info from ipinfo.io')
          resolve({ ip })
        })
    })

  const defaultInfo = ({
    ip,
    country,
    region,
    city,
    org,
    loc,
    tz,
  }: IpInfo): Required<IpInfo> => {
    return {
      ip,
      country: country ?? 'Not Found',
      region: region ?? 'Not Found',
      city: city ?? 'Not Found',
      org: org ?? 'Not Found',
      loc: loc ?? 'Not Found',
      tz: tz ?? 'Not Found',
    }
  }

  const getTime = (timeZone?: string) =>
    new Date().toLocaleString('en-US', { timeZone })

  /** Add IP info to the chatbox */
  const addIpInfo = (info: IpInfo) => {
    const { ip, country, region, city, org, loc, tz } = defaultInfo(info)

    Sites[site].addIpInfo(`\
IP: ${ip}
Country: ${country}
Region: ${region}
City: ${city}
Org: ${org}
APPROX Coords: ${loc}
Timezone: ${tz}
Time (When First Connected): ${getTime(tz)}
\n`)
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
          addIpInfo(info)
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
