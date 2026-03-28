/* global importScripts, chrome, self */

(() => {
  const NO_RECEIVER_ERROR = "Could not establish connection. Receiving end does not exist."

  // Some legacy bundle paths call tabs.sendMessage on pages where no content script is injected.
  // In MV3 this can surface as an unhandled promise rejection in the service worker.
  self.addEventListener("unhandledrejection", (event) => {
    const text = String(event?.reason?.message || event?.reason || "")
    if (text.includes(NO_RECEIVER_ERROR)) {
      event.preventDefault()
    }
  })

  try {
    const rawSendMessage = chrome?.tabs?.sendMessage?.bind(chrome.tabs)
    if (typeof rawSendMessage === "function") {
      chrome.tabs.sendMessage = (...args) => {
        try {
          const result = rawSendMessage(...args)
          if (result && typeof result.catch === "function") {
            return result.catch((error) => {
              const text = String(error?.message || error || "")
              if (text.includes(NO_RECEIVER_ERROR)) {
                return undefined
              }
              throw error
            })
          }
          return result
        } catch (error) {
          const text = String(error?.message || error || "")
          if (text.includes(NO_RECEIVER_ERROR)) {
            return Promise.resolve(undefined)
          }
          throw error
        }
      }
    }
  } catch (_ignored) {
    // If the API object is not patchable in a given runtime, keep default behavior.
  }
})()

// Load only the custom XAC background logic to avoid legacy GM/ReplyX handlers.
importScripts("xac-background.js")
