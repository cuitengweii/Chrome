const XAC_STORAGE_KEYS = Object.freeze({
  language: "xac.language",
  sparkSettings: "xac.sparkSettings",
  googleSession: "xac.googleSession",
  authOverrides: "xac.authOverrides",
  profiles: "xac.profiles",
  activeProfileId: "xac.activeProfileId",
  quickSettings: "xac.quickSettings"
})

const XAC_DEFAULT_AUTH_CONFIG = Object.freeze({
  provider: "google",
  storageKey: "gasgx-main-auth",
  signInUrl: "/account/user.html",
  accountUrl: "/account/account.html",
  signOutRedirectUrl: "/account/user.html",
  returnUrlStorageKey: "gx_main_return_url",
  supabaseUrl: "https://mkpcliytqudclkwtewru.supabase.co",
  supabaseKey: "",
  providerRollout: {
    twitter: false,
    linkedin: false
  }
})

const XAC_DEFAULT_SPARK_SETTINGS = Object.freeze({
  enabled: true,
  url: "",
  app_id: "",
  api_key: "",
  api_secret: "",
  domain: "generalv3.5",
  temperature: 0.3,
  max_tokens: 512
})

const XAC_DEFAULT_PROFILES = Object.freeze([
  {
    id: "preset_growth",
    name: "Growth Hacker",
    emoji: "🚀",
    tone: "bold and data-driven",
    goal: "engagement",
    length: "short",
    instructions: "Use one concrete insight and end with a thought-provoking line.",
    persona: "I build growth systems for creator products.",
    language: "en",
    preset: true
  },
  {
    id: "preset_authority",
    name: "Authority Mode",
    emoji: "🎯",
    tone: "authoritative and precise",
    goal: "authority",
    length: "medium",
    instructions: "Use a strong framing sentence and one practical takeaway.",
    persona: "I focus on strategic analysis and market positioning.",
    language: "en",
    preset: true
  },
  {
    id: "preset_friendly",
    name: "Friendly Builder",
    emoji: "🤝",
    tone: "warm and approachable",
    goal: "networking",
    length: "short",
    instructions: "Be supportive, specific, and easy to respond to.",
    persona: "I collaborate with founders and operators in public.",
    language: "en",
    preset: true
  }
])

const XAC_DEFAULT_QUICK_SETTINGS = Object.freeze({
  engagementMode: "safe",
  goal: "engagement",
  length: "short",
  customInstructions: "",
  persona: ""
})

let xacConfigCachePromise = null

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value)
}

function toStringValue(value, fallback = "") {
  if (typeof value === "string") {
    const trimmed = value.trim()
    return trimmed || fallback
  }
  return fallback
}

function toBoolean(value, fallback = false) {
  if (typeof value === "boolean") return value
  if (typeof value === "number") return value !== 0
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase()
    if (["1", "true", "yes", "y", "on"].includes(normalized)) return true
    if (["0", "false", "no", "n", "off"].includes(normalized)) return false
  }
  return fallback
}

function toNumber(value, fallback) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value))
}

function maskSecret(value, left = 3, right = 2) {
  const text = toStringValue(value)
  if (!text) return ""
  if (text.length <= left + right) return "*".repeat(text.length)
  return `${text.slice(0, left)}${"*".repeat(Math.max(4, text.length - left - right))}${text.slice(-right)}`
}

function safeErrorMessage(error) {
  if (!error) return "Unknown error"
  if (typeof error === "string") return error
  if (error && typeof error.message === "string") return error.message
  try {
    return JSON.stringify(error)
  } catch (_ignored) {
    return String(error)
  }
}

function storageGet(keys) {
  return new Promise((resolve, reject) => {
    chrome.storage.local.get(keys, (items) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message))
        return
      }
      resolve(items || {})
    })
  })
}

function storageSet(items) {
  return new Promise((resolve, reject) => {
    chrome.storage.local.set(items, () => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message))
        return
      }
      resolve()
    })
  })
}

function storageRemove(keys) {
  return new Promise((resolve, reject) => {
    chrome.storage.local.remove(keys, () => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message))
        return
      }
      resolve()
    })
  })
}

function createPublicAuthConfig(authConfig) {
  return {
    ...authConfig,
    supabaseKey: maskSecret(authConfig.supabaseKey)
  }
}

