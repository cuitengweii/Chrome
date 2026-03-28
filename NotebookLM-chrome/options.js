import {
  normalizeRule,
  normalizeNotebookUrl
} from "./settings.js";
import {
  getLocale,
  setLocale,
  fillLocaleSelect,
  t,
  applyI18n,
  localizeResult,
  localizeMode
} from "./i18n.js";

const FAVORITES_STORAGE_KEY = "favoriteNotebooks";

const saveRuleButton = document.getElementById("saveRule");
const runNowButton = document.getElementById("runNow");
const openNotebookButton = document.getElementById("openNotebook");
const fetchNotebooksButton = document.getElementById("fetchNotebooks");
const appendNotebooksButton = document.getElementById("appendNotebooks");
const appendSourcesForSelectedButton = document.getElementById("appendSourcesForSelected");
const addRuleRowButton = document.getElementById("addRuleRow");
const selectAllVisibleButton = document.getElementById("selectAllVisible");
const clearSelectionButton = document.getElementById("clearSelection");
const addSelectedFavoritesButton = document.getElementById("addSelectedFavorites");
const removeSelectedFavoritesButton = document.getElementById("removeSelectedFavorites");
const favoritesCount = document.getElementById("favoritesCount");
const localeSelect = document.getElementById("localeSelect");

const enabledInput = document.getElementById("enabled");
const intervalMinutesInput = document.getElementById("intervalMinutes");
const targetLinesInput = document.getElementById("targetLines");
const refreshLabelInput = document.getElementById("refreshLabel");
const notebookPicker = document.getElementById("notebookPicker");
const notebookSearchInput = document.getElementById("notebookSearch");
const pickerSelectionCount = document.getElementById("pickerSelectionCount");
const ruleRows = document.getElementById("ruleRows");

const runtimeResult = document.getElementById("runtimeResult");
const runtimeLastRun = document.getElementById("runtimeLastRun");
const runtimeLastSuccess = document.getElementById("runtimeLastSuccess");
const runtimeNextRun = document.getElementById("runtimeNextRun");
const runtimeMessage = document.getElementById("runtimeMessage");

const logList = document.getElementById("logList");
const logPrevPageButton = document.getElementById("logPrevPage");
const logNextPageButton = document.getElementById("logNextPage");
const logPageInfo = document.getElementById("logPageInfo");
const formStatus = document.getElementById("formStatus");
const buildInfo = document.getElementById("buildInfo");
const formInputs = [enabledInput, intervalMinutesInput, refreshLabelInput];

let locale = "zh-CN";
let isDirty = false;
let notebookCache = [];
let ruleRowsState = [];
let notebookSelectedUrls = new Set();
let notebookSearchKeyword = "";
let favorites = new Set();
let lastSnapshot = null;
let logPage = 1;
let logFingerprint = "";
const LOGS_PER_PAGE = 8;

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function setStatus(message) {
  formStatus.textContent = String(message || "");
}

function beginButtonLoading(button, label = `${t(locale, "common.loading")}...`) {
  const previousDisabled = button.disabled;
  const previousText = button.textContent;
  button.disabled = true;
  button.classList.add("is-loading");
  button.textContent = label;
  return () => {
    button.classList.remove("is-loading");
    button.textContent = previousText;
    button.disabled = previousDisabled;
  };
}

function formatTime(isoString) {
  return isoString ? new Date(isoString).toLocaleString() : t(locale, "common.never");
}

function formatScheduledTime(alarm) {
  if (!alarm?.scheduledTime) return t(locale, "common.notScheduled");
  return new Date(alarm.scheduledTime).toLocaleString();
}

function serializeRowsToTargetLines(rows) {
  return rows
    .map((row) => ({
      notebookUrl: normalizeNotebookUrl(row.notebookUrl || "", ""),
      sourceLabel: String(row.sourceLabel || "").trim()
    }))
    .filter((row) => row.notebookUrl && row.sourceLabel)
    .map((row) => `${row.notebookUrl} | ${row.sourceLabel}`)
    .join("\n");
}

