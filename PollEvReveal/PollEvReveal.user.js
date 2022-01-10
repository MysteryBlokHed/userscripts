// ==UserScript==
// @name        Poll Everywhere (pollev.com) Deanonymizer
// @description Show the names of people who submitted answers on Poll Everywhere
// @version     0.1.0
// @author      Adam Thompson-Sharpe
// @license     GPL-3.0
// @match       *://*.pollev.com/*
// ==/UserScript==
;(() => {
  /**
   * Show all participant elements on an element
   * @param {HTMLElement} el
   */
  const showParticipants = el =>
    el
      .querySelectorAll('.component-response-qa__result__participant')
      .forEach(el => (el.hidden = false))

  /** Observe the answers element for changes */
  const observer = new MutationObserver(mutationsList => {
    for (const mutation of mutationsList) {
      console.log(mutation)
      if (mutation.type === 'childList') {
        // If the participant element was removed, add it back
        const removed = Array.from(mutation.removedNodes)
        if (
          removed.length &&
          removed.some(el => el.className === 'component-response-qa__result')
        ) {
          mutation.target.appendChild(removed[0])
        }

        // Unhide participants
        mutation.target
          .querySelectorAll('.component-response-qa__result__participant')
          .forEach(el => (el.hidden = false))
      }
    }
  })

  // Wait until the answers element exists before trying to observe it
  const answersPoll = setInterval(() => {
    /** Element containing everybody's answers */
    const answers = document.querySelector('.component-list')
    if (answers) {
      showParticipants(document.body)
      observer.observe(answers, { childList: true, subtree: true })
      clearInterval(answersPoll)
    }
  }, 1000)
})()
