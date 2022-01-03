// ==UserScript==
// @name        OmeTV Grabber
// @description Get the relay IP addresses of users on OmeTV
// @version     0.1.0
// @author      Adam Thompson-Sharpe
// @match       *://*.ome.tv/*
// @grant       GM.xmlHttpRequest
// ==/UserScript==
;(() => {
  interface IpInfo {
    ip: string
    country?: string
    region?: string
    city?: string
    org?: string
  }

  /** OmeTV hijacks most logging functions, but they forgot about groups for some reason */
  const groupLog = (...data: any[]) => {
    console.groupCollapsed(...data)
    console.groupEnd()
  }

  let lastCandidateType: RTCIceCandidateType | null
  let currentIp: string = 'Not Found'

  const sendXhrPromise = (
    xhrInfo: Omit<GM.Request, 'onreadystatechange'>
  ): Promise<GM.Response<GM.Request>> =>
    new Promise((resolve, reject) => {
      let lastState = XMLHttpRequest.UNSENT

      GM.xmlHttpRequest({
        ...xhrInfo,
        onreadystatechange: response => {
          if (response.readyState === XMLHttpRequest.DONE) {
            if (lastState < 3) reject(new Error(`XHR request failed`))
            else resolve(response)
          }
          lastState = response.readyState
        },
      })
    })

  /** Look up ip info */
  const findIpInfo = async (ip: string): Promise<IpInfo> =>
    new Promise((resolve, reject) => {
      sendXhrPromise({
        method: 'GET',
        url: `https://ipinfo.io/${ip}/json`,
      })
        .then(({ responseText }) => {
          const info = JSON.parse(responseText) as Record<string, string>
          resolve({
            ip,
            country: info.country,
            region: info.region,
            city: info.city,
            org: info.org,
          })
        })
        .catch(reason => {
          groupLog('Failed to get IP info, reason:', reason)
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
    groupLog('called')
    const chat = document.querySelector('.message.system')
    if (!chat) return

    const messageContainer = document.createElement('div')
    messageContainer.className = 'message in'
    messageContainer.style.textAlign = 'center'
    const message = document.createElement('span')
    message.innerText = `Relay IP: ${ip}
Country: ${country}
Region: ${region}
City: ${city}
Org: ${org}\n`

    messageContainer.appendChild(message)
    chat.prepend(messageContainer)
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
      groupLog('Type:\t', candidate.type)
      groupLog('Address:\t', candidate.address)
      groupLog('Related:\t', candidate.relatedAddress)
      console.groupEnd()

      if (candidate.type === 'relay' && lastCandidateType !== 'relay') {
        currentIp = candidate.address ?? 'Not Found'
        groupLog('!!! IP FOUND !!! ', currentIp)
        findIpInfo(currentIp).then(info =>
          addIpInfo(info.ip, info.country, info.region, info.city, info.org)
        )
      }

      lastCandidateType = candidate.type
      return Reflect.apply(target, thisArg, args)
    },
  }

  /** Update the IP display when connections are closed */
  const closeHandler: ProxyHandler<
    typeof RTCPeerConnection['prototype']['close']
  > = {
    apply(target, thisArg: RTCPeerConnection, args) {
      // if (currentIp !== 'Not Found') {
      //   currentIp = `Not Found (Last: ${currentIp})`
      //   currentIp = 'Not Found'
      // }
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