function readRowsFromDom() {
  const rows = [];
  for (const item of ruleRows.querySelectorAll("li.rule-row")) {
    const urlInput = item.querySelector("input[data-role='url']");
    const sourceInput = item.querySelector("input[data-role='source']");
    rows.push({
      notebookUrl: String(urlInput?.value || "").trim(),
      sourceLabel: String(sourceInput?.value || "").trim()
    });
  }
  return rows;
}

function syncHiddenTargetLines() {
  targetLinesInput.value = serializeRowsToTargetLines(readRowsFromDom());
}

function bindRowInputs(li) {
  const inputs = li.querySelectorAll("input");
  inputs.forEach((input) => {
    input.addEventListener("input", () => {
      isDirty = true;
      syncHiddenTargetLines();
    });
    input.addEventListener("change", () => {
      isDirty = true;
      syncHiddenTargetLines();
    });
  });
}

function addRow(row = { notebookUrl: "", sourceLabel: "" }) {
  const li = document.createElement("li");
  li.className = "rule-row";
  li.innerHTML = `
    <input data-role="url" type="url" placeholder="${escapeHtml(t(locale, "options.rowUrlPlaceholder"))}" value="${escapeHtml(row.notebookUrl || "")}">
    <input data-role="source" type="text" placeholder="${escapeHtml(t(locale, "options.rowSourcePlaceholder"))}" value="${escapeHtml(row.sourceLabel || "")}">
    <button data-role="remove" class="danger-button" type="button">${escapeHtml(t(locale, "options.rowRemove"))}</button>
  `;

  const removeButton = li.querySelector("button[data-role='remove']");
  removeButton.addEventListener("click", () => {
    li.remove();
    if (!ruleRows.querySelector("li.rule-row")) {
      renderRows([]);
    }
    isDirty = true;
    syncHiddenTargetLines();
  });

  bindRowInputs(li);
  ruleRows.appendChild(li);
}

function renderRows(rows) {
  const normalizedRows = Array.isArray(rows) ? rows : [];
  ruleRows.innerHTML = "";

  if (!normalizedRows.length) {
    const empty = document.createElement("li");
    empty.className = "empty-log";
    empty.textContent = t(locale, "options.rowEmpty");
    ruleRows.appendChild(empty);
    targetLinesInput.value = "";
    return;
  }

  normalizedRows.forEach((row) => addRow(row));
  syncHiddenTargetLines();
}

function getCachedTitleByUrl(url) {
  const item = notebookCache.find((node) => node.url === url);
  return item?.title || "";
}

function renderRule(rule, { force = false } = {}) {
  if (!force && isDirty) return;

  enabledInput.checked = rule.enabled;
  intervalMinutesInput.value = String(rule.intervalMinutes);
  refreshLabelInput.value = rule.refreshLabel;

  ruleRowsState = (rule.targets || []).map((target) => ({
    notebookUrl: target.notebookUrl,
    sourceLabel: target.sourceLabel
  }));
  renderRows(ruleRowsState);
  isDirty = false;
}

