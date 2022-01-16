// ==UserScript==
// @name        OmeTV Grabber
// @description Get the relay IP addresses of users on OmeTV
// @version     0.2.0
// @author      Adam Thompson-Sharpe
// @license     GPL-3.0
// @match       *://*.ome.tv/*
// @grant       GM.xmlHttpRequest
// @require     https://gitlab.com/MysteryBlokHed/greasetools/-/raw/df110500/greasetools.user.js
// ==/UserScript==
/// <reference types="greasetools" />
;(() => {
  const { xhrPromise } = GreaseTools

  interface IpInfo {
    ip: string
    country?: string
    region?: string
    city?: string
    org?: string
  }

  /**
   * Get the active site
   * @returns The active site
   * @throws {Error} Thrown if an unsupported site is visited
   */
  const getSite = () => {
    switch (location.hostname) {
      case 'ome.tv':
        return 'ometv' as const
      default:
        throw new Error('Activated on unsupported site')
    }
  }

  /** The active site */
  const site = getSite()

  /** Some sites hijack most logging functions, but they tend to forget about groups */
  const groupLog = (...data: any[]) => {
    console.groupCollapsed(...data)
    console.groupEnd()
  }

  let lastCandidateType: RTCIceCandidateType | null
  let currentIp: string = 'Not Found'

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
    const message = (() => {
      switch (site) {
        case 'ometv':
          const chat = document.querySelector('.message.system')
          if (!chat) return

          const messageContainer = document.createElement('div')
          messageContainer.className = 'message in'
          messageContainer.style.textAlign = 'center'
          const message = document.createElement('span')

          messageContainer.appendChild(message)
          chat.prepend(messageContainer)
          return message
      }
    })() as HTMLElement

    message.innerText = `Relay IP: ${ip}
    Country: ${country}
    Region: ${region}
    City: ${city}
    Org: ${org}\n`
  }

  const targetIp = (candidate: RTCIceCandidate): string | null => {
    switch (site) {
      case 'ometv':
        if (candidate.type === 'relay' && lastCandidateType !== 'relay')
          return candidate.address
        break
    }
    return null
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

      const ip = targetIp(candidate)
      if (ip) {
        currentIp = ip
        groupLog('IP FOUND:', currentIp)
        findIpInfo(currentIp).then(info => {
          groupLog('IP INFO:', info)
          addIpInfo(info.ip, info.country, info.region, info.city, info.org)
        })
      }

      if (candidate.type) lastCandidateType = candidate.type
      return Reflect.apply(target, thisArg, args)
    },
  }

  RTCPeerConnection.prototype.addIceCandidate = new Proxy(
    RTCPeerConnection.prototype.addIceCandidate,
    addIceCandidateHandler
  )
})()
