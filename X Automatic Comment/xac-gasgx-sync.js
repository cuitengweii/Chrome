(() => {
  if (window.__xacGasgxSyncLoaded) return
  window.__xacGasgxSyncLoaded = true

  const DEFAULT_STORAGE_KEY = "gasgx-main-auth"
  let storageKey = DEFAULT_STORAGE_KEY
  let lastFingerprint = ""

  const toStringValue = (value, fallback = "") => {
    if (typeof value === "string") {
      const trimmed = value.trim()
      return trimmed || fallback
    }
    return fallback
  }

  const toNumberValue = (value, fallback = 0) => {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : fallback
  }

  const isPlainObject = (value) => Boolean(value) && typeof value === "object" && !Array.isArray(value)

  const send = (action, payload = {}) =>
    new Promise((resolve) => {
      try {
        chrome.runtime.sendMessage({ xacAction: action, ...payload }, (response) => {
          if (chrome.runtime.lastError) {
            resolve({ ok: false, error: chrome.runtime.lastError.message })
            return
          }
          resolve(response || { ok: false, error: "No response" })
        })
      } catch (error) {
        resolve({ ok: false, error: String(error) })
      }
    })

  function normalizeCandidate(source) {
    if (!isPlainObject(source)) return null

    const session = isPlainObject(source.currentSession)
      ? source.currentSession
      : isPlainObject(source.session)
        ? source.session
        : source

    const accessToken = toStringValue(session.access_token ?? session.accessToken, "")
    if (!accessToken) return null

    const refreshToken = toStringValue(session.refresh_token ?? session.refreshToken, "")
    const tokenType = toStringValue(session.token_type ?? session.tokenType, "bearer")
    const expiresIn = Math.max(60, Math.round(toNumberValue(session.expires_in ?? session.expiresIn, 3600)))

    let expiresAt = toNumberValue(session.expires_at ?? session.expiresAt, 0)
    if (expiresAt > 0 && expiresAt < 10000000000) {
      expiresAt = expiresAt * 1000
    }

    return {
      provider: "google",
      accessToken,
      refreshToken,
      tokenType,
      expiresIn,
      expiresAt,
      user: isPlainObject(session.user) ? session.user : isPlainObject(source.user) ? source.user : null,
      signedInAt: new Date().toISOString()
    }
  }

  function parseSessionFromUrl() {
    const hash = window.location.hash.startsWith("#") ? window.location.hash.slice(1) : window.location.hash
    const query = window.location.search.startsWith("?") ? window.location.search.slice(1) : window.location.search
    const params = new URLSearchParams(hash || query)
    const accessToken = toStringValue(params.get("access_token"), "")
    if (!accessToken) return null

    return {
      provider: "google",
      accessToken,
      refreshToken: toStringValue(params.get("refresh_token"), ""),
      tokenType: toStringValue(params.get("token_type"), "bearer"),
      expiresIn: Math.max(60, Math.round(toNumberValue(params.get("expires_in"), 3600))),
      expiresAt: 0,
      user: null,
      signedInAt: new Date().toISOString()
    }
  }

  function parseSessionFromStorage() {
    let raw = ""
    try {
      raw = toStringValue(window.localStorage.getItem(storageKey), "")
    } catch (_error) {
      return null
    }

    if (!raw) return null

    try {
      const parsed = JSON.parse(raw)
      return normalizeCandidate(parsed)
    } catch (_error) {
      return null
    }
  }

  async function syncCandidate(candidate, source) {
    if (!candidate || !candidate.accessToken) return false

    const fingerprint = `${candidate.accessToken.slice(0, 24)}:${candidate.expiresAt || candidate.expiresIn || 0}`
    if (fingerprint === lastFingerprint) return true

    const result = await send("xac:sync-google-session", {
      session: candidate,
      source,
      pageUrl: window.location.href
    })

    if (result.ok && result.googleSession && result.googleSession.accessToken) {
      lastFingerprint = fingerprint
      return true
    }

    return false
  }

  async function refreshStorageKey() {
    const result = await send("xac:get-auth-config")
    if (result.ok && result.authConfig) {
      storageKey = toStringValue(result.authConfig.storageKey, DEFAULT_STORAGE_KEY)
    }
  }

  async function syncNow(source) {
    const fromUrl = parseSessionFromUrl()
    const fromStorage = parseSessionFromStorage()
    if (fromUrl) {
      await syncCandidate(fromUrl, `${source}:url`)
    }
    if (fromStorage) {
      await syncCandidate(fromStorage, `${source}:storage`)
    }
  }

  async function init() {
    await refreshStorageKey()
    await syncNow("init")

    window.addEventListener("storage", (event) => {
      if (!event.key || event.key === storageKey) {
        void syncNow("storage-event")
      }
    })

    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") {
        void syncNow("visibility")
      }
    })

    let rounds = 0
    const timer = window.setInterval(() => {
      rounds += 1
      void syncNow("poll")
      if (rounds >= 60) {
        window.clearInterval(timer)
      }
    }, 2000)
  }

  void init()
})()