function createPublicSparkSettings(sparkSettings) {
  return {
    ...sparkSettings,
    api_key: maskSecret(sparkSettings.api_key),
    api_secret: maskSecret(sparkSettings.api_secret),
    app_id: maskSecret(sparkSettings.app_id)
  }
}

async function readPackagedJson(relativePath) {
  try {
    const target = chrome.runtime.getURL(relativePath)
    const response = await fetch(target)
    if (!response.ok) {
      return {}
    }
    return await response.json()
  } catch (_error) {
    return {}
  }
}

function normalizeAuthConfig(input, fallback = XAC_DEFAULT_AUTH_CONFIG) {
  const base = {
    ...fallback,
    providerRollout: {
      twitter: Boolean(fallback?.providerRollout?.twitter),
      linkedin: Boolean(fallback?.providerRollout?.linkedin)
    }
  }

  if (!isPlainObject(input)) {
    return base
  }

  return {
    provider: toStringValue(input.provider, base.provider),
    storageKey: toStringValue(input.storageKey, base.storageKey),
    signInUrl: toStringValue(input.signInUrl, base.signInUrl),
    accountUrl: toStringValue(input.accountUrl, base.accountUrl),
    signOutRedirectUrl: toStringValue(input.signOutRedirectUrl, base.signOutRedirectUrl),
    returnUrlStorageKey: toStringValue(input.returnUrlStorageKey, base.returnUrlStorageKey),
    supabaseUrl: toStringValue(input.supabaseUrl, base.supabaseUrl),
    supabaseKey: toStringValue(input.supabaseKey, base.supabaseKey),
    providerRollout: {
      twitter: toBoolean(input?.providerRollout?.twitter, base.providerRollout.twitter),
      linkedin: toBoolean(input?.providerRollout?.linkedin, base.providerRollout.linkedin)
    }
  }
}

function normalizeSparkSettings(input, fallback = XAC_DEFAULT_SPARK_SETTINGS) {
  const base = {
    ...fallback
  }

  if (!isPlainObject(input)) {
    return base
  }

  return {
    enabled: toBoolean(input.enabled, base.enabled),
    url: toStringValue(input.url, base.url),
    app_id: toStringValue(input.app_id, base.app_id),
    api_key: toStringValue(input.api_key, base.api_key),
    api_secret: toStringValue(input.api_secret, base.api_secret),
    domain: toStringValue(input.domain, base.domain),
    temperature: clamp(toNumber(input.temperature, base.temperature), 0, 1),
    max_tokens: clamp(Math.round(toNumber(input.max_tokens, base.max_tokens)), 128, 4096)
  }
}

function normalizeProfile(input, fallbackProfile = XAC_DEFAULT_PROFILES[0]) {
  const base = isPlainObject(fallbackProfile) ? fallbackProfile : XAC_DEFAULT_PROFILES[0]
  const source = isPlainObject(input) ? input : {}
  const id = toStringValue(source.id, base.id)

  return {
    id,
    name: toStringValue(source.name, base.name),
    emoji: toStringValue(source.emoji, base.emoji),
    tone: toStringValue(source.tone, base.tone),
    goal: toStringValue(source.goal, base.goal),
    length: toStringValue(source.length, base.length),
    instructions: toStringValue(source.instructions, base.instructions),
    persona: toStringValue(source.persona, base.persona),
    language: toStringValue(source.language, base.language),
    preset: toBoolean(source.preset, base.preset === true)
  }
}

function mergeProfilesWithDefaults(rawProfiles) {
  const incoming = Array.isArray(rawProfiles) ? rawProfiles : []
  const normalizedIncoming = incoming
    .map((item) => normalizeProfile(item))
    .filter((item) => Boolean(item.id))

  const byId = new Map()
  XAC_DEFAULT_PROFILES.forEach((preset) => {
    byId.set(preset.id, normalizeProfile(preset, preset))
  })

  normalizedIncoming.forEach((profile) => {
    if (!byId.has(profile.id)) {
      byId.set(profile.id, profile)
    } else if (!profile.preset) {
      // allow overriding preset fields except id
      const preset = byId.get(profile.id)
      byId.set(profile.id, {
        ...preset,
        ...profile,
        preset: true
      })
    }
  })

  return Array.from(byId.values())
}

