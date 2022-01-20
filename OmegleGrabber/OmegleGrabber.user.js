// ==UserScript==
// @name        Omegle Grabber
// @description Get IP addresses on multiple video chat sites
// @version     0.2.0
// @author      Adam Thompson-Sharpe
// @license     GPL-3.0
// @match       *://*.ome.tv/*
// @match       *://*.omegle.com/*
// @grant       GM.xmlHttpRequest
// @require     https://gitlab.com/MysteryBlokHed/greasetools/-/raw/v0.4.0/greasetools.user.js
// ==/UserScript==
/// <reference types="greasetools" />
;(() => {
  const { xhrPromise } = GreaseTools
  const SiteMap = {
    'www.omegle.com': 'omegle',
    'ome.tv': 'ometv',
  }
  let currentIp = 'Not Found'
  const Sites = {
    // TODO: Verify that this actually works
    // I'm IP banned from Omegle so I'm writing this from what I vaguely remember working last time
    omegle: {
      getIp(candidate) {
        if (!candidate.candidate || !candidate.candidate.includes('typ srflx'))
          return null
        const addresses = candidate.candidate.match(
          /\d{1,3}.\d{1,3}.\d{1,3}.\d{1,3}/g
        )
        return addresses ? addresses[1] ?? null : null
      },
      addIpInfo(message) {
        const chatbox = document.querySelector('.logbox > .logitem.info')
        if (!chatbox) return
        chatbox.innerText = message
      },
    },
    ometv: {
      lastCandidateType: 'relay',
      getIp(candidate) {
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
        messageContainer.appendChild(messageEl)
        chat.prepend(messageContainer)
        messageEl.innerText = message
      },
    },
  }
  /**
   * Get the active site
   * @returns The active site
   * @throws {Error} Thrown if an unsupported site is visited
   */
  const getSite = () => {
    if (location.hostname in SiteMap) return SiteMap[location.hostname]
    throw new Error('Activated on unsupported site')
  }
  /** The active site */
  const site = getSite()
  /** Some sites hijack most logging functions, but they tend to forget about groups */
  const groupLog = (...data) => {
    console.groupCollapsed(...data)
    console.groupEnd()
  }
  /** Look up ip info */
  const findIpInfo = ip =>
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
      return Reflect.apply(target, thisArg, args)
    },
  }
  RTCPeerConnection.prototype.addIceCandidate = new Proxy(
    RTCPeerConnection.prototype.addIceCandidate,
    addIceCandidateHandler
  )
})()