function renderLogs(runtime, { forceFirstPage = false } = {}) {
  const entries = Array.isArray(runtime?.recentRuns) ? runtime.recentRuns : [];
  const fingerprint = entries.length ? `${entries[0]?.at || ""}|${entries.length}` : "0";
  if (forceFirstPage || fingerprint !== logFingerprint) logPage = 1;
  logFingerprint = fingerprint;

  const totalCount = entries.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / LOGS_PER_PAGE));
  if (logPage > totalPages) logPage = totalPages;
  if (logPage < 1) logPage = 1;

  if (!totalCount) {
    logList.innerHTML = `<li class="empty-log">${escapeHtml(t(locale, "options.logsEmpty"))}</li>`;
    logPrevPageButton.disabled = true;
    logNextPageButton.disabled = true;
    logPageInfo.textContent = t(locale, "options.logsPageInfo", { page: 1, total: 1, count: 0 });
    return;
  }

  const startIndex = (logPage - 1) * LOGS_PER_PAGE;
  const pageItems = entries.slice(startIndex, startIndex + LOGS_PER_PAGE);

  logList.innerHTML = pageItems.map((entry) => `
    <li class="log-entry">
      <strong>${escapeHtml(localizeMode(locale, entry.mode))} · ${escapeHtml(localizeResult(locale, entry.result))}</strong>
      <span>${escapeHtml(formatTime(entry.at))}</span>
      <span>${escapeHtml(entry.message || "-")}</span>
    </li>
  `).join("");

  logPrevPageButton.disabled = logPage <= 1;
  logNextPageButton.disabled = logPage >= totalPages;
  logPageInfo.textContent = t(locale, "options.logsPageInfo", { page: logPage, total: totalPages, count: totalCount });
}

function renderRuntime(snapshot) {
  const { runtime, alarm } = snapshot;
  runtimeResult.textContent = localizeResult(locale, runtime.lastResult);
  runtimeLastRun.textContent = formatTime(runtime.lastRunAt);
  runtimeLastSuccess.textContent = formatTime(runtime.lastSuccessAt);
  runtimeNextRun.textContent = formatScheduledTime(alarm);
  runtimeMessage.textContent = runtime.lastResult === "success"
    ? t(locale, "options.runtimeHintSuccess")
    : runtime.lastErrorMessage || t(locale, "options.runtimeHintIdle");
  renderLogs(runtime);
}

function renderNotebookPicker(notebooks) {
  notebookCache = Array.isArray(notebooks) ? notebooks : [];
  notebookSelectedUrls = new Set(
    [...notebookSelectedUrls].filter((url) => notebookCache.some((item) => item.url === url))
  );
  drawNotebookPicker();
}

function selectedNotebookUrls() {
  return [...notebookSelectedUrls];
}

function updateSelectionCount() {
  pickerSelectionCount.textContent = t(locale, "options.pickerSelected", { count: notebookSelectedUrls.size });
  favoritesCount.textContent = t(locale, "options.favoritesCount", { count: favorites.size });
}

function notebookMatchesSearch(item) {
  if (!notebookSearchKeyword) return true;
  const title = String(item.title || "").toLowerCase();
  const url = String(item.url || "").toLowerCase();
  return title.includes(notebookSearchKeyword) || url.includes(notebookSearchKeyword);
}

function drawNotebookPicker() {
  notebookPicker.innerHTML = "";
  const visible = notebookCache.filter((item) => notebookMatchesSearch(item));

  if (!notebookCache.length) {
    notebookPicker.innerHTML = `<div class="picker-empty">${escapeHtml(t(locale, "options.pickerEmpty"))}</div>`;
    updateSelectionCount();
    return;
  }

  if (!visible.length) {
    notebookPicker.innerHTML = `<div class="picker-empty">${escapeHtml(t(locale, "options.pickerNoMatch"))}</div>`;
    updateSelectionCount();
    return;
  }

  visible.forEach((item) => {
    const row = document.createElement("label");
    row.className = "notebook-item";
    row.innerHTML = `
      <input type="checkbox" ${notebookSelectedUrls.has(item.url) ? "checked" : ""}>
      <span class="notebook-main">
        <strong class="notebook-title">${escapeHtml(item.title)}${favorites.has(item.url) ? " ★" : ""}</strong>
        <span class="notebook-url">${escapeHtml(item.url)}</span>
      </span>
    `;

    const checkbox = row.querySelector("input[type='checkbox']");
    checkbox.addEventListener("change", () => {
      if (checkbox.checked) notebookSelectedUrls.add(item.url);
      else notebookSelectedUrls.delete(item.url);
      updateSelectionCount();
    });

    notebookPicker.appendChild(row);
  });

  updateSelectionCount();
}