function normalizeQuickSettings(input, fallback = XAC_DEFAULT_QUICK_SETTINGS) {
  const base = isPlainObject(fallback) ? fallback : XAC_DEFAULT_QUICK_SETTINGS
  const source = isPlainObject(input) ? input : {}
  return {
    engagementMode: toStringValue(source.engagementMode, base.engagementMode),
    goal: toStringValue(source.goal, base.goal),
    length: toStringValue(source.length, base.length),
    customInstructions: toStringValue(source.customInstructions, base.customInstructions),
    persona: toStringValue(source.persona, base.persona)
  }
}

async function getProfileState() {
  const stored = await storageGet([
    XAC_STORAGE_KEYS.profiles,
    XAC_STORAGE_KEYS.activeProfileId,
    XAC_STORAGE_KEYS.quickSettings
  ])

  const profiles = mergeProfilesWithDefaults(stored[XAC_STORAGE_KEYS.profiles])
  const activeProfileIdRaw = toStringValue(stored[XAC_STORAGE_KEYS.activeProfileId], "")
  const activeProfileId = profiles.some((profile) => profile.id === activeProfileIdRaw)
    ? activeProfileIdRaw
    : profiles[0].id

  const activeProfile = profiles.find((profile) => profile.id === activeProfileId) || profiles[0]
  const quickSettings = normalizeQuickSettings(stored[XAC_STORAGE_KEYS.quickSettings], {
    ...XAC_DEFAULT_QUICK_SETTINGS,
    goal: activeProfile.goal || XAC_DEFAULT_QUICK_SETTINGS.goal,
    length: activeProfile.length || XAC_DEFAULT_QUICK_SETTINGS.length,
    persona: activeProfile.persona || XAC_DEFAULT_QUICK_SETTINGS.persona,
    customInstructions: activeProfile.instructions || XAC_DEFAULT_QUICK_SETTINGS.customInstructions
  })

  return {
    profiles,
    activeProfileId,
    quickSettings
  }
}

async function setProfileState(payload) {
  const current = await getProfileState()
  const source = isPlainObject(payload) ? payload : {}

  const profiles = mergeProfilesWithDefaults(source.profiles || current.profiles)
  const activeProfileIdRaw = toStringValue(source.activeProfileId, current.activeProfileId)
  const activeProfileId = profiles.some((profile) => profile.id === activeProfileIdRaw)
    ? activeProfileIdRaw
    : current.activeProfileId
  const activeProfile = profiles.find((profile) => profile.id === activeProfileId) || profiles[0]

  const quickSettings = normalizeQuickSettings(source.quickSettings, {
    ...current.quickSettings,
    goal: activeProfile.goal || current.quickSettings.goal,
    length: activeProfile.length || current.quickSettings.length
  })

  await storageSet({
    [XAC_STORAGE_KEYS.profiles]: profiles,
    [XAC_STORAGE_KEYS.activeProfileId]: activeProfileId,
    [XAC_STORAGE_KEYS.quickSettings]: quickSettings
  })

  return {
    profiles,
    activeProfileId,
    quickSettings
  }
}

async function getPackagedConfig() {
  if (!xacConfigCachePromise) {
    xacConfigCachePromise = Promise.all([
      readPackagedJson("config/auth.gasgx.json"),
      readPackagedJson("config/spark.gasgx.json")
    ]).then(([authPayload, sparkPayload]) => {
      const auth = normalizeAuthConfig(authPayload?.auth, XAC_DEFAULT_AUTH_CONFIG)
      const spark = normalizeSparkSettings(sparkPayload?.settings, XAC_DEFAULT_SPARK_SETTINGS)
      return { auth, spark }
    })
  }
  return xacConfigCachePromise
}

async function getLanguage() {
  const saved = await storageGet([XAC_STORAGE_KEYS.language])
  const raw = toStringValue(saved[XAC_STORAGE_KEYS.language], "")
  if (raw.toLowerCase().startsWith("zh")) return "zh"
  if (raw.toLowerCase().startsWith("en")) return "en"
  const preferred = (chrome.i18n.getUILanguage() || "en").toLowerCase()
  return preferred.startsWith("zh") ? "zh" : "en"
}

