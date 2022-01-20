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
  const domainMap = {
    'ome.tv': 'ometv',
  }
  let lastCandidateType
  let currentIp = 'Not Found'
  const Sites = {
    ometv: {
      getIp(candidate) {
        if (candidate.type === 'relay' && lastCandidateType !== 'relay')
          return candidate.address
        return null
      },
      getMessageElement() {
        const chat = document.querySelector('.message.system')
        const messageContainer = document.createElement('div')
        messageContainer.className = 'message in'
        messageContainer.style.textAlign = 'center'
        const message = document.createElement('span')
        messageContainer.appendChild(message)
        chat.prepend(messageContainer)
        return message
      },
    },
  }
  /**
   * Get the active site
   * @returns The active site
   * @throws {Error} Thrown if an unsupported site is visited
   */
  const getSite = () => {
    const site = domainMap[location.hostname]
    if (!site) throw new Error('Activated on unsupported site')
    return site
  }
  /** The active site */
  const site = getSite()
  /** Some sites hijack most logging functions, but they tend to forget about groups */
  const groupLog = (...data) => {
    console.groupCollapsed(...data)
    console.groupEnd()
  }
  /** Look up ip info */
  const findIpInfo = async ip =>
    new Promise(resolve => {
      xhrPromise({
        method: 'GET',
        url: `https://ipinfo.io/${ip}/json`,
      })
        .then(({ responseText }) => {
          const info = JSON.parse(responseText)
          resolve({ ip, ...info })
        })
        .catch(() => {
          groupLog('Failed to get IP info from ipinfo.io')
          resolve({ ip })
        })
    })
  /** Add IP info to the chatbox */
  const addIpInfo = (
    ip,
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
  const addIceCandidateHandler = {
    apply(target, thisArg, args) {
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
      if (candidate.type) lastCandidateType = candidate.type
      return Reflect.apply(target, thisArg, args)
    },
  }
  RTCPeerConnection.prototype.addIceCandidate = new Proxy(
    RTCPeerConnection.prototype.addIceCandidate,
    addIceCandidateHandler
  )
})()