async function refreshFavorites() {
  const response = await chrome.runtime.sendMessage({ type: "GET_FAVORITES" });
  if (!response?.ok) throw new Error(response?.error || "get_favorites_failed");
  favorites = new Set(Array.isArray(response.favorites) ? response.favorites : []);
  updateSelectionCount();
}

function collectRule() {
  const rows = readRowsFromDom();
  return normalizeRule({
    enabled: enabledInput.checked,
    intervalMinutes: intervalMinutesInput.value,
    targetLines: serializeRowsToTargetLines(rows),
    refreshLabel: refreshLabelInput.value
  });
}

function appendSelectedNotebooksToRules() {
  const selected = selectedNotebookUrls();
  if (!selected.length) {
    setStatus(t(locale, "options.statusNoSelection"));
    return;
  }

  const existing = new Set(
    readRowsFromDom().map((row) => `${normalizeNotebookUrl(row.notebookUrl, "")}|${row.sourceLabel}`)
  );

  let appended = 0;
  selected.forEach((url) => {
    const sourceLabel = getCachedTitleByUrl(url) || "work ai news";
    const key = `${normalizeNotebookUrl(url, "")}|${sourceLabel}`;
    if (existing.has(key)) return;
    if (!ruleRows.querySelector("li.rule-row")) ruleRows.innerHTML = "";
    addRow({ notebookUrl: url, sourceLabel });
    existing.add(key);
    appended += 1;
  });

  isDirty = true;
  syncHiddenTargetLines();

  setStatus(
    appended
      ? t(locale, "options.statusAddedRules", { count: appended })
      : t(locale, "options.statusAlreadyExists")
  );
}

function appendExtraSourceRowsForSelected() {
  const selected = selectedNotebookUrls();
  if (!selected.length) {
    setStatus(t(locale, "options.statusNoSelection"));
    return;
  }

  if (!ruleRows.querySelector("li.rule-row")) ruleRows.innerHTML = "";
  selected.forEach((url) => addRow({ notebookUrl: url, sourceLabel: "" }));

  isDirty = true;
  syncHiddenTargetLines();
  setStatus(t(locale, "options.statusAppendedSources", { count: selected.length }));
}

async function fetchState() {
  const response = await chrome.runtime.sendMessage({ type: "GET_STATE" });
  if (!response?.ok) throw new Error(response?.error || "state_failed");
  return response.snapshot;
}

async function refreshState(message = t(locale, "common.ready")) {
  const snapshot = await fetchState();
  lastSnapshot = snapshot;
  renderRule(snapshot.rule);
  renderRuntime(snapshot);
  setStatus(message);
}

async function invokeAction(button, message, progressText, doneText) {
  const endLoading = beginButtonLoading(button);
  setStatus(progressText);

  try {
    const response = await chrome.runtime.sendMessage(message);
    if (!response?.ok) throw new Error(response?.error || "action_failed");
    lastSnapshot = response.snapshot;
    renderRule(response.snapshot.rule);
    renderRuntime(response.snapshot);
    setStatus(doneText);
    return response;
  } catch (error) {
    setStatus(t(locale, "common.actionFailed", { message: error.message }));
    throw error;
  } finally {
    const snapshot = await fetchState().catch(() => null);
    if (snapshot) {
      lastSnapshot = snapshot;
      renderRule(snapshot.rule);
      renderRuntime(snapshot);
    }
    endLoading();
  }
}

function refreshStaticText() {
  applyI18n(locale);
  document.title = t(locale, "options.pageTitle");
  buildInfo.textContent = t(locale, "common.version", { version: chrome.runtime.getManifest().version });
  updateSelectionCount();
}

