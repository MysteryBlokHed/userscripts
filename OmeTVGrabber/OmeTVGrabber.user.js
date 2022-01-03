// ==UserScript==
// @name        OmeTV Grabber
// @description Get IP addresses of users on OmeTV
// @version     0.1.0
// @author      Adam Thompson-Sharpe
// @match       *://*.ome.tv/*
// @grant       none
// ==/UserScript==
;(() => {
  /** OmeTV hijacks most logging functions, but they forgot about groups for some reason */
  const groupLog = (...data) => {
    console.groupCollapsed(...data)
    console.groupEnd()
  }
  let lastCandidateType
  let currentIp = 'Not Found'
  let ipEl
  const setupIpContainer = () => {
    /* Set up container for IP */
    const buttonArea = document.querySelector('.buttons')
    if (!buttonArea) setTimeout(setupIpContainer, 1000)
    const ipContainer = document.createElement('div')
    ipContainer.style.textAlign = 'center'
    ipEl = document.createElement('span')
    ipEl.style.fontWeight = 'bold'
    ipEl.style.userSelect = 'text'
    ipEl.innerText = `IP: ${currentIp}`
    ipContainer.appendChild(ipEl)
    buttonArea?.prepend(ipContainer)
  }
  setupIpContainer()
  /**
   * Proxy handler for the RTCPeerConnection.prototype.addIceCandidate function
   */
  const addIceCandidateHandler = {
    apply(target, thisArg, args) {
      const candidate = args[0]
      console.groupCollapsed('Candidate', candidate, 'added')
      groupLog('Type:\t', candidate.type)
      groupLog('Address:\t', candidate.address)
      groupLog('Related:\t', candidate.relatedAddress)
      console.groupEnd()
      if (candidate.type === 'relay' && lastCandidateType !== 'relay') {
        currentIp = candidate.address
        groupLog('!!! IP FOUND !!! ', candidate.address)
        if (ipEl) ipEl.innerText = `IP: ${candidate.address}`
      }
      lastCandidateType = candidate.type
      return Reflect.apply(target, thisArg, args)
    },
  }
  /** Update the IP display when connections are closed */
  const closeHandler = {
    apply(target, thisArg, args) {
      if (ipEl && currentIp !== 'Not Found') {
        ipEl.innerText = `IP: Not Found (Last: ${currentIp})`
        currentIp = 'Not Found'
      }
      return Reflect.apply(target, thisArg, args)
    },
  }
  RTCPeerConnection.prototype.addIceCandidate = new Proxy(
    RTCPeerConnection.prototype.addIceCandidate,
    addIceCandidateHandler
  )
  RTCPeerConnection.prototype.close = new Proxy(
    RTCPeerConnection.prototype.close,
    closeHandler
  )
})()
