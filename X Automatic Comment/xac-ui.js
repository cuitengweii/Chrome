(() => {
  if (window.__xacUiLoaded) {
    return
  }
  window.__xacUiLoaded = true

  const I18N = {
    en: {
      panelTitle: "X Automatic Comment",
      panelSubTitle: "Dark + Green Custom Layer",
      toggleOpen: "Open",
      toggleClose: "Close",
      language: "Language",
      authState: "Google Login",
      loggedIn: "Logged in",
      loggedOut: "Logged out",
      loginGoogle: "Login with Google",
      logout: "Logout",
      supabase: "GasGx Supabase",
      sparkTitle: "Spark Model",
      sparkHint: "Settings are aligned with D:\\code\\Python\\Collection\\gasgx\\gasgx_article_content_collection_module",
      sparkSection: "Spark Settings",
      sparkUrl: "Spark URL",
      sparkAppId: "App ID",
      sparkApiKey: "API Key",
      sparkApiSecret: "API Secret",
      sparkDomain: "Domain",
      sparkTemp: "Temperature",
      sparkTokens: "Max Tokens",
      saveSpark: "Save Spark Settings",
      saveSparkTip: "Leave secret fields empty to keep existing values.",
      promptLabel: "Prompt",
      promptPlaceholder: "Write the comment style or reply intent here...",
      generate: "Generate with Spark",
      output: "Output",
      outputPlaceholder: "Spark result will appear here.",
      copyOutput: "Copy Output",
      loginRequired: "Google login may be required before calling external services.",
      footer: "1:1 clone kept. This panel is a compatibility enhancement layer.",
      busy: "Working...",
      saved: "Saved",
      copied: "Copied",
      failed: "Failed"
    },
    zh: {
      panelTitle: "X Automatic Comment",
      panelSubTitle: "暗黑 + 绿色增强层",
      toggleOpen: "展开",
      toggleClose: "收起",
      language: "语言",
      authState: "Google 登录",
      loggedIn: "已登录",
      loggedOut: "未登录",
      loginGoogle: "Google 登录",
      logout: "退出登录",
      supabase: "GasGx Supabase",
      sparkTitle: "星火模型",
      sparkHint: "配置已对齐 D:\\code\\Python\\Collection\\gasgx\\gasgx_article_content_collection_module",
      sparkSection: "星火配置",
      sparkUrl: "星火 URL",
      sparkAppId: "App ID",
      sparkApiKey: "API Key",
      sparkApiSecret: "API Secret",
      sparkDomain: "Domain",
      sparkTemp: "温度",
      sparkTokens: "最大 Tokens",
      saveSpark: "保存星火配置",
      saveSparkTip: "密钥字段留空即可保持现有值。",
      promptLabel: "提示词",
      promptPlaceholder: "输入评论风格或回复意图...",
      generate: "用星火生成",
      output: "输出",
      outputPlaceholder: "星火生成结果将显示在这里。",
      copyOutput: "复制输出",
      loginRequired: "调用外部服务前建议先完成 Google 登录。",
      footer: "已保留 1:1 克隆，本面板是兼容增强层。",
      busy: "处理中...",
      saved: "已保存",
      copied: "已复制",
      failed: "失败"
    }
  }

  const TEXT_REPLACE = {
    zh: {
      "Start": "开始",
      "Stop": "停止",
      "Settings": "设置",
      "Save": "保存",
      "Search": "搜索",
      "Login": "登录",
      "Logout": "退出",
      "Account": "账号",
      "Language": "语言",
      "English": "英文",
      "Chinese": "中文",
      "Schedule": "计划",
      "Activity": "活动",
      "Pro": "专业版",
      "Generate": "生成",
      "Copy": "复制"
    },
    en: {
      "开始": "Start",
      "停止": "Stop",
      "设置": "Settings",
      "保存": "Save",
      "搜索": "Search",
      "登录": "Login",
      "退出": "Logout",
      "账号": "Account",
      "语言": "Language",
      "中文": "Chinese",
      "英文": "English",
      "计划": "Schedule",
      "活动": "Activity",
      "专业版": "Pro",
      "生成": "Generate",
      "复制": "Copy"
    }
  }

  const state = {
    lang: "en",
    open: false,
    notice: "",
    busy: false,
    googleSession: null,
    sparkPublic: null,
    authConfig: null,
    sparkDraft: {
      url: "",
      app_id: "",
      api_key: "",
      api_secret: "",
      domain: "generalv3.5",
      temperature: 0.3,
      max_tokens: 512
    },
    prompt: "",
    output: ""
  }

  function normalizeLang(value) {
    const raw = String(value || "").toLowerCase()
    if (raw.startsWith("zh")) return "zh"
    return "en"
  }

  function t(key) {
    return (I18N[state.lang] && I18N[state.lang][key]) || I18N.en[key] || key
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;")
  }

  function send(action, payload = {}) {
    return new Promise((resolve) => {
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
  }

  function setNotice(message) {
    state.notice = message
    render()
    if (message) {
      window.clearTimeout(setNotice._timer)
      setNotice._timer = window.setTimeout(() => {
        state.notice = ""
        render()
      }, 2600)
    }
  }

  function applyTheme() {
    document.documentElement.classList.add("xac-theme-dark")
    if (document.body) {
      document.body.classList.add("xac-theme-dark")
    }
  }

  function tryTranslateLooseText() {
    if (!document.body) return

    const replacement = TEXT_REPLACE[state.lang]
    if (!replacement) return

    const walker = document.createTreeWalker(
      document.body,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode(node) {
          if (!node || !node.nodeValue) return NodeFilter.FILTER_REJECT
          if (!node.nodeValue.trim()) return NodeFilter.FILTER_REJECT
          if (node.parentElement && node.parentElement.closest("#xac-widget")) {
            return NodeFilter.FILTER_REJECT
          }
          return NodeFilter.FILTER_ACCEPT
        }
      }
    )

    const nodes = []
    while (walker.nextNode()) {
      nodes.push(walker.currentNode)
    }

    nodes.forEach((node) => {
      const text = node.nodeValue
      const trimmed = text.trim()
      const mapped = replacement[trimmed]
      if (!mapped) return

      const leading = text.match(/^\s*/)?.[0] || ""
      const trailing = text.match(/\s*$/)?.[0] || ""
      node.nodeValue = `${leading}${mapped}${trailing}`
    })

    const attrs = ["placeholder", "title", "aria-label"]
    attrs.forEach((attr) => {
      document.querySelectorAll(`[${attr}]`).forEach((el) => {
        if (el.closest("#xac-widget")) return
        const value = el.getAttribute(attr)
        if (!value) return
        const mapped = replacement[value.trim()]
        if (mapped) {
          el.setAttribute(attr, mapped)
        }
      })
    })

    document.documentElement.lang = state.lang === "zh" ? "zh-CN" : "en"
  }

  function maskEmail(session) {
    const email =
      session?.user?.email ||
      session?.user?.user_metadata?.email ||
      session?.user?.identities?.[0]?.identity_data?.email ||
      ""
    if (!email) return "-"
    return email
  }

  function setSparkDraftFromPublic(publicSettings) {
    state.sparkPublic = publicSettings || null
    state.sparkDraft = {
      url: publicSettings?.url || "",
      app_id: "",
      api_key: "",
      api_secret: "",
      domain: publicSettings?.domain || "generalv3.5",
      temperature: Number.isFinite(Number(publicSettings?.temperature)) ? Number(publicSettings.temperature) : 0.3,
      max_tokens: Number.isFinite(Number(publicSettings?.max_tokens)) ? Number(publicSettings.max_tokens) : 512
    }
  }

  function mount() {
    if (!document.body) return
    if (!document.getElementById("xac-widget")) {
      const root = document.createElement("div")
      root.id = "xac-widget"
      root.className = "xac-collapsed"
      document.body.appendChild(root)
    }
  }

  function render() {
    const root = document.getElementById("xac-widget")
    if (!root) return

    root.className = state.open ? "" : "xac-collapsed"

    const isLogged = Boolean(state.googleSession?.accessToken)
    const loginStatusClass = isLogged ? "xac-status-ok" : "xac-status-bad"
    const loginStatusText = isLogged ? t("loggedIn") : t("loggedOut")
    const email = maskEmail(state.googleSession)
    const supabaseHost = state.authConfig?.supabaseUrl ? new URL(state.authConfig.supabaseUrl).host : "-"

    root.innerHTML = `
      <div class="xac-shell">
        <button class="xac-toggle" id="xac-toggle" type="button">
          <span>${escapeHtml(t("panelTitle"))}</span>
          <span>${state.open ? escapeHtml(t("toggleClose")) : escapeHtml(t("toggleOpen"))}</span>
        </button>
        <div class="xac-panel">
          <div class="xac-meta">${escapeHtml(t("panelSubTitle"))}</div>

          <div class="xac-row">
            <span class="xac-label">${escapeHtml(t("language"))}</span>
            <div class="xac-pill-group">
              <button type="button" class="xac-pill ${state.lang === "en" ? "active" : ""}" data-lang="en">EN</button>
              <button type="button" class="xac-pill ${state.lang === "zh" ? "active" : ""}" data-lang="zh">中文</button>
            </div>
          </div>

          <div class="xac-meta">
            ${escapeHtml(t("authState"))}: <strong class="${loginStatusClass}">${escapeHtml(loginStatusText)}</strong>
          </div>
          <div class="xac-meta">${escapeHtml(email)}</div>

          <div class="xac-actions">
            <button type="button" class="xac-button primary" id="xac-login">${escapeHtml(t("loginGoogle"))}</button>
            <button type="button" class="xac-button danger" id="xac-logout">${escapeHtml(t("logout"))}</button>
          </div>

          <div class="xac-note">${escapeHtml(t("supabase"))}: ${escapeHtml(supabaseHost)}</div>
          <div class="xac-note">${escapeHtml(t("loginRequired"))}</div>

          <details>
            <summary>${escapeHtml(t("sparkSection"))}</summary>
            <div class="xac-panel" style="padding: 10px 0 0; gap: 8px;">
              <input class="xac-input" id="xac-spark-url" value="${escapeHtml(state.sparkDraft.url)}" placeholder="${escapeHtml(t("sparkUrl"))}" />
              <div class="xac-grid-2">
                <input class="xac-input" id="xac-spark-app-id" value="" placeholder="${escapeHtml(t("sparkAppId"))}" />
                <input class="xac-input" id="xac-spark-domain" value="${escapeHtml(state.sparkDraft.domain)}" placeholder="${escapeHtml(t("sparkDomain"))}" />
              </div>
              <div class="xac-grid-2">
                <input class="xac-input" id="xac-spark-api-key" value="" placeholder="${escapeHtml(t("sparkApiKey"))}" />
                <input class="xac-input" id="xac-spark-api-secret" value="" placeholder="${escapeHtml(t("sparkApiSecret"))}" />
              </div>
              <div class="xac-grid-2">
                <input class="xac-input" id="xac-spark-temp" value="${escapeHtml(String(state.sparkDraft.temperature))}" placeholder="${escapeHtml(t("sparkTemp"))}" />
                <input class="xac-input" id="xac-spark-max-tokens" value="${escapeHtml(String(state.sparkDraft.max_tokens))}" placeholder="${escapeHtml(t("sparkTokens"))}" />
              </div>
              <button type="button" class="xac-button" id="xac-save-spark">${escapeHtml(t("saveSpark"))}</button>
              <div class="xac-note">${escapeHtml(t("saveSparkTip"))}</div>
              <div class="xac-note">${escapeHtml(t("sparkHint"))}</div>
            </div>
          </details>

          <div class="xac-label">${escapeHtml(t("promptLabel"))}</div>
          <textarea class="xac-textarea" id="xac-prompt" placeholder="${escapeHtml(t("promptPlaceholder"))}">${escapeHtml(state.prompt)}</textarea>
          <button type="button" class="xac-button primary" id="xac-generate">${escapeHtml(state.busy ? t("busy") : t("generate"))}</button>

          <div class="xac-label">${escapeHtml(t("output"))}</div>
          <textarea class="xac-textarea" id="xac-output" placeholder="${escapeHtml(t("outputPlaceholder"))}" readonly>${escapeHtml(state.output)}</textarea>
          <button type="button" class="xac-button" id="xac-copy">${escapeHtml(t("copyOutput"))}</button>

          <div class="xac-footer">${escapeHtml(t("footer"))}</div>
          ${state.notice ? `<div class="xac-note">${escapeHtml(state.notice)}</div>` : ""}
        </div>
      </div>
    `

    bindEvents()
    tryTranslateLooseText()
  }

  function bindEvents() {
    const toggle = document.getElementById("xac-toggle")
    const loginBtn = document.getElementById("xac-login")
    const logoutBtn = document.getElementById("xac-logout")
    const saveSparkBtn = document.getElementById("xac-save-spark")
    const generateBtn = document.getElementById("xac-generate")
    const copyBtn = document.getElementById("xac-copy")
    const promptBox = document.getElementById("xac-prompt")

    if (toggle) {
      toggle.onclick = () => {
        state.open = !state.open
        render()
      }
    }

    document.querySelectorAll("#xac-widget [data-lang]").forEach((btn) => {
      btn.onclick = async () => {
        const lang = normalizeLang(btn.getAttribute("data-lang"))
        state.lang = lang
        await send("xac:set-language", { language: lang })
        render()
      }
    })

    if (promptBox) {
      promptBox.oninput = () => {
        state.prompt = promptBox.value
      }
    }

    if (loginBtn) {
      loginBtn.onclick = async () => {
        state.busy = true
        render()
        const result = await send("xac:google-sign-in")
        state.busy = false
        if (result.ok) {
          state.googleSession = result.googleSession || null
          setNotice(t("loggedIn"))
        } else {
          setNotice(`${t("failed")}: ${result.error || "-"}`)
        }
      }
    }

    if (logoutBtn) {
      logoutBtn.onclick = async () => {
        state.busy = true
        render()
        const result = await send("xac:google-sign-out")
        state.busy = false
        if (result.ok) {
          state.googleSession = null
          setNotice(t("loggedOut"))
        } else {
          setNotice(`${t("failed")}: ${result.error || "-"}`)
        }
      }
    }

    if (saveSparkBtn) {
      saveSparkBtn.onclick = async () => {
        const payload = {
          url: document.getElementById("xac-spark-url")?.value || "",
          app_id: document.getElementById("xac-spark-app-id")?.value || "",
          api_key: document.getElementById("xac-spark-api-key")?.value || "",
          api_secret: document.getElementById("xac-spark-api-secret")?.value || "",
          domain: document.getElementById("xac-spark-domain")?.value || "",
          temperature: document.getElementById("xac-spark-temp")?.value || "",
          max_tokens: document.getElementById("xac-spark-max-tokens")?.value || ""
        }

        const result = await send("xac:set-spark-settings", { settings: payload })
        if (result.ok) {
          state.sparkPublic = result.sparkSettings || state.sparkPublic
          setSparkDraftFromPublic(state.sparkPublic)
          setNotice(t("saved"))
        } else {
          setNotice(`${t("failed")}: ${result.error || "-"}`)
        }
      }
    }

    if (generateBtn) {
      generateBtn.onclick = async () => {
        const prompt = state.prompt || ""
        if (!prompt.trim()) {
          return
        }

        state.busy = true
        render()

        const result = await send("xac:spark-complete", {
          prompt,
          systemPrompt:
            state.lang === "zh"
              ? "你是X平台评论助手，请生成自然、简短、可直接发布的中文评论。"
              : "You are an X comment assistant. Generate natural, concise, post-ready English comments.",
          timeoutMs: 30000
        })

        state.busy = false
        if (result.ok) {
          state.output = String(result.text || "")
          setNotice(t("saved"))
        } else {
          setNotice(`${t("failed")}: ${result.error || "-"}`)
        }
        render()
      }
    }

    if (copyBtn) {
      copyBtn.onclick = async () => {
        const output = state.output || ""
        if (!output.trim()) return
        try {
          await navigator.clipboard.writeText(output)
          setNotice(t("copied"))
        } catch (_error) {
          setNotice(t("failed"))
        }
      }
    }
  }

  async function loadInitialState() {
    const result = await send("xac:get-state")
    if (!result.ok) {
      state.lang = normalizeLang(navigator.language || "en")
      return
    }

    const snapshot = result.state || {}
    state.lang = normalizeLang(snapshot.language || navigator.language || "en")
    state.googleSession = snapshot.googleSession || null
    state.authConfig = snapshot.authConfig || null
    setSparkDraftFromPublic(snapshot.sparkSettings || null)
  }

  function installObserver() {
    if (!document.body) return

    let timer = null
    const observer = new MutationObserver(() => {
      window.clearTimeout(timer)
      timer = window.setTimeout(() => {
        applyTheme()
        tryTranslateLooseText()
      }, 250)
    })

    observer.observe(document.body, {
      subtree: true,
      childList: true,
      attributes: false
    })
  }

  async function init() {
    applyTheme()
    mount()
    await loadInitialState()
    render()
    installObserver()
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true })
  } else {
    init()
  }
})()
