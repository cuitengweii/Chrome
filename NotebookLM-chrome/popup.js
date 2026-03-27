import { getLocale, setLocale, fillLocaleSelect, t, applyI18n, localizeResult, localizeMode } from "./i18n.js";

const heroSummary = document.getElementById("heroSummary");
const timerPill = document.getElementById("timerPill");
const scheduleLabel = document.getElementById("scheduleLabel");
const scheduleDetail = document.getElementById("scheduleDetail");
const resultLabel = document.getElementById("resultLabel");
const resultDetail = document.getElementById("resultDetail");
const ruleLabel = document.getElementById("ruleLabel");
const ruleDetail = document.getElementById("ruleDetail");
const runNowButton = document.getElementById("runNow");
const openNotebookButton = document.getElementById("openNotebook");
const toggleEnabledButton = document.getElementById("toggleEnabled");
const openManagerButton = document.getElementById("openManager");
const openOptionsButton = document.getElementById("openOptions");
const localeSelect = document.getElementById("localeSelect");
const logList = document.getElementById("logList");
const popupStatus = document.getElementById("popupStatus");
const buildInfo = document.getElementById("buildInfo");

const MESSAGE_TIMEOUT_MS = 8000;

let locale = "zh-CN";
let lastSnapshot = null;

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function setStatus(message) {
  popupStatus.textContent = String(message || "");
}

function formatTime(isoString) {
  return isoString ? new Date(isoString).toLocaleString() : t(locale, "common.never");
}

function formatScheduledTime(alarm) {
  if (!alarm?.scheduledTime) return t(locale, "common.notScheduled");
  return new Date(alarm.scheduledTime).toLocaleString();
}

function setTone(nodeId, tone) {
  const node = document.getElementById(nodeId);
  const card = node?.closest(".status-card");
  if (card) card.dataset.tone = tone;
}

function resultTone(result) {
  if (result === "success") return "good";
  if (result === "running") return "warn";
  if (result === "idle") return "muted";
  return "warn";
}

function setLoadingState(message = t(locale, "popup.statusLoading")) {
  const loading = t(locale, "common.loading");
  scheduleLabel.textContent = loading;
  scheduleDetail.textContent = message;
  resultLabel.textContent = loading;
  resultDetail.textContent = message;
  ruleLabel.textContent = loading;
  ruleDetail.textContent = message;
  timerPill.textContent = loading;
}

function renderLogs(runtime) {
  const recent = Array.isArray(runtime?.recentRuns) ? runtime.recentRuns : [];
  if (!recent.length) {
    logList.innerHTML = `<li class="empty-log">${escapeHtml(t(locale, "popup.logsEmpty"))}</li>`;
    return;
  }

  logList.innerHTML = recent.slice(0, 5).map((entry) => `
    <li class="log-entry">
      <strong>${escapeHtml(localizeMode(locale, entry.mode))} · ${escapeHtml(localizeResult(locale, entry.result))}</strong>
      <span>${escapeHtml(formatTime(entry.at))}</span>
      <span>${escapeHtml(entry.message || "-")}</span>
    </li>
  `).join("");
}

function renderState(snapshot) {
  lastSnapshot = snapshot;

  if (!snapshot?.rule || !snapshot?.runtime) {
    setLoadingState(t(locale, "popup.stateEmpty"));
    return;
  }

  const { rule, runtime, alarm } = snapshot;
  const targets = Array.isArray(rule.targets) ? rule.targets : [];
  const previewTargets = targets
    .slice(0, 2)
    .map((target) => String(target?.sourceLabel || "").trim())
    .filter(Boolean)
    .join(" | ");

  heroSummary.textContent = t(locale, "popup.heroSummary", {
    refreshLabel: rule.refreshLabel || "-"
  });

  timerPill.textContent = rule.enabled
    ? t(locale, "popup.timerEvery", { minutes: rule.intervalMinutes })
    : t(locale, "popup.timerPaused");

  scheduleLabel.textContent = rule.enabled
    ? t(locale, "popup.scheduleEnabled")
    : t(locale, "popup.schedulePaused");
  scheduleDetail.textContent = rule.enabled
    ? t(locale, "popup.scheduleNext", { time: formatScheduledTime(alarm) })
    : t(locale, "popup.schedulePausedHint");
  setTone("scheduleLabel", rule.enabled ? "good" : "muted");

  resultLabel.textContent = localizeResult(locale, runtime.lastResult || "idle");
  resultDetail.textContent = runtime.lastResult === "success"
    ? t(locale, "popup.resultSuccessAt", { time: formatTime(runtime.lastSuccessAt) })
    : (runtime.lastErrorMessage || t(locale, "popup.resultLastRunAt", { time: formatTime(runtime.lastRunAt) }));
  setTone("resultLabel", resultTone(runtime.lastResult));

  ruleLabel.textContent = t(locale, "popup.ruleConfigured", { count: targets.length });
  ruleDetail.textContent = previewTargets
    ? `${previewTargets}${targets.length > 2 ? " ..." : ""}`
    : t(locale, "popup.ruleNotConfigured");
  setTone("ruleLabel", "muted");

  toggleEnabledButton.textContent = rule.enabled
    ? t(locale, "popup.togglePause")
    : t(locale, "popup.toggleResume");

  runNowButton.disabled = runtime.lastResult === "running";
  renderLogs(runtime);
}