saveRuleButton.addEventListener("click", () => {
  const endLoading = beginButtonLoading(saveRuleButton);
  setStatus(t(locale, "options.statusSaving"));

  chrome.runtime.sendMessage({ type: "SAVE_RULE", payload: collectRule() })
    .then((response) => {
      if (!response?.ok) throw new Error(response?.error || "save_failed");
      isDirty = false;
      lastSnapshot = response.snapshot;
      renderRule(response.snapshot.rule, { force: true });
      renderRuntime(response.snapshot);
      setStatus(t(locale, "options.statusSaved"));
    })
    .catch((error) => {
      setStatus(t(locale, "common.actionFailed", { message: error.message }));
    })
    .finally(async () => {
      const snapshot = await fetchState().catch(() => null);
      if (snapshot) {
        lastSnapshot = snapshot;
        renderRule(snapshot.rule);
        renderRuntime(snapshot);
      }
      endLoading();
    });
});

runNowButton.addEventListener("click", () => {
  invokeAction(runNowButton, { type: "RUN_NOW" }, t(locale, "popup.progressRunNow"), t(locale, "popup.doneRunNow"))
    .catch(() => undefined);
});

openNotebookButton.addEventListener("click", () => {
  invokeAction(
    openNotebookButton,
    { type: "OPEN_NOTEBOOK" },
    t(locale, "popup.progressOpenNotebook"),
    t(locale, "popup.doneOpenNotebook")
  ).catch(() => undefined);
});

fetchNotebooksButton.addEventListener("click", async () => {
  const endLoading = beginButtonLoading(fetchNotebooksButton);
  appendNotebooksButton.disabled = true;
  appendSourcesForSelectedButton.disabled = true;
  selectAllVisibleButton.disabled = true;
  clearSelectionButton.disabled = true;
  setStatus(t(locale, "options.statusFetchNotebooks"));
  notebookPicker.innerHTML = `<div class="picker-empty picker-loading">${escapeHtml(t(locale, "common.loading"))}...</div>`;

  try {
    const response = await chrome.runtime.sendMessage({ type: "FETCH_NOTEBOOKS" });
    if (!response?.ok) throw new Error(response?.error || "fetch_notebooks_failed");
    renderNotebookPicker(response.notebooks || []);
    lastSnapshot = response.snapshot;
    renderRuntime(response.snapshot);
    setStatus(t(locale, "options.statusFetchedNotebooks", { count: response.notebooks?.length || 0 }));
  } catch (error) {
    drawNotebookPicker();
    setStatus(t(locale, "common.actionFailed", { message: error.message }));
  } finally {
    appendNotebooksButton.disabled = false;
    appendSourcesForSelectedButton.disabled = false;
    selectAllVisibleButton.disabled = false;
    clearSelectionButton.disabled = false;
    endLoading();
  }
});

appendNotebooksButton.addEventListener("click", appendSelectedNotebooksToRules);
appendSourcesForSelectedButton.addEventListener("click", appendExtraSourceRowsForSelected);

addSelectedFavoritesButton.addEventListener("click", async () => {
  const selected = selectedNotebookUrls();
  if (!selected.length) {
    setStatus(t(locale, "options.statusNoSelection"));
    return;
  }
  const endLoading = beginButtonLoading(addSelectedFavoritesButton);
  try {
    const response = await chrome.runtime.sendMessage({ type: "SET_FAVORITES", action: "add", urls: selected });
    if (!response?.ok) throw new Error(response?.error || "set_favorites_failed");
    favorites = new Set(Array.isArray(response.favorites) ? response.favorites : []);
    drawNotebookPicker();
    setStatus(t(locale, "options.statusFavoritesAdded", { count: selected.length }));
  } catch (error) {
    setStatus(t(locale, "common.actionFailed", { message: error.message }));
  } finally {
    endLoading();
  }
});