async function setLanguage(language) {
  const normalized = String(language || "").toLowerCase().startsWith("zh") ? "zh" : "en"
  await storageSet({ [XAC_STORAGE_KEYS.language]: normalized })
  return normalized
}

async function getAuthConfig() {
  const packaged = await getPackagedConfig()
  const stored = await storageGet([XAC_STORAGE_KEYS.authOverrides])
  return normalizeAuthConfig(stored[XAC_STORAGE_KEYS.authOverrides], packaged.auth)
}

async function setAuthOverrides(overrides) {
  const current = await getAuthConfig()
  const next = normalizeAuthConfig(overrides, current)
  await storageSet({ [XAC_STORAGE_KEYS.authOverrides]: next })
  return next
}

async function getSparkSettings() {
  const packaged = await getPackagedConfig()
  const stored = await storageGet([XAC_STORAGE_KEYS.sparkSettings])
  return normalizeSparkSettings(stored[XAC_STORAGE_KEYS.sparkSettings], packaged.spark)
}

async function setSparkSettings(settings) {
  const current = await getSparkSettings()
  const next = normalizeSparkSettings(settings, current)
  await storageSet({ [XAC_STORAGE_KEYS.sparkSettings]: next })
  return next
}

async function getGoogleSession() {
  const stored = await storageGet([XAC_STORAGE_KEYS.googleSession])
  const session = stored[XAC_STORAGE_KEYS.googleSession]
  if (!isPlainObject(session)) {
    return null
  }
  return session
}

function parseAuthCallbackUrl(callbackUrl) {
  const parsed = new URL(callbackUrl)
  const hash = parsed.hash.startsWith("#") ? parsed.hash.slice(1) : parsed.hash
  const query = parsed.search.startsWith("?") ? parsed.search.slice(1) : parsed.search
  const params = new URLSearchParams(hash || query)

  const error = params.get("error_description") || params.get("error")
  if (error) {
    throw new Error(error)
  }

  const accessToken = params.get("access_token")
  if (!accessToken) {
    throw new Error("No access token found in Google callback.")
  }

  return {
    accessToken,
    refreshToken: params.get("refresh_token") || "",
    tokenType: params.get("token_type") || "bearer",
    expiresIn: Math.max(60, Math.round(toNumber(params.get("expires_in"), 3600)))
  }
}

function launchWebAuthFlow(url, interactive = true) {
  return new Promise((resolve, reject) => {
    chrome.identity.launchWebAuthFlow({ url, interactive }, (callbackUrl) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message))
        return
      }
      if (!callbackUrl) {
        reject(new Error("Empty callback URL from launchWebAuthFlow."))
        return
      }
      resolve(callbackUrl)
    })
  })
}

function buildSupabaseGoogleUrl(authConfig, redirectTo) {
  const endpoint = new URL("/auth/v1/authorize", authConfig.supabaseUrl)
  endpoint.searchParams.set("provider", "google")
  endpoint.searchParams.set("redirect_to", redirectTo)
  endpoint.searchParams.set("response_type", "token")
  endpoint.searchParams.set("scopes", "openid email profile")
  return endpoint.toString()
}

async function fetchSupabaseUser(authConfig, accessToken) {
  const endpoint = new URL("/auth/v1/user", authConfig.supabaseUrl)
  const response = await fetch(endpoint.toString(), {
    method: "GET",
    headers: {
      apikey: authConfig.supabaseKey,
      Authorization: `Bearer ${accessToken}`
    }
  })

  if (!response.ok) {
    const body = await response.text()
    throw new Error(`Failed to load user profile: ${response.status} ${body}`)
  }

  return await response.json()
}

async function signInWithGoogle() {
  const authConfig = await getAuthConfig()
  if (!authConfig.supabaseUrl || !authConfig.supabaseKey) {
    throw new Error("Supabase auth config is incomplete. Please check GasGx auth settings.")
  }

  const redirectTo = chrome.identity.getRedirectURL("xac-google")
  const authUrl = buildSupabaseGoogleUrl(authConfig, redirectTo)
  const callbackUrl = await launchWebAuthFlow(authUrl, true)
  const tokens = parseAuthCallbackUrl(callbackUrl)
  const profile = await fetchSupabaseUser(authConfig, tokens.accessToken)

  const session = {
    provider: "google",
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
    tokenType: tokens.tokenType,
    expiresIn: tokens.expiresIn,
    expiresAt: Date.now() + tokens.expiresIn * 1000,
    user: profile,
    signedInAt: new Date().toISOString()
  }

  await storageSet({ [XAC_STORAGE_KEYS.googleSession]: session })
  return session
}

