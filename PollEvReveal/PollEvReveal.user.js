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
        const removedEl = Array.from(mutation.removedNodes).find(
          el => el.className === 'component-response-qa__result'
        )
        console.log(removedEl)
        if (removedEl) mutation.target.appendChild(removedEl)

        // Unhide participants
        mutation.target
          .querySelectorAll('.component-response-qa__result__participant')
          .forEach(el => (el.hidden = false))
      }
    }
  })

  let answersExist = false

  /** Wait until the answers element exists before trying to observe it */
  const answersPoll = () =>
    setInterval(() => {
      /** Element containing everybody's answers */
      const answers = document.querySelector('.component-list')
      if (answers && !answersExist) {
        // Unhide existing participants if there are any
        showParticipants(document.body)
        // Disable new/top buttons (cause an infinite loop with the MutationObserver)
        document
          .querySelectorAll('input[name=sort76]')
          .forEach(el => (el.disabled = true))
        // Observer answers
        observer.observe(answers, { childList: true, subtree: true })
        answersExist = true
      } else {
        answersExist = false
      }
    }, 1000)

  answersPoll()
})()
