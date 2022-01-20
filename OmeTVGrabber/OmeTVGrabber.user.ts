// ==UserScript==
// @name        OmeTV Grabber
// @description Get the relay IP addresses of users on OmeTV
// @version     0.2.0
// @author      Adam Thompson-Sharpe
// @license     GPL-3.0
// @match       *://*.ome.tv/*
// @grant       GM.xmlHttpRequest
// @require     https://gitlab.com/MysteryBlokHed/greasetools/-/raw/v0.4.0/greasetools.user.js
// ==/UserScript==
/// <reference types="greasetools" />
;(() => {
  const { xhrPromise } = GreaseTools

  /** Names of supported sites */
  type SiteName = 'ometv'

  const siteMap: Record<string, SiteName> = {
    'ome.tv': 'ometv',
  }

  let currentIp: string = 'Not Found'

  interface IpInfo {
    ip: string
    country?: string
    region?: string
    city?: string
    org?: string
  }

  /** Per-site logic to get the IP and add it to the page */
  interface Site {
    /**
     * Given an RTCIceCandidate, should return either the IP address of the target
     * if the provided candidate has it, or null if the candidate does not
     * @param candidate Some ICE candidate for an RTCPeerConnection
     */
    getIp(candidate: RTCIceCandidate | RTCIceCandidateInit): string | null
    /**
     * Should return an element to add IP address information to, if possible.
     * It's safe to assume that this will only even be called after `getIp`
     */
    getMessageElement(): HTMLElement
  }

  interface LastCandidateSite extends Site {
    /** The type of the last ICE candidate to be connected to */
    lastCandidateType: RTCIceCandidateType | null
  }

  const Sites: Record<SiteName, Site> = {
    ometv: {
      lastCandidateType: 'relay',
      getIp(candidate: RTCIceCandidate) {
        const lastCandidateType = this.lastCandidateType
        this.lastCandidateType = candidate.type

        if (candidate.type === 'relay' && lastCandidateType !== 'relay')
          return candidate.address
        return null
      },

      getMessageElement() {
        const chat = document.querySelector('.message.system') as HTMLElement

        const messageContainer = document.createElement('div')
        messageContainer.className = 'message in'
        messageContainer.style.textAlign = 'center'
        const message = document.createElement('span')

        messageContainer.appendChild(message)
        chat.prepend(messageContainer)
        return message
      },
    } as LastCandidateSite,
  } as const

  /**
   * Get the active site
   * @returns The active site
   * @throws {Error} Thrown if an unsupported site is visited
   */
  const getSite = (): SiteName => {
    const site = siteMap[location.hostname]
    if (!site) throw new Error('Activated on unsupported site')
    return site
  }

  /** The active site */
  const site = getSite()

  /** Some sites hijack most logging functions, but they tend to forget about groups */
  const groupLog = (...data: any[]) => {
    console.groupCollapsed(...data)
    console.groupEnd()
  }

  /** Look up ip info */
  const findIpInfo = async (ip: string): Promise<IpInfo> =>
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
    org = 'Not Found'
  ) => {
    /** The element to add the IP info to */
    const message = Sites[site].getMessageElement()

    message.innerText = `Relay IP: ${ip}
    Country: ${country}
    Region: ${region}
    City: ${city}
    Org: ${org}\n`
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
      if (ip) {
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

  RTCPeerConnection.prototype.addIceCandidate = new Proxy(
    RTCPeerConnection.prototype.addIceCandidate,
    addIceCandidateHandler
  )
})()