async function signOutGoogle() {
  const authConfig = await getAuthConfig()
  const session = await getGoogleSession()

  if (session?.accessToken && authConfig.supabaseUrl && authConfig.supabaseKey) {
    try {
      const endpoint = new URL("/auth/v1/logout", authConfig.supabaseUrl)
      await fetch(endpoint.toString(), {
        method: "POST",
        headers: {
          apikey: authConfig.supabaseKey,
          Authorization: `Bearer ${session.accessToken}`
        }
      })
    } catch (_error) {
      // ignore remote logout errors and clear local state
    }
  }

  await storageRemove([XAC_STORAGE_KEYS.googleSession])
  return true
}

function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer)
  let binary = ""
  const chunk = 0x8000
  for (let index = 0; index < bytes.length; index += chunk) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunk))
  }
  return btoa(binary)
}

async function hmacSha256Base64(secret, text) {
  const encoder = new TextEncoder()
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  )
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(text))
  return arrayBufferToBase64(signature)
}

async function createSparkAuthorizedUrl(settings) {
  const endpoint = new URL(settings.url)
  const host = endpoint.host
  const path = endpoint.pathname || "/"
  const date = new Date().toUTCString()
  const signatureOrigin = `host: ${host}\ndate: ${date}\nGET ${path} HTTP/1.1`
  const signatureBase64 = await hmacSha256Base64(settings.api_secret, signatureOrigin)
  const authorizationOrigin = `api_key="${settings.api_key}", algorithm="hmac-sha256", headers="host date request-line", signature="${signatureBase64}"`
  const authorization = btoa(authorizationOrigin)

  endpoint.searchParams.set("authorization", authorization)
  endpoint.searchParams.set("date", date)
  endpoint.searchParams.set("host", host)

  return endpoint.toString()
}

function buildSparkPayload(settings, requestPayload) {
  const messageList = []

  if (Array.isArray(requestPayload.messages) && requestPayload.messages.length > 0) {
    requestPayload.messages.forEach((item) => {
      if (!isPlainObject(item)) return
      const role = toStringValue(item.role, "user")
      const content = toStringValue(item.content, "")
      if (content) {
        messageList.push({ role, content })
      }
    })
  }

  if (messageList.length === 0) {
    const systemPrompt = toStringValue(requestPayload.systemPrompt, "")
    const prompt = toStringValue(requestPayload.prompt, "")
    if (systemPrompt) {
      messageList.push({ role: "system", content: systemPrompt })
    }
    messageList.push({ role: "user", content: prompt })
  }

  if (messageList.length === 0) {
    throw new Error("Spark prompt is empty.")
  }

  return {
    header: {
      app_id: settings.app_id,
      uid: crypto.randomUUID ? crypto.randomUUID() : "xac-spark"
    },
    parameter: {
      chat: {
        domain: settings.domain,
        temperature: settings.temperature,
        max_tokens: settings.max_tokens
      }
    },
    payload: {
      message: {
        text: messageList
      }
    }
  }
}

