// ==UserScript==
// @name        eNotes Answer Reveal
// @description Show full answers on eNotes
// @version     0.1.0
// @author      Adam Thompson-Sharpe
// @namespace   MysteryBlokHed
// @license     GPL-3.0
// @copyright   2022 Adam Thomspon-Sharpe
// @match       *://*.enotes.com/*
// @grant       none
// ==/UserScript==
;(() => {
  // Remove blur
  document
    .querySelectorAll('div[class*=answer__body] > div:last-child')
    .forEach(el => (el.className = ''))
  // Remove paywall notice
  document.querySelector('#enotes-paywall').remove()
})()