removeSelectedFavoritesButton.addEventListener("click", async () => {
  const selected = selectedNotebookUrls();
  if (!selected.length) {
    setStatus(t(locale, "options.statusNoSelection"));
    return;
  }
  const endLoading = beginButtonLoading(removeSelectedFavoritesButton);
  try {
    const response = await chrome.runtime.sendMessage({ type: "SET_FAVORITES", action: "remove", urls: selected });
    if (!response?.ok) throw new Error(response?.error || "set_favorites_failed");
    favorites = new Set(Array.isArray(response.favorites) ? response.favorites : []);
    drawNotebookPicker();
    setStatus(t(locale, "options.statusFavoritesRemoved", { count: selected.length }));
  } catch (error) {
    setStatus(t(locale, "common.actionFailed", { message: error.message }));
  } finally {
    endLoading();
  }
});

selectAllVisibleButton.addEventListener("click", () => {
  const visible = notebookCache.filter((item) => notebookMatchesSearch(item));
  visible.forEach((item) => notebookSelectedUrls.add(item.url));
  drawNotebookPicker();
});

clearSelectionButton.addEventListener("click", () => {
  notebookSelectedUrls.clear();
  drawNotebookPicker();
});

logPrevPageButton.addEventListener("click", () => {
  if (!lastSnapshot?.runtime) return;
  logPage -= 1;
  renderLogs(lastSnapshot.runtime);
});

logNextPageButton.addEventListener("click", () => {
  if (!lastSnapshot?.runtime) return;
  logPage += 1;
  renderLogs(lastSnapshot.runtime);
});

notebookSearchInput.addEventListener("input", () => {
  notebookSearchKeyword = String(notebookSearchInput.value || "").trim().toLowerCase();
  drawNotebookPicker();
});

addRuleRowButton.addEventListener("click", () => {
  if (!ruleRows.querySelector("li.rule-row")) ruleRows.innerHTML = "";
  addRow({ notebookUrl: "", sourceLabel: "" });
  isDirty = true;
  syncHiddenTargetLines();
});

localeSelect.addEventListener("change", async () => {
  locale = await setLocale(localeSelect.value);
  fillLocaleSelect(localeSelect, locale);
  refreshStaticText();

  const rows = readRowsFromDom();
  renderRows(rows);
  drawNotebookPicker();

  if (lastSnapshot) {
    renderRuntime(lastSnapshot);
  } else {
    logPrevPageButton.disabled = true;
    logNextPageButton.disabled = true;
    logPageInfo.textContent = t(locale, "options.logsPageInfo", { page: 1, total: 1, count: 0 });
  }

  setStatus(t(locale, "common.ready"));
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== "local") return;

  if (changes.uiLocale) {
    locale = changes.uiLocale.newValue;
    fillLocaleSelect(localeSelect, locale);
    refreshStaticText();

    const rows = readRowsFromDom();
    renderRows(rows);
    drawNotebookPicker();
    if (lastSnapshot) renderRuntime(lastSnapshot);
    return;
  }

  if (changes[FAVORITES_STORAGE_KEY]) {
    const next = Array.isArray(changes[FAVORITES_STORAGE_KEY]?.newValue) ? changes[FAVORITES_STORAGE_KEY].newValue : [];
    favorites = new Set(next);
    drawNotebookPicker();
  }

  refreshState(t(locale, "options.statusRefreshingState")).catch(() => undefined);
});

formInputs.forEach((input) => {
  input.addEventListener("input", () => {
    isDirty = true;
  });
  input.addEventListener("change", () => {
    isDirty = true;
  });
});

async function bootstrap() {
  locale = await getLocale();
  fillLocaleSelect(localeSelect, locale);
  refreshStaticText();

  renderNotebookPicker([]);
  renderRows([]);
  favorites = new Set();
  logPrevPageButton.disabled = true;
  logNextPageButton.disabled = true;
  logPageInfo.textContent = t(locale, "options.logsPageInfo", { page: 1, total: 1, count: 0 });
  updateSelectionCount();
  setStatus(t(locale, "common.ready"));

  try {
    await refreshFavorites().catch(() => undefined);
    await refreshState(t(locale, "common.ready"));
  } catch (error) {
    setStatus(t(locale, "common.loadFailed", { message: error.message }));
  }
}

bootstrap();