async function callSparkModel(requestPayload) {
  const storedSettings = await getSparkSettings()
  const mergedSettings = normalizeSparkSettings(requestPayload.settings, storedSettings)

  if (!mergedSettings.enabled) {
    throw new Error("Spark model is disabled in settings.")
  }

  const requiredFields = ["url", "app_id", "api_key", "api_secret"]
  const missing = requiredFields.filter((field) => !toStringValue(mergedSettings[field], ""))
  if (missing.length > 0) {
    throw new Error(`Spark settings missing required fields: ${missing.join(", ")}`)
  }

  const websocketUrl = await createSparkAuthorizedUrl(mergedSettings)
  const payload = buildSparkPayload(mergedSettings, requestPayload)
  const timeoutMs = Math.max(5000, Math.round(toNumber(requestPayload.timeoutMs, 30000)))

  return new Promise((resolve, reject) => {
    let ws = null
    let done = false
    let output = ""

    const finish = (handler, value) => {
      if (done) return
      done = true
      clearTimeout(timer)
      try {
        if (ws && ws.readyState === WebSocket.OPEN) {
          ws.close(1000, "completed")
        }
      } catch (_ignored) {
        // ignore close errors
      }
      handler(value)
    }

    const timer = setTimeout(() => {
      finish(reject, new Error("Spark request timed out."))
    }, timeoutMs)

    try {
      ws = new WebSocket(websocketUrl)
    } catch (error) {
      finish(reject, error)
      return
    }

    ws.onopen = () => {
      ws.send(JSON.stringify(payload))
    }

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(String(event.data || "{}"))
        const headerCode = Number(data?.header?.code || 0)
        if (headerCode !== 0) {
          const headerMessage = toStringValue(data?.header?.message, `Spark error code ${headerCode}`)
          finish(reject, new Error(headerMessage))
          return
        }

        const textList = data?.payload?.choices?.text
        if (Array.isArray(textList) && textList.length > 0) {
          output += String(textList[0]?.content || "")
        }

        const status = Number(data?.payload?.choices?.status ?? 2)
        if (status === 2) {
          finish(resolve, output.trim())
        }
      } catch (error) {
        finish(reject, error)
      }
    }

    ws.onerror = () => {
      finish(reject, new Error("Spark websocket connection failed."))
    }

    ws.onclose = (event) => {
      if (done) return
      if (output.trim()) {
        finish(resolve, output.trim())
      } else {
        finish(reject, new Error(`Spark websocket closed: code=${event.code}`))
      }
    }
  })
}

async function getStateSnapshot() {
  const [language, sparkSettings, authConfig, googleSession, profileState] = await Promise.all([
    getLanguage(),
    getSparkSettings(),
    getAuthConfig(),
    getGoogleSession(),
    getProfileState()
  ])

  return {
    language,
    sparkSettings: createPublicSparkSettings(sparkSettings),
    authConfig: createPublicAuthConfig(authConfig),
    googleSession,
    profileState
  }
}

function success(payload = {}) {
  return { ok: true, ...payload }
}

function failure(error) {
  return { ok: false, error: safeErrorMessage(error) }
}

async function handleXacMessage(message) {
  switch (message.xacAction) {
    case "xac:get-state": {
      return success({ state: await getStateSnapshot() })
    }
    case "xac:get-language": {
      return success({ language: await getLanguage() })
    }
    case "xac:set-language": {
      const language = await setLanguage(message.language)
      return success({ language })
    }
    case "xac:get-auth-config": {
      const authConfig = await getAuthConfig()
      return success({ authConfig: createPublicAuthConfig(authConfig) })
    }
    case "xac:set-auth-overrides": {
      const authConfig = await setAuthOverrides(message.authConfig || {})
      return success({ authConfig: createPublicAuthConfig(authConfig) })
    }
    case "xac:get-google-session": {
      return success({ googleSession: await getGoogleSession() })
    }
    case "xac:google-sign-in": {
      const googleSession = await signInWithGoogle()
      return success({ googleSession })
    }
    case "xac:google-sign-out": {
      await signOutGoogle()
      return success({ signedOut: true })
    }
    case "xac:get-spark-settings": {
      const sparkSettings = await getSparkSettings()
      return success({ sparkSettings: createPublicSparkSettings(sparkSettings) })
    }
    case "xac:get-profile-state": {
      const profileState = await getProfileState()
      return success({ profileState })
    }
    case "xac:set-profile-state": {
      const profileState = await setProfileState(message.profileState || message.state || {})
      return success({ profileState })
    }
    case "xac:set-spark-settings": {
      const sparkSettings = await setSparkSettings(message.settings || {})
      return success({ sparkSettings: createPublicSparkSettings(sparkSettings) })
    }
    case "xac:spark-complete": {
      const text = await callSparkModel({
        prompt: message.prompt,
        systemPrompt: message.systemPrompt,
        messages: message.messages,
        settings: message.settings,
        timeoutMs: message.timeoutMs
      })
      return success({ text })
    }
    default:
      return failure(`Unsupported xacAction: ${message.xacAction}`)
  }
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (!message || !message.xacAction) {
    return undefined
  }

  handleXacMessage(message)
    .then((result) => sendResponse(result))
    .catch((error) => sendResponse(failure(error)))

  return true
})
