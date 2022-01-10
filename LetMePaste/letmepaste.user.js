// ==UserScript==
// @name        letmepaste
// @description Enables pasting on input boxes where it was disabled.
// @version     0.1.0
// @author      Adam Thompson-Sharpe
// @license     GPL-3.0
// @match       <all_urls>
// @grant       none
// ==/UserScript==
;(() => {
  /**
   * List of inputs with changed event handlers
   * @type {HTMLInputElement[]}
   */
  const fixedInputs = []

  const handler = e => {
    e.stopPropagation()
    return true
  }

  /**
   * Add event listeners to inputs
   *
   * @param inputs {NodeListOf<ChildNode>} Input elements to update
   */
  const fixInputs = inputs => {
    /** @param e {Event} */
    const handler = e => {
      e.stopPropagation()
      return true
    }

    inputs.forEach(el => {
      if (!fixedInputs.includes(el)) {
        el.oncopy = handler
        el.oncut = handler
        el.onpaste = handler
        fixedInputs.push(el)
      }
    })
  }

  const observer = new MutationObserver(mutations => {
    for (const mutation of mutations) {
      fixInputs(mutation.target.querySelectorAll('input'))
    }
  })

  observer.observe(document.body, {
    childList: true,
    subtree: true,
  })
})()