function refreshStaticText() {
  applyI18n(locale);
  document.title = t(locale, "common.appName");
  buildInfo.textContent = t(locale, "common.version", { version: chrome.runtime.getManifest().version });
}

async function sendMessageWithTimeout(message, timeoutMs = MESSAGE_TIMEOUT_MS) {
  return Promise.race([
    chrome.runtime.sendMessage(message),
    new Promise((_, reject) => setTimeout(() => reject(new Error("background_timeout")), timeoutMs))
  ]);
}

async function fetchState() {
  const response = await sendMessageWithTimeout({ type: "GET_STATE" });
  if (!response?.ok) throw new Error(response?.error || "state_failed");
  return response.snapshot;
}

async function refreshState(statusMessage = t(locale, "popup.statusReady")) {
  const snapshot = await fetchState();
  renderState(snapshot);
  setStatus(statusMessage);
}

async function invokeAction(button, message, progressText, doneText) {
  const wasDisabled = button.disabled;
  button.disabled = true;
  setStatus(progressText);
  try {
    const response = await sendMessageWithTimeout(message, 15000);
    if (!response?.ok) throw new Error(response?.error || "action_failed");
    renderState(response.snapshot);
    setStatus(doneText);
  } finally {
    const snapshot = await fetchState().catch(() => null);
    if (snapshot) renderState(snapshot);
    button.disabled = wasDisabled;
  }
}

runNowButton.addEventListener("click", () => {
  invokeAction(
    runNowButton,
    { type: "RUN_NOW" },
    t(locale, "popup.progressRunNow"),
    t(locale, "popup.doneRunNow")
  ).catch((error) => setStatus(t(locale, "common.actionFailed", { message: error.message })));
});

openNotebookButton.addEventListener("click", () => {
  invokeAction(
    openNotebookButton,
    { type: "OPEN_NOTEBOOK" },
    t(locale, "popup.progressOpenNotebook"),
    t(locale, "popup.doneOpenNotebook")
  ).catch((error) => setStatus(t(locale, "common.actionFailed", { message: error.message })));
});

toggleEnabledButton.addEventListener("click", () => {
  invokeAction(
    toggleEnabledButton,
    { type: "TOGGLE_ENABLED" },
    t(locale, "popup.progressToggle"),
    t(locale, "popup.doneToggle")
  ).catch((error) => setStatus(t(locale, "common.actionFailed", { message: error.message })));
});

openOptionsButton.addEventListener("click", async () => {
  await chrome.runtime.openOptionsPage();
  window.close();
});

openManagerButton.addEventListener("click", () => {
  invokeAction(
    openManagerButton,
    { type: "OPEN_MANAGER_PAGE" },
    t(locale, "popup.progressOpenManager"),
    t(locale, "popup.doneOpenManager")
  ).then(() => window.close())
    .catch((error) => setStatus(t(locale, "common.actionFailed", { message: error.message })));
});

localeSelect.addEventListener("change", async () => {
  locale = await setLocale(localeSelect.value);
  fillLocaleSelect(localeSelect, locale);
  refreshStaticText();
  if (lastSnapshot) renderState(lastSnapshot);
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== "local") return;
  if (changes.uiLocale) {
    locale = changes.uiLocale.newValue;
    fillLocaleSelect(localeSelect, locale);
    refreshStaticText();
    if (lastSnapshot) renderState(lastSnapshot);
    return;
  }
  refreshState(t(locale, "popup.statusSynced")).catch(() => undefined);
});

async function bootstrap() {
  locale = await getLocale();
  fillLocaleSelect(localeSelect, locale);
  refreshStaticText();
  setLoadingState(t(locale, "popup.statusLoading"));
  setStatus(t(locale, "popup.statusReady"));

  try {
    await refreshState(t(locale, "popup.statusReady"));
  } catch (error) {
    const message = error?.message || "unknown_error";
    setLoadingState(t(locale, "common.loadFailed", { message }));
    setStatus(`${t(locale, "common.loadFailed", { message })} ${t(locale, "popup.errorsHint")}`);
  }
}

bootstrap();
