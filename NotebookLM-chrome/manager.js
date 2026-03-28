import { normalizeRule, normalizeNotebookUrl } from "./settings.js";
import {
  getLocale,
  setLocale,
  fillLocaleSelect,
  t,
  applyI18n,
  localizeResult,
  localizeMode
} from "./i18n.js";

const REQUEST_TIMEOUT_MS = 60000;
const VIEW_PREFS_KEY = "managerViewPrefs";
const THEME_PREF_KEY = "managerTheme";

const el = {
  refreshNotebooksButton: document.getElementById("refreshNotebooks"),
  openOptionsButton: document.getElementById("openOptions"),
  searchInput: document.getElementById("searchInput"),
  tagFilterInput: document.getElementById("tagFilterInput"),
  sortField: document.getElementById("sortField"),
  sortDirection: document.getElementById("sortDirection"),
  pageSize: document.getElementById("pageSize"),
  pagePrev: document.getElementById("pagePrev"),
  pageNext: document.getElementById("pageNext"),
  pageInfo: document.getElementById("pageInfo"),
  selectAllVisibleButton: document.getElementById("selectAllVisible"),
  clearSelectionButton: document.getElementById("clearSelection"),
  themeToggle: document.getElementById("themeToggle"),
  selectionCount: document.getElementById("selectionCount"),
  localeSelect: document.getElementById("localeSelect"),
  colSources: document.getElementById("colSources"),
  colCollections: document.getElementById("colCollections"),
  colLastEdited: document.getElementById("colLastEdited"),
  colAudio: document.getElementById("colAudio"),
  colTags: document.getElementById("colTags"),
  colRules: document.getElementById("colRules"),
  colOps: document.getElementById("colOps"),

  batchAddRuleButton: document.getElementById("batchAddRule"),
  batchAddSourceButton: document.getElementById("batchAddSource"),
  batchRunNowButton: document.getElementById("batchRunNow"),
  batchCreateCollectionButton: document.getElementById("batchCreateCollection"),
  tableBody: document.getElementById("tableBody"),
  sourceDetailTitle: document.getElementById("sourceDetailTitle"),
  sourceDetailHint: document.getElementById("sourceDetailHint"),
  sourceDetailBackButton: document.getElementById("sourceDetailBack"),
  sourceDetailRefreshButton: document.getElementById("sourceDetailRefresh"),
  sourceDetailDownloadAllButton: document.getElementById("sourceDetailDownloadAll"),
  sourceDetailBody: document.getElementById("sourceDetailBody"),
  refreshAllSourcesButton: document.getElementById("refreshAllSources"),
  allSourcesSearchInput: document.getElementById("allSourcesSearchInput"),
  allSourcesFolderGrid: document.getElementById("allSourcesFolderGrid"),
  allSourcesSyncGdocsButton: document.getElementById("allSourcesSyncGdocs"),
  allSourcesDownloadButton: document.getElementById("allSourcesDownload"),
  allSourcesCreateNotebookButton: document.getElementById("allSourcesCreateNotebook"),
  allSourcesAddToNotebookButton: document.getElementById("allSourcesAddToNotebook"),
  allSourcesMoveFolderButton: document.getElementById("allSourcesMoveFolder"),
  allSourcesDeleteButton: document.getElementById("allSourcesDelete"),
  allSourcesDeleteBadButton: document.getElementById("allSourcesDeleteBad"),
  allSourcesSelectAll: document.getElementById("allSourcesSelectAll"),
  allSourcesBody: document.getElementById("allSourcesBody"),
  allSourcesRowsPerPage: document.getElementById("allSourcesRowsPerPage"),
  allSourcesPrevPage: document.getElementById("allSourcesPrevPage"),
  allSourcesNextPage: document.getElementById("allSourcesNextPage"),
  allSourcesPageInfo: document.getElementById("allSourcesPageInfo"),
  allSourcesSelectedCount: document.getElementById("allSourcesSelectedCount"),
  refreshDocumentsButton: document.getElementById("refreshDocuments"),
  documentsDownloadSelectedButton: document.getElementById("documentsDownloadSelected"),
  documentsSearchInput: document.getElementById("documentsSearchInput"),
  documentsTypeFilter: document.getElementById("documentsTypeFilter"),
  documentsSelectAll: document.getElementById("documentsSelectAll"),
  documentsBody: document.getElementById("documentsBody"),
  documentsRowsPerPage: document.getElementById("documentsRowsPerPage"),
  documentsPrevPage: document.getElementById("documentsPrevPage"),
  documentsNextPage: document.getElementById("documentsNextPage"),
  documentsPageInfo: document.getElementById("documentsPageInfo"),
  documentsSelectedCount: document.getElementById("documentsSelectedCount"),
  mergeTitleInput: document.getElementById("mergeTitleInput"),
  mergeSearchInput: document.getElementById("mergeSearchInput"),
  mergeDeleteOriginal: document.getElementById("mergeDeleteOriginal"),
  mergeSelectAll: document.getElementById("mergeSelectAll"),
  mergeSelectedInfo: document.getElementById("mergeSelectedInfo"),
  mergeSelectedNowButton: document.getElementById("mergeSelectedNow"),
  mergeBody: document.getElementById("mergeBody"),

  targetNotebookSelect: document.getElementById("targetNotebook"),
  pageUrlInput: document.getElementById("pageUrlInput"),
  youtubeUrlInput: document.getElementById("youtubeUrlInput"),
  rssUrlInput: document.getElementById("rssUrlInput"),
  importUrlsTextarea: document.getElementById("importUrls"),
  bulkMethodTabs: document.getElementById("bulkMethodTabs"),
  loadFromTabsButton: document.getElementById("loadFromTabs"),
  loadFromBookmarksButton: document.getElementById("loadFromBookmarks"),
  loadFromPageLinksButton: document.getElementById("loadFromPageLinks"),
  loadFromYoutubeButton: document.getElementById("loadFromYoutube"),
  loadFromRssButton: document.getElementById("loadFromRss"),
  csvFileInput: document.getElementById("csvFileInput"),
  loadFromCsvButton: document.getElementById("loadFromCsv"),
  crawlerUpgradeButton: document.getElementById("crawlerUpgrade"),
  clearImportUrlsButton: document.getElementById("clearImportUrls"),
  batchImportToNotebookButton: document.getElementById("batchImportToNotebook"),

  podcastNotebookSelect: document.getElementById("podcastNotebook"),
  podcastTitleInput: document.getElementById("podcastTitle"),
  syncPodcastFeedButton: document.getElementById("syncPodcastFeed"),
  podcastFeedList: document.getElementById("podcastFeedList"),

  automationRunNowButton: document.getElementById("automationRunNow"),
  automationOpenNotebookButton: document.getElementById("automationOpenNotebook"),
  automationToggleEnabledButton: document.getElementById("automationToggleEnabled"),
  autoResult: document.getElementById("autoResult"),
  autoLastRun: document.getElementById("autoLastRun"),
  autoLastSuccess: document.getElementById("autoLastSuccess"),
  autoNextRun: document.getElementById("autoNextRun"),
  autoMessage: document.getElementById("autoMessage"),
  automationLogList: document.getElementById("automationLogList"),
  automationLogsPerPage: document.getElementById("automationLogsPerPage"),
  automationLogPageInfo: document.getElementById("automationLogPageInfo"),
  automationLogPrevButton: document.getElementById("automationLogPrev"),
  automationLogNextButton: document.getElementById("automationLogNext"),

  addSelectedFavoritesButton: document.getElementById("addSelectedFavorites"),
  removeSelectedFavoritesButton: document.getElementById("removeSelectedFavorites"),
  favoritesList: document.getElementById("favoritesList"),

  collectionNameInput: document.getElementById("collectionName"),
  createCollectionFromSelectedButton: document.getElementById("createCollectionFromSelected"),
  collectionsList: document.getElementById("collectionsList"),

  templateNameInput: document.getElementById("templateName"),
  templateSourcesInput: document.getElementById("templateSources"),
  templateRefreshLabelInput: document.getElementById("templateRefreshLabel"),
  saveTemplateButton: document.getElementById("saveTemplate"),
  cancelTemplateEditButton: document.getElementById("cancelTemplateEdit"),
  templatesList: document.getElementById("templatesList"),

  statsGrid: document.getElementById("statsGrid"),
  statusNode: document.getElementById("status"),
  buildInfo: document.getElementById("buildInfo"),
  downloadDialog: document.getElementById("downloadDialog"),
  downloadFilterInput: document.getElementById("downloadFilterInput"),
  downloadSourceList: document.getElementById("downloadSourceList"),
  downloadPreviewButton: document.getElementById("downloadPreviewButton"),
  downloadSelectedButton: document.getElementById("downloadSelectedButton"),
  globalLoading: document.getElementById("globalLoading"),
  globalLoadingTitle: document.getElementById("globalLoadingTitle"),
  globalLoadingHint: document.getElementById("globalLoadingHint"),
  appDialog: document.getElementById("appDialog"),
  appDialogTitle: document.getElementById("appDialogTitle"),
  appDialogMessage: document.getElementById("appDialogMessage"),
  appDialogInputWrap: document.getElementById("appDialogInputWrap"),
  appDialogInputLabel: document.getElementById("appDialogInputLabel"),
  appDialogInput: document.getElementById("appDialogInput"),
  appDialogPreview: document.getElementById("appDialogPreview"),
  appDialogCancel: document.getElementById("appDialogCancel"),
  appDialogConfirm: document.getElementById("appDialogConfirm"),
  appDialogCloseTop: document.getElementById("appDialogCloseTop"),

  navItems: [...document.querySelectorAll(".nav-item")],
  views: [...document.querySelectorAll(".view")]
};

el.bulkMethodButtons = [...document.querySelectorAll(".method-tab[data-method]")];
el.bulkMethodPanels = [...document.querySelectorAll(".method-panel[data-method-panel]")];

const state = {
  locale: "zh-CN",
  theme: "light",
  notebooks: [],
  filtered: [],
  selected: new Set(),
  snapshot: null,
  searchKey: "",
  tagFilterKey: "",
  favorites: new Set(),
  collections: [],
  templates: [],
  allSources: [],
  allSourcesFiltered: [],
  allSourcesPaged: [],
  allSourcesSelected: new Set(),
  allSourcesCurrentPage: 1,
  allSourcesPageSize: 20,
  allSourcesFolderFilter: "all",
  allSourcesLoading: false,
  allSourcesError: "",
  podcastFeedsCount: 0,
  sourceFolders: [],
  sourceFolderAssignments: {},
  allDocuments: [],
  documentsFiltered: [],
  documentsPaged: [],
  documentsSearchKey: "",
  documentsTypeFilter: "",
  documentsSelected: new Set(),
  documentsCurrentPage: 1,
  documentsPageSize: 20,
  sourceDetail: {
    notebookId: "",
    notebookUrl: "",
    notebookTitle: "",
    sources: []
  },
  sourceSearchKey: "",
  mergeSelected: new Set(),
  mergeSearchKey: "",
  notebookTags: {},
  audioTasks: {},
  sourceMeta: {},
  localUser: null,
  pagedRows: [],
  currentPage: 1,
  pageSize: 20,
  sortField: "title",
  sortDirection: "asc",
  columnVisible: {
    sources: true,
    collections: true,
    lastEdited: true,
    audio: true,
    tags: true,
    rules: true,
    ops: true
  },
  editingTemplateId: "",
  automationLogPage: 1,
  automationLogsPerPage: 8,
  automationLogFingerprint: "",
  downloadContext: {
    notebookId: "",
    notebookUrl: "",
    notebookTitle: "",
    sources: [],
    selectedSourceIds: new Set(),
    filterKey: ""
  }
};

let audioPollTimer = null;
let globalLoadingDepth = 0;

function isZh() {
  return String(state.locale).toLowerCase().startsWith("zh");
}

function setStatus(message) {
  el.statusNode.textContent = String(message || "");
}

function showGlobalLoading(title = "", hint = "") {
  globalLoadingDepth += 1;
  if (el.globalLoadingTitle) {
    el.globalLoadingTitle.textContent = String(title || t(state.locale, "manager.globalLoadingTitle"));
  }
  if (el.globalLoadingHint) {
    el.globalLoadingHint.textContent = String(hint || t(state.locale, "manager.globalLoadingHint"));
  }
  el.globalLoading?.classList.add("active");
}

function hideGlobalLoading() {
  globalLoadingDepth = Math.max(0, globalLoadingDepth - 1);
  if (globalLoadingDepth === 0) {
    el.globalLoading?.classList.remove("active");
  }
}

async function withGlobalLoading(title, hint, task) {
  showGlobalLoading(title, hint);
  try {
    return await task();
  } finally {
    hideGlobalLoading();
  }
}

function hasDialogApi(dialogNode) {
  return Boolean(dialogNode && typeof dialogNode.showModal === "function" && typeof dialogNode.close === "function");
}

function showDialogCompat(dialogNode) {
  if (!dialogNode) return false;
  if (hasDialogApi(dialogNode)) {
    dialogNode.showModal();
    return true;
  }
  dialogNode.setAttribute("open", "");
  dialogNode.setAttribute("data-open-manual", "1");
  return false;
}

function closeDialogCompat(dialogNode, returnValue = "") {
  if (!dialogNode) return;
  if (hasDialogApi(dialogNode)) {
    dialogNode.close(returnValue);
    return;
  }
  dialogNode.returnValue = returnValue;
  dialogNode.removeAttribute("open");
  dialogNode.removeAttribute("data-open-manual");
  dialogNode.dispatchEvent(new Event("close"));
}

function normalizeDialogTitle(title) {
  const raw = String(title || "").trim();
  if (raw) return raw;
  return `${t(state.locale, "common.appName")} ${isZh() ? "提示" : "Notice"}`;
}

async function askTextDialog({
  title = "",
  message = "",
  label = "",
  defaultValue = "",
  placeholder = "",
  confirmText = "",
  cancelText = ""
} = {}) {
  const normalizedTitle = normalizeDialogTitle(title);
  const normalizedMessage = String(message || "").trim();
  const normalizedLabel = String(label || "").trim() || (isZh() ? "输入内容" : "Input");
  const normalizedConfirm = String(confirmText || "").trim() || (isZh() ? "确定" : "Confirm");
  const normalizedCancel = String(cancelText || "").trim() || (isZh() ? "取消" : "Cancel");
  if (!el.appDialog) return null;

  return new Promise((resolve) => {
    const cleanup = () => {
      el.appDialog.removeEventListener("close", handleClose);
      el.appDialogConfirm.removeEventListener("click", handleConfirmClick);
      el.appDialogCancel.removeEventListener("click", handleCancelClick);
      el.appDialogCloseTop.removeEventListener("click", handleCancelClick);
      el.appDialogInput.removeEventListener("keydown", handleInputKeydown);
    };
    const handleClose = () => {
      const ok = el.appDialog.returnValue === "confirm";
      const next = ok ? String(el.appDialogInput.value || "") : null;
      cleanup();
      resolve(next);
    };
    const handleConfirmClick = (event) => {
      event.preventDefault();
      closeDialogCompat(el.appDialog, "confirm");
    };
    const handleCancelClick = (event) => {
      event.preventDefault();
      closeDialogCompat(el.appDialog, "cancel");
    };
    const handleInputKeydown = (event) => {
      if (event.key !== "Enter") return;
      event.preventDefault();
      closeDialogCompat(el.appDialog, "confirm");
    };

    el.appDialogTitle.textContent = normalizedTitle;
    el.appDialogMessage.textContent = normalizedMessage;
    el.appDialogInputWrap.hidden = false;
    el.appDialogInputLabel.textContent = normalizedLabel;
    el.appDialogInput.value = String(defaultValue ?? "");
    el.appDialogInput.setAttribute("placeholder", String(placeholder || ""));
    el.appDialogPreview.hidden = true;
    el.appDialogPreview.textContent = "";
    el.appDialogCancel.hidden = false;
    el.appDialogCancel.textContent = normalizedCancel;
    el.appDialogConfirm.textContent = normalizedConfirm;

    el.appDialog.addEventListener("close", handleClose, { once: true });
    el.appDialogConfirm.addEventListener("click", handleConfirmClick);
    el.appDialogCancel.addEventListener("click", handleCancelClick);
    el.appDialogCloseTop.addEventListener("click", handleCancelClick);
    el.appDialogInput.addEventListener("keydown", handleInputKeydown);
    showDialogCompat(el.appDialog);
    setTimeout(() => el.appDialogInput.focus(), 0);
  });
}

async function showMessageDialog({
  title = "",
  message = "",
  detail = "",
  confirmText = ""
} = {}) {
  const normalizedTitle = normalizeDialogTitle(title);
  const normalizedMessage = String(message || "").trim();
  const normalizedDetail = String(detail || "");
  const normalizedConfirm = String(confirmText || "").trim() || (isZh() ? "关闭" : "Close");
  if (!el.appDialog) return;

  return new Promise((resolve) => {
    const cleanup = () => {
      el.appDialog.removeEventListener("close", handleClose);
      el.appDialogConfirm.removeEventListener("click", handleConfirmClick);
      el.appDialogCloseTop.removeEventListener("click", handleConfirmClick);
    };
    const handleClose = () => {
      cleanup();
      resolve();
    };
    const handleConfirmClick = (event) => {
      event.preventDefault();
      closeDialogCompat(el.appDialog, "confirm");
    };

    el.appDialogTitle.textContent = normalizedTitle;
    el.appDialogMessage.textContent = normalizedMessage;
    el.appDialogInputWrap.hidden = true;
    el.appDialogInput.value = "";
    el.appDialogInput.setAttribute("placeholder", "");
    el.appDialogPreview.hidden = false;
    el.appDialogPreview.textContent = normalizedDetail || normalizedMessage;
    el.appDialogCancel.hidden = true;
    el.appDialogConfirm.textContent = normalizedConfirm;

    el.appDialog.addEventListener("close", handleClose, { once: true });
    el.appDialogConfirm.addEventListener("click", handleConfirmClick);
    el.appDialogCloseTop.addEventListener("click", handleConfirmClick);
    showDialogCompat(el.appDialog);
    setTimeout(() => el.appDialogConfirm.focus(), 0);
  });
}

async function askConfirmDialog({
  title = "",
  message = "",
  detail = "",
  confirmText = "",
  cancelText = ""
} = {}) {
  const normalizedTitle = normalizeDialogTitle(title);
  const normalizedMessage = String(message || "").trim();
  const normalizedDetail = String(detail || "").trim();
  const normalizedConfirm = String(confirmText || "").trim() || (isZh() ? "确认" : "Confirm");
  const normalizedCancel = String(cancelText || "").trim() || (isZh() ? "取消" : "Cancel");
  if (!el.appDialog) return false;

  return new Promise((resolve) => {
    const cleanup = () => {
      el.appDialog.removeEventListener("close", handleClose);
      el.appDialogConfirm.removeEventListener("click", handleConfirmClick);
      el.appDialogCancel.removeEventListener("click", handleCancelClick);
      el.appDialogCloseTop.removeEventListener("click", handleCancelClick);
    };
    const handleClose = () => {
      cleanup();
      resolve(el.appDialog.returnValue === "confirm");
    };
    const handleConfirmClick = (event) => {
      event.preventDefault();
      closeDialogCompat(el.appDialog, "confirm");
    };
    const handleCancelClick = (event) => {
      event.preventDefault();
      closeDialogCompat(el.appDialog, "cancel");
    };

    el.appDialogTitle.textContent = normalizedTitle;
    el.appDialogMessage.textContent = normalizedMessage;
    el.appDialogInputWrap.hidden = true;
    el.appDialogInput.value = "";
    el.appDialogInput.setAttribute("placeholder", "");
    el.appDialogPreview.hidden = !normalizedDetail;
    el.appDialogPreview.textContent = normalizedDetail;
    el.appDialogCancel.hidden = false;
    el.appDialogCancel.textContent = normalizedCancel;
    el.appDialogConfirm.textContent = normalizedConfirm;

    el.appDialog.addEventListener("close", handleClose, { once: true });
    el.appDialogConfirm.addEventListener("click", handleConfirmClick);
    el.appDialogCancel.addEventListener("click", handleCancelClick);
    el.appDialogCloseTop.addEventListener("click", handleCancelClick);
    showDialogCompat(el.appDialog);
    setTimeout(() => el.appDialogConfirm.focus(), 0);
  });
}

function parseIntSafe(value, fallback) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

async function loadViewPrefs() {
  const data = await chrome.storage.local.get(VIEW_PREFS_KEY);
  const raw = data?.[VIEW_PREFS_KEY] || {};
  state.pageSize = [10, 20, 50, 100].includes(parseIntSafe(raw.pageSize, 20)) ? parseIntSafe(raw.pageSize, 20) : 20;
  state.sortField = ["title", "sources", "rules"].includes(String(raw.sortField || "")) ? String(raw.sortField) : "title";
  state.sortDirection = String(raw.sortDirection || "").toLowerCase() === "desc" ? "desc" : "asc";
  state.columnVisible = {
    sources: raw?.columnVisible?.sources !== false,
    collections: raw?.columnVisible?.collections !== false,
    lastEdited: raw?.columnVisible?.lastEdited !== false,
    audio: raw?.columnVisible?.audio !== false,
    tags: raw?.columnVisible?.tags !== false,
    rules: raw?.columnVisible?.rules !== false,
    ops: raw?.columnVisible?.ops !== false
  };
}

async function saveViewPrefs() {
  await chrome.storage.local.set({
    [VIEW_PREFS_KEY]: {
      pageSize: state.pageSize,
      sortField: state.sortField,
      sortDirection: state.sortDirection,
      columnVisible: state.columnVisible
    }
  });
}

function normalizeTheme(themeValue) {
  return String(themeValue || "").toLowerCase() === "light" ? "light" : "dark";
}

function renderThemeToggle() {
  if (!el.themeToggle) return;
  const toLight = state.theme === "dark";
  el.themeToggle.textContent = toLight ? "☀" : "🌙";
  const label = toLight
    ? t(state.locale, "manager.themeToLight")
    : t(state.locale, "manager.themeToDark");
  el.themeToggle.setAttribute("title", label);
  el.themeToggle.setAttribute("aria-label", label);
}

function setNavCount(view, count) {
  const target = el.navItems.find((node) => node.dataset.view === view);
  if (!target) return;
  const value = Number.isFinite(Number(count)) ? Number(count) : 0;
  target.dataset.count = String(Math.max(0, value));
}

function renderNavCounts() {
  const allSourcesCount = state.allSources.length || state.notebooks.reduce((sum, item) => sum + Number(item.sourceCount || 0), 0);
  setNavCount("notebooks", state.notebooks.length);
  setNavCount("allSources", allSourcesCount);
  setNavCount("documents", state.allDocuments.length);
  setNavCount("collections", state.collections.length);
  setNavCount("favorites", state.favorites.size);
  setNavCount("podcast", state.podcastFeedsCount);
}

async function applyTheme(themeValue, persist = true) {
  state.theme = normalizeTheme(themeValue);
  document.body.dataset.theme = state.theme;
  document.documentElement.style.colorScheme = state.theme;
  renderThemeToggle();
  if (persist) {
    await chrome.storage.local.set({ [THEME_PREF_KEY]: state.theme });
  }
}

async function loadThemePref() {
  const data = await chrome.storage.local.get(THEME_PREF_KEY);
  state.theme = normalizeTheme(data?.[THEME_PREF_KEY] || "light");
  await applyTheme(state.theme, false);
}

function formatTime(isoString) {
  return isoString ? new Date(isoString).toLocaleString() : t(state.locale, "common.never");
}

function formatScheduledTime(alarm) {
  if (!alarm?.scheduledTime) return t(state.locale, "common.notScheduled");
  return new Date(alarm.scheduledTime).toLocaleString();
}

function switchView(viewName) {
  el.navItems.forEach((item) => item.classList.toggle("active", item.dataset.view === viewName));
  el.views.forEach((view) => view.classList.toggle("active", view.dataset.view === viewName));
}

function switchBulkMethod(methodName) {
  const target = String(methodName || "links");
  el.bulkMethodButtons.forEach((button) => {
    button.classList.toggle("active", button.dataset.method === target);
  });
  el.bulkMethodPanels.forEach((panel) => {
    panel.classList.toggle("active", panel.dataset.methodPanel === target);
  });
}

async function withButtonLoading(button, loadingText, task) {
  const originalText = button.textContent;
  const wasDisabled = button.disabled;
  button.disabled = true;
  if (loadingText) button.textContent = loadingText;
  try {
    return await task();
  } finally {
    button.disabled = wasDisabled;
    button.textContent = originalText;
  }
}

function updateSelectionCount() {
  el.selectionCount.textContent = t(state.locale, "manager.selectedCount", { count: state.selected.size });
}

function dedupeUrls(values) {
  return [...new Set(values.map((v) => String(v || "").trim()).filter(Boolean))];
}

function getImportUrls() {
  return dedupeUrls(String(el.importUrlsTextarea.value || "").split(/\r?\n/));
}

function setImportUrls(urls) {
  el.importUrlsTextarea.value = dedupeUrls(urls).join("\n");
}

function appendImportUrls(urls) {
  setImportUrls([...getImportUrls(), ...urls]);
}

function getNotebookByUrl(url) {
  const normalized = normalizeNotebookUrl(url, "");
  return state.notebooks.find((item) => normalizeNotebookUrl(item.url, "") === normalized) || null;
}

function extractNotebookId(url) {
  const normalized = normalizeNotebookUrl(url, "");
  if (!normalized) return "";
  try {
    const parsed = new URL(normalized);
    const match = parsed.pathname.match(/^\/notebook\/([a-z0-9-]+)/i);
    return match?.[1] || "";
  } catch (_) {
    return "";
  }
}

function notebookDisplayName(url) {
  const notebook = getNotebookByUrl(url);
  if (!notebook) return url;
  const emoji = String(notebook.emoji || "").trim();
  return `${emoji ? `${emoji} ` : ""}${notebook.title}`;
}

function getNotebookTags(url) {
  const normalized = normalizeNotebookUrl(url, "");
  return Array.isArray(state.notebookTags?.[normalized]) ? state.notebookTags[normalized] : [];
}

function getAudioTask(url) {
  const normalized = normalizeNotebookUrl(url, "");
  return state.audioTasks?.[normalized] || { status: "idle" };
}

function getCollectionsForNotebook(url) {
  const normalized = normalizeNotebookUrl(url, "");
  return (state.collections || []).filter((item) => {
    const members = Array.isArray(item?.notebookUrls) ? item.notebookUrls : [];
    return members.some((member) => normalizeNotebookUrl(member, "") === normalized);
  });
}

function toSourceStatusText(statusCode) {
  if (statusCode === 3) return isZh() ? "异常" : "Error";
  if (statusCode === 1) return isZh() ? "处理中" : "Processing";
  if (statusCode === 2) return isZh() ? "已完成" : "Ready";
  if (statusCode === 0) return isZh() ? "正常" : "OK";
  return String(statusCode ?? "-");
}

function audioStatusLabel(status) {
  const keyMap = {
    generating: "manager.audioStatusGenerating",
    ready: "manager.audioStatusReady",
    error: "manager.audioStatusError",
    not_ready: "manager.audioStatusNotReady",
    idle: "manager.audioStatusIdle"
  };
  return t(state.locale, keyMap[status] || keyMap.idle);
}

function updateColumnToggles() {
  el.colSources.checked = !!state.columnVisible.sources;
  el.colCollections.checked = !!state.columnVisible.collections;
  el.colLastEdited.checked = !!state.columnVisible.lastEdited;
  el.colAudio.checked = !!state.columnVisible.audio;
  el.colTags.checked = !!state.columnVisible.tags;
  el.colRules.checked = !!state.columnVisible.rules;
  el.colOps.checked = !!state.columnVisible.ops;
}

function createOpButton(text, title, onClick, className = "") {
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = text;
  button.title = title;
  if (className) button.className = className;
  button.addEventListener("click", onClick);
  return button;
}

function filterRows() {
  const ruleCountMap = countRulesByUrl();
  const filtered = state.notebooks.filter((item) => {
    if (!state.searchKey) return true;
    const inSearch = String(item.title || "").toLowerCase().includes(state.searchKey)
      || String(item.url || "").toLowerCase().includes(state.searchKey);
    if (!inSearch) return false;
    return true;
  });

  state.filtered = filtered.filter((item) => {
    if (!state.tagFilterKey) return true;
    return getNotebookTags(item.url).some((tag) => String(tag).toLowerCase().includes(state.tagFilterKey));
  });

  state.filtered.sort((left, right) => {
    let result = 0;
    if (state.sortField === "sources") {
      result = Number(left.sourceCount || 0) - Number(right.sourceCount || 0);
    } else if (state.sortField === "rules") {
      result = Number(ruleCountMap.get(left.url) || 0) - Number(ruleCountMap.get(right.url) || 0);
    } else {
      result = String(left.title || "").localeCompare(String(right.title || ""), "zh-Hans-CN");
    }
    return state.sortDirection === "desc" ? -result : result;
  });

  const pageSize = Math.max(10, parseIntSafe(state.pageSize, 20));
  const total = state.filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  if (state.currentPage > totalPages) state.currentPage = totalPages;
  if (state.currentPage < 1) state.currentPage = 1;

  const start = (state.currentPage - 1) * pageSize;
  state.pagedRows = state.filtered.slice(start, start + pageSize);
  el.pageInfo.textContent = t(state.locale, "manager.pageInfo", {
    page: state.currentPage,
    total: totalPages,
    count: total
  });
  el.pagePrev.disabled = state.currentPage <= 1;
  el.pageNext.disabled = state.currentPage >= totalPages;
}

function countRulesByUrl() {
  const map = new Map();
  const targets = state.snapshot?.rule?.targets || [];
  for (const target of targets) {
    const key = normalizeNotebookUrl(target.notebookUrl || "", "");
    if (!key) continue;
    map.set(key, (map.get(key) || 0) + 1);
  }
  return map;
}
function renderNotebookOptions() {
  const options = state.notebooks.map((item) => `<option value="${item.url}">${item.title}</option>`).join("");
  el.targetNotebookSelect.innerHTML = options;
  el.podcastNotebookSelect.innerHTML = options;
  if (state.notebooks.length && !el.targetNotebookSelect.value) el.targetNotebookSelect.value = state.notebooks[0].url;
  if (state.notebooks.length && !el.podcastNotebookSelect.value) el.podcastNotebookSelect.value = state.notebooks[0].url;
}

function renderAutomation(snapshotValue) {
  if (!snapshotValue?.runtime) {
    el.autoResult.textContent = t(state.locale, "common.loading");
    el.autoLastRun.textContent = t(state.locale, "common.loading");
    el.autoLastSuccess.textContent = t(state.locale, "common.loading");
    el.autoNextRun.textContent = t(state.locale, "common.loading");
    el.autoMessage.textContent = t(state.locale, "manager.statusReading");
    el.automationToggleEnabledButton.textContent = "-";
    el.automationLogList.innerHTML = `<li class="empty">${t(state.locale, "manager.logsEmpty")}</li>`;
    if (el.automationLogPageInfo) {
      el.automationLogPageInfo.textContent = t(state.locale, "manager.pageInfo", {
        page: 1,
        total: 1,
        count: 0
      });
    }
    if (el.automationLogPrevButton) el.automationLogPrevButton.disabled = true;
    if (el.automationLogNextButton) el.automationLogNextButton.disabled = true;
    return;
  }

  const { runtime, alarm, rule } = snapshotValue;
  el.autoResult.textContent = localizeResult(state.locale, runtime.lastResult);
  el.autoLastRun.textContent = formatTime(runtime.lastRunAt);
  el.autoLastSuccess.textContent = formatTime(runtime.lastSuccessAt);
  el.autoNextRun.textContent = formatScheduledTime(alarm);
  el.autoMessage.textContent = runtime.lastErrorMessage || t(state.locale, "common.ready");
  el.automationToggleEnabledButton.textContent = rule?.enabled
    ? (isZh() ? "暂停定时" : "Pause Schedule")
    : (isZh() ? "恢复定时" : "Resume Schedule");

  const runs = Array.isArray(runtime.recentRuns) ? runtime.recentRuns : [];
  const fingerprint = runs.length ? `${runs[0]?.at || ""}|${runs.length}` : "0";
  if (state.automationLogFingerprint !== fingerprint) {
    state.automationLogFingerprint = fingerprint;
    state.automationLogPage = 1;
  }

  const pageSize = Math.max(1, parseIntSafe(el.automationLogsPerPage?.value || state.automationLogsPerPage, state.automationLogsPerPage));
  state.automationLogsPerPage = pageSize;
  if (el.automationLogsPerPage && el.automationLogsPerPage.value !== String(pageSize)) {
    el.automationLogsPerPage.value = String(pageSize);
  }

  const totalCount = runs.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  if (state.automationLogPage > totalPages) state.automationLogPage = totalPages;
  if (state.automationLogPage < 1) state.automationLogPage = 1;
  const start = (state.automationLogPage - 1) * pageSize;
  const pageRuns = runs.slice(start, start + pageSize);

  if (!runs.length) {
    el.automationLogList.innerHTML = `<li class="empty">${t(state.locale, "manager.logsEmpty")}</li>`;
  } else {
    el.automationLogList.innerHTML = pageRuns.map((entry) => `
      <li class="feed-item">
        <strong>${localizeMode(state.locale, entry.mode)} · ${localizeResult(state.locale, entry.result)}</strong>
        <span>${formatTime(entry.at)}</span>
        <span>${entry.message || "-"}</span>
      </li>
    `).join("");
  }

  if (el.automationLogPageInfo) {
    el.automationLogPageInfo.textContent = t(state.locale, "manager.pageInfo", {
      page: state.automationLogPage,
      total: totalPages,
      count: totalCount
    });
  }
  if (el.automationLogPrevButton) el.automationLogPrevButton.disabled = state.automationLogPage <= 1;
  if (el.automationLogNextButton) el.automationLogNextButton.disabled = state.automationLogPage >= totalPages;
}

function renderStats() {
  const totalSources = state.notebooks.reduce((sum, item) => sum + Number(item.sourceCount || 0), 0);
  const ruleCount = Array.isArray(state.snapshot?.rule?.targets) ? state.snapshot.rule.targets.length : 0;
  const cards = [
    ["manager.statsNotebooks", state.notebooks.length],
    ["manager.statsSources", totalSources],
    ["manager.statsRules", ruleCount],
    ["manager.statsFavorites", state.favorites.size],
    ["manager.statsCollections", state.collections.length],
    ["manager.statsTemplates", state.templates.length],
    ["manager.statsSelected", state.selected.size]
  ];

  el.statsGrid.innerHTML = cards.map(([key, value]) => `
    <article class="stat">
      <span>${t(state.locale, key)}</span>
      <strong>${value}</strong>
    </article>
  `).join("");
}

function renderTable() {
  filterRows();
  const ruleCount = countRulesByUrl();
  el.tableBody.innerHTML = "";

  document.querySelectorAll("th[data-col]").forEach((th) => {
    const key = th.dataset.col;
    th.style.display = state.columnVisible[key] === false ? "none" : "";
  });

  if (!state.pagedRows.length) {
    const emptyText = state.notebooks.length ? t(state.locale, "manager.tableEmptyNoMatch") : t(state.locale, "manager.tableEmptyNoData");
    el.tableBody.innerHTML = `<tr><td colspan="9" class="empty">${emptyText}</td></tr>`;
    updateSelectionCount();
    return;
  }

  state.pagedRows.forEach((item) => {
    const tr = document.createElement("tr");

    const checkboxTd = document.createElement("td");
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = state.selected.has(item.url);
    checkbox.addEventListener("change", () => {
      if (checkbox.checked) state.selected.add(item.url);
      else state.selected.delete(item.url);
      updateSelectionCount();
      renderStats();
    });
    checkboxTd.appendChild(checkbox);

    const titleTd = document.createElement("td");
    const titleWrap = document.createElement("div");
    titleWrap.className = "title-wrap";
    const titleText = document.createElement("span");
    const emoji = String(item.emoji || "").trim();
    titleText.textContent = `${emoji ? `${emoji} ` : ""}${item.title || "Untitled Notebook"}`;
    titleWrap.appendChild(titleText);

    const external = document.createElement("a");
    external.href = item.url;
    external.target = "_blank";
    external.rel = "noreferrer";
    external.className = "external-link";
    external.textContent = "↗";
    external.title = t(state.locale, "manager.openNewTab");
    titleWrap.appendChild(external);
    titleTd.appendChild(titleWrap);

    const sourceTd = document.createElement("td");
    sourceTd.dataset.col = "sources";
    sourceTd.style.display = state.columnVisible.sources ? "" : "none";
    const sourceWrap = document.createElement("div");
    sourceWrap.className = "source-cell";
    let sourceCountBtn;
    sourceCountBtn = createOpButton(
      String(Number(item.sourceCount || 0)),
      isZh() ? "查看来源列表" : "Open source list",
      () => withButtonLoading(sourceCountBtn, "…", () => openSourceDetailByNotebook(item)),
      "source-count-link"
    );
    let sourceDownloadBtn;
    sourceDownloadBtn = createOpButton(
      "↓",
      isZh() ? "下载来源内容" : "Download sources",
      () => withButtonLoading(sourceDownloadBtn, "…", async () => {
        openDownloadDialogForNotebook(item);
      }),
      "icon-btn"
    );
    sourceWrap.append(sourceCountBtn, sourceDownloadBtn);
    sourceTd.appendChild(sourceWrap);

    const tagsTd = document.createElement("td");
    tagsTd.dataset.col = "tags";
    tagsTd.style.display = state.columnVisible.tags ? "" : "none";
    const tags = getNotebookTags(item.url);
    const tagsWrap = document.createElement("div");
    tagsWrap.className = "tag-list";
    if (!tags.length) {
      const none = document.createElement("span");
      none.className = "tag-pill";
      none.textContent = "-";
      tagsWrap.appendChild(none);
    } else {
      tags.forEach((tag) => {
        const chip = document.createElement("button");
        chip.type = "button";
        chip.className = "tag-pill tag-pill-button";
        chip.title = `${t(state.locale, "manager.removeTag")}：${tag}`;
        chip.textContent = `${tag} ×`;
        chip.addEventListener("click", async () => {
          const nextTags = tags.filter((itemTag) => itemTag !== tag);
          await setNotebookTags(item.url, nextTags);
        });
        tagsWrap.appendChild(chip);
      });
    }
    const addTagBtn = createOpButton("+", t(state.locale, "manager.editTags"), () => addSingleTagFromRow(item.url), "icon-btn");
    const tagsInline = document.createElement("div");
    tagsInline.className = "tag-cell-actions";
    tagsInline.append(tagsWrap, addTagBtn);
    tagsTd.appendChild(tagsInline);

    const collectionsTd = document.createElement("td");
    collectionsTd.dataset.col = "collections";
    collectionsTd.style.display = state.columnVisible.collections ? "" : "none";
    const collectionWrap = document.createElement("div");
    collectionWrap.className = "collection-list";
    const joined = getCollectionsForNotebook(item.url);
    if (!joined.length) {
      const none = document.createElement("span");
      none.className = "tag-pill";
      none.textContent = isZh() ? "空" : "Empty";
      collectionWrap.appendChild(none);
    } else {
      joined.forEach((collection) => {
        const chip = document.createElement("button");
        chip.type = "button";
        chip.className = "tag-pill tag-pill-button";
        chip.title = `${t(state.locale, "manager.removeCollectionFromNotebook")}：${collection.name}`;
        chip.textContent = `${collection.name} ×`;
        chip.addEventListener("click", async () => {
          await removeNotebookFromCollection(collection.id, item.url).catch(showActionError);
        });
        collectionWrap.appendChild(chip);
      });
    }
    const quickCollectionBtn = createOpButton(
      "+",
      isZh() ? "创建/加入集合" : "Create/append collection",
      () => quickCreateCollectionForNotebook(item.url, item.title),
      "icon-btn"
    );
    const collectionsInline = document.createElement("div");
    collectionsInline.className = "tag-cell-actions";
    collectionsInline.append(collectionWrap, quickCollectionBtn);
    collectionsTd.appendChild(collectionsInline);

    const lastEditedTd = document.createElement("td");
    lastEditedTd.dataset.col = "lastEdited";
    lastEditedTd.style.display = state.columnVisible.lastEdited ? "" : "none";
    let lastEditedBtn;
    lastEditedBtn = createOpButton(
      item.lastEditedAt ? formatTime(item.lastEditedAt) : "-",
      isZh() ? "进入来源管理页" : "Open source manager",
      () => withButtonLoading(lastEditedBtn, "…", () => openSourceDetailByNotebook(item)),
      "source-count-link"
    );
    lastEditedTd.appendChild(lastEditedBtn);

    const audioTd = document.createElement("td");
    audioTd.dataset.col = "audio";
    audioTd.style.display = state.columnVisible.audio ? "" : "none";
    const audioOps = document.createElement("div");
    audioOps.className = "mini-actions";

    const playBtn = createOpButton("▶", t(state.locale, "manager.playAudio"), () => withButtonLoading(playBtn, "…", () => openAudioPlay(item.url)), "icon-btn");
    const dlBtn = createOpButton("↓", t(state.locale, "manager.downloadAudio"), () => withButtonLoading(dlBtn, "…", () => openAudioDownload(item.url)), "icon-btn");
    const syncBtn = createOpButton("+", t(state.locale, "manager.syncPodcast"), () => withButtonLoading(syncBtn, "…", () => syncAudioToPodcast(item.url, item.title)), "icon-btn");
    const genBtn = createOpButton("✦", t(state.locale, "manager.generateAudio"), () => withButtonLoading(genBtn, "…", () => generateAudio(item.url)), "icon-btn");

    [playBtn, dlBtn, syncBtn, genBtn].forEach((btn) => {
      btn.addEventListener("click", () => undefined);
      audioOps.appendChild(btn);
    });
    audioTd.appendChild(audioOps);
    const task = getAudioTask(item.url);
    const taskNode = document.createElement("div");
    taskNode.className = "audio-status";
    taskNode.textContent = audioStatusLabel(task.status || "idle");
    audioTd.appendChild(taskNode);

    const countTd = document.createElement("td");
    countTd.dataset.col = "rules";
    countTd.style.display = state.columnVisible.rules ? "" : "none";
    countTd.textContent = String(ruleCount.get(item.url) || 0);

    const opsTd = document.createElement("td");
    opsTd.dataset.col = "ops";
    opsTd.style.display = state.columnVisible.ops ? "" : "none";
    const ops = document.createElement("div");
    ops.className = "ops";
    const isFavorite = state.favorites.has(normalizeNotebookUrl(item.url, ""));

    let favoriteBtn;
    favoriteBtn = createOpButton(
      isFavorite ? "★" : "☆",
      isFavorite ? t(state.locale, "manager.unfavorite") : t(state.locale, "manager.favorite"),
      () => withButtonLoading(favoriteBtn, "…", () => toggleFavorite(item.url)),
      "icon-btn"
    );
    let openBtn;
    openBtn = createOpButton(
      t(state.locale, "manager.open"),
      t(state.locale, "manager.open"),
      () => withButtonLoading(openBtn, "…", () => openNotebook(item.url)),
      "tiny"
    );
    let addRuleBtn;
    addRuleBtn = createOpButton(
      t(state.locale, "manager.addRule"),
      t(state.locale, "manager.addRule"),
      () => withButtonLoading(addRuleBtn, "…", () => addRule(item.url, item.title)),
      "tiny"
    );
    let addSourceBtn;
    addSourceBtn = createOpButton(
      t(state.locale, "manager.addSource"),
      t(state.locale, "manager.addSource"),
      () => withButtonLoading(addSourceBtn, "…", () => addRuleWithPrompt(item.url)),
      "tiny"
    );
    let runNowBtn;
    runNowBtn = createOpButton(
      t(state.locale, "manager.runNow"),
      t(state.locale, "manager.runNow"),
      () => withButtonLoading(runNowBtn, "…", () => runNotebook(item.url)),
      "tiny"
    );

    ops.append(favoriteBtn, openBtn, addRuleBtn, addSourceBtn, runNowBtn);

    opsTd.appendChild(ops);
    tr.append(checkboxTd, titleTd, sourceTd, tagsTd, collectionsTd, lastEditedTd, audioTd, countTd, opsTd);
    el.tableBody.appendChild(tr);
  });

  updateSelectionCount();
}

async function loadNotebookSources(notebookUrl, force = false) {
  const response = await sendMessage({
    type: "FETCH_NOTEBOOK_SOURCES",
    notebookUrl,
    force
  }, 180000);
  state.snapshot = response.snapshot || state.snapshot;
  state.sourceDetail = {
    notebookId: response.notebookId || "",
    notebookUrl: response.notebookUrl || notebookUrl,
    notebookTitle: response.notebookTitle || getNotebookByUrl(notebookUrl)?.title || "",
    sources: Array.isArray(response.sources) ? response.sources : []
  };
  return state.sourceDetail;
}

function renderSourceDetail() {
  const detail = state.sourceDetail || { sources: [] };
  const emoji = getNotebookByUrl(detail.notebookUrl)?.emoji || "";
  el.sourceDetailTitle.textContent = `${emoji ? `${emoji} ` : ""}${detail.notebookTitle || (isZh() ? "来源管理" : "Source Management")}`;
  el.sourceDetailHint.textContent = `${detail.notebookUrl || ""} · ${(detail.sources || []).length} ${isZh() ? "个来源" : "sources"}`;
  const rows = Array.isArray(detail.sources) ? detail.sources : [];
  if (!rows.length) {
    el.sourceDetailBody.innerHTML = `<tr><td colspan="5" class="empty">${isZh() ? "暂无来源" : "No sources found."}</td></tr>`;
    return;
  }
  el.sourceDetailBody.innerHTML = "";
  rows.forEach((source) => {
    const tr = document.createElement("tr");
    const meta = getSourceMeta({
      notebookId: detail.notebookId,
      notebookUrl: detail.notebookUrl,
      sourceId: source.id,
      sourceUrl: source.sourceUrl || "",
      sourceName: source.name || ""
    });
    tr.dataset.highlight = meta.highlight || "none";
    const nameTd = document.createElement("td");
    const nameWrap = document.createElement("div");
    nameWrap.className = "source-name-cell";
    const nameText = document.createElement("div");
    nameText.textContent = source.name || "-";
    nameWrap.appendChild(nameText);
    if (meta.note) {
      const noteText = document.createElement("div");
      noteText.className = "source-note-preview";
      noteText.textContent = meta.note;
      nameWrap.appendChild(noteText);
    }
    nameTd.appendChild(nameWrap);
    const urlTd = document.createElement("td");
    if (source.sourceUrl) {
      const link = document.createElement("a");
      link.href = source.sourceUrl;
      link.target = "_blank";
      link.rel = "noreferrer";
      link.textContent = source.sourceUrl;
      urlTd.appendChild(link);
    } else {
      urlTd.textContent = "-";
    }
    const statusTd = document.createElement("td");
    statusTd.textContent = toSourceStatusText(source.statusCode);
    const updatedTd = document.createElement("td");
    updatedTd.textContent = source.updatedAt ? formatTime(source.updatedAt) : "-";
    const opsTd = document.createElement("td");
    const ops = document.createElement("div");
    ops.className = "mini-actions";
    ops.appendChild(createOpButton("✎", isZh() ? "编辑备注" : "Edit note", () => {
      editSourceNote({
        notebookId: detail.notebookId,
        notebookUrl: detail.notebookUrl,
        sourceId: source.id,
        sourceUrl: source.sourceUrl || "",
        sourceName: source.name || ""
      }).catch(showActionError);
    }, "icon-btn"));
    const highlightBtn = createOpButton("●", sourceHighlightLabel(meta.highlight), () => {
      cycleSourceHighlight({
        notebookId: detail.notebookId,
        notebookUrl: detail.notebookUrl,
        sourceId: source.id,
        sourceUrl: source.sourceUrl || "",
        sourceName: source.name || ""
      }).catch(showActionError);
    }, `icon-btn source-highlight-btn highlight-${meta.highlight || "none"}`);
    if (source.sourceUrl) {
      ops.appendChild(createOpButton(isZh() ? "打开" : "Open", isZh() ? "打开来源 URL" : "Open source URL", () => chrome.tabs.create({ url: source.sourceUrl, active: true }), "tiny"));
      ops.appendChild(createOpButton(isZh() ? "复制" : "Copy", isZh() ? "复制来源 URL" : "Copy URL", async () => {
        await navigator.clipboard.writeText(source.sourceUrl);
        setStatus(isZh() ? "来源 URL 已复制。" : "Source URL copied.");
      }, "tiny"));
    }
    ops.appendChild(highlightBtn);
    opsTd.appendChild(ops);
    tr.append(nameTd, urlTd, statusTd, updatedTd, opsTd);
    el.sourceDetailBody.appendChild(tr);
  });
}

async function openSourceDetailByNotebook(notebook) {
  const url = typeof notebook === "string" ? notebook : notebook?.url || "";
  const item = typeof notebook === "string" ? getNotebookByUrl(url) : notebook;
  if (!url) return;
  switchView("sourceDetail");
  setStatus(isZh() ? "正在读取来源列表..." : "Loading source list...");
  await loadNotebookSources(url, true);
  renderSourceDetail();
  setStatus(isZh() ? "来源列表已更新。" : "Source list updated.");
  if (item?.title && !state.sourceDetail.notebookTitle) {
    state.sourceDetail.notebookTitle = item.title;
  }
}

async function refreshAllSources(force = false) {
  state.allSourcesLoading = true;
  state.allSourcesError = "";
  renderAllSources();
  try {
    const response = await sendMessage({ type: "FETCH_ALL_SOURCES", force }, 600000);
    state.snapshot = response.snapshot || state.snapshot;
    state.allSources = Array.isArray(response.sources) ? response.sources : [];
    await loadSourceFolderData();
    const validKeys = new Set(state.allSources.map((row) => getAllSourceRowKey(row)));
    state.allSourcesSelected = new Set(
      [...state.allSourcesSelected].filter((key) => validKeys.has(key))
    );
  } catch (error) {
    state.allSourcesError = error?.message || "fetch_all_sources_failed";
    throw error;
  } finally {
    state.allSourcesLoading = false;
    renderAllSources();
  }
}

function getAllSourceRowKey(row) {
  const notebookId = String(row?.notebookId || extractNotebookId(row?.notebookUrl || "") || row?.notebookUrl || "").trim();
  const sourceId = String(row?.sourceId || "").trim();
  const fallback = String(row?.sourceName || row?.sourceUrl || "").trim().toLowerCase();
  return `${notebookId}::${sourceId || fallback}`;
}

async function loadSourceFolderData() {
  const payload = await sendMessage({
    type: "GET_FOLDERS",
    data: { folderType: "sources" }
  }, 90000).catch(() => ({ folders: [], assignments: {} }));
  state.sourceFolders = Array.isArray(payload?.folders) ? payload.folders : [];
  state.sourceFolderAssignments = payload?.assignments || {};
}

async function persistSourceFolderData() {
  const payload = await sendMessage({
    type: "SAVE_FOLDERS",
    data: {
      folderType: "sources",
      folders: state.sourceFolders || [],
      assignments: state.sourceFolderAssignments || {}
    }
  }, 90000);
  state.sourceFolders = Array.isArray(payload?.folders) ? payload.folders : state.sourceFolders;
  state.sourceFolderAssignments = payload?.assignments || state.sourceFolderAssignments;
}

function getAllSourcesCurrentFolderId(row) {
  const key = getAllSourceRowKey(row);
  return String(state.sourceFolderAssignments?.[key] || "");
}

function getAllSourcesFilteredRows() {
  const key = String(el.allSourcesSearchInput.value || "").trim().toLowerCase();
  const folderFilter = String(state.allSourcesFolderFilter || "all");
  return (state.allSources || []).filter((row) => {
    if (key) {
      const inSearch = [
        row.notebookTitle,
        row.sourceName,
        row.sourceUrl,
        row.gDocId,
        row.error
      ].some((value) => String(value || "").toLowerCase().includes(key));
      if (!inSearch) return false;
    }
    if (folderFilter === "all") return true;
    const folderId = getAllSourcesCurrentFolderId(row);
    if (folderFilter === "unfiled") return !folderId;
    return folderId === folderFilter;
  });
}

function renderAllSourcesFolders(rows) {
  if (!el.allSourcesFolderGrid) return;
  const countsByFolder = new Map();
  rows.forEach((row) => {
    const folderId = getAllSourcesCurrentFolderId(row);
    if (!folderId) return;
    countsByFolder.set(folderId, (countsByFolder.get(folderId) || 0) + 1);
  });
  const allCount = rows.length;
  const unfiledCount = rows.filter((row) => !getAllSourcesCurrentFolderId(row)).length;

  const cards = [
    {
      id: "all",
      name: isZh() ? "所有来源" : "All Sources",
      count: allCount
    },
    {
      id: "unfiled",
      name: isZh() ? "未归档" : "Unfiled",
      count: unfiledCount
    },
    ...state.sourceFolders.map((folder) => ({
      id: folder.id,
      name: folder.name,
      count: countsByFolder.get(folder.id) || 0
    }))
  ];

  el.allSourcesFolderGrid.innerHTML = cards.map((card) => `
    <button type="button" class="folder-card ${state.allSourcesFolderFilter === card.id ? "active" : ""}" data-folder-id="${card.id}">
      <strong>${card.name}</strong>
      <span>${card.count} ${isZh() ? "个来源" : "sources"}</span>
    </button>
  `).join("") + `
    <button type="button" id="allSourcesCreateFolderInline" class="folder-card create">
      <strong>${isZh() ? "新建集合" : "Create Collection"}</strong>
      <span>+</span>
    </button>
  `;

  el.allSourcesFolderGrid.querySelectorAll("button[data-folder-id]").forEach((button) => {
    button.addEventListener("click", () => {
      state.allSourcesFolderFilter = button.dataset.folderId || "all";
      state.allSourcesCurrentPage = 1;
      renderAllSources();
    });
  });
  const createButton = document.getElementById("allSourcesCreateFolderInline");
  if (createButton) {
    createButton.addEventListener("click", () => {
      withButtonLoading(createButton, isZh() ? "创建中..." : "Creating...", async () => {
        const name = await askTextDialog({
          title: isZh() ? "新建集合" : "Create Collection",
          message: isZh() ? "输入新集合名称：" : "Input collection name:",
          label: isZh() ? "集合名称" : "Collection Name",
          placeholder: isZh() ? "例如：待处理" : "For example: To Process"
        });
        if (name === null) return;
        const trimmed = String(name || "").trim();
        if (!trimmed) return;
        const exists = state.sourceFolders.some((item) => String(item.name || "").trim().toLowerCase() === trimmed.toLowerCase());
        if (!exists) {
          state.sourceFolders.push({ id: `folder_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`, name: trimmed });
          await persistSourceFolderData();
        }
        state.allSourcesFolderFilter = state.sourceFolders.find((item) => String(item.name || "").trim().toLowerCase() === trimmed.toLowerCase())?.id || state.allSourcesFolderFilter;
        renderAllSources();
      }).catch(showActionError);
    });
  }
}

function getSelectedAllSourcesRows() {
  const map = new Map((state.allSources || []).map((row) => [getAllSourceRowKey(row), row]));
  return [...state.allSourcesSelected].map((key) => map.get(key)).filter(Boolean);
}

function groupSourcesByNotebook(rows) {
  const grouped = new Map();
  rows.forEach((row) => {
    const notebookId = String(row.notebookId || extractNotebookId(row.notebookUrl || "") || "").trim();
    if (!notebookId) return;
    if (!grouped.has(notebookId)) {
      grouped.set(notebookId, {
        notebookId,
        notebookUrl: row.notebookUrl || "",
        notebookTitle: row.notebookTitle || "",
        sourceIds: [],
        sources: []
      });
    }
    const bucket = grouped.get(notebookId);
    if (row.sourceId) bucket.sourceIds.push(row.sourceId);
    bucket.sources.push({
      notebookId,
      notebookUrl: row.notebookUrl || "",
      sourceId: row.sourceId || "",
      sourceName: row.sourceName || "",
      sourceUrl: row.sourceUrl || "",
      gDocId: row.gDocId || "",
      isGDoc: Boolean(row.isGDoc)
    });
  });
  grouped.forEach((bucket) => {
    bucket.sourceIds = [...new Set(bucket.sourceIds.map((id) => String(id || "").trim()).filter(Boolean))];
  });
  return [...grouped.values()];
}

async function pickNotebookFromInput() {
  const guide = state.notebooks
    .slice(0, 25)
    .map((item) => `${item.title} | ${item.url}`)
    .join("\n");
  const input = await askTextDialog({
    title: isZh() ? "选择目标 Notebook" : "Pick Target Notebook",
    message: isZh() ? "输入目标 Notebook 标题关键词或完整 URL：" : "Input target notebook keyword or full URL:",
    label: isZh() ? "标题关键词 / URL" : "Title keyword / URL",
    placeholder: state.notebooks[0]?.title || "",
    defaultValue: state.notebooks[0]?.title || ""
  });
  if (input === null) return "";
  const raw = String(input || "").trim();
  if (!raw) return "";
  const byUrl = state.notebooks.find((item) => normalizeNotebookUrl(item.url, "") === normalizeNotebookUrl(raw, ""));
  if (byUrl) return byUrl.url;
  const lower = raw.toLowerCase();
  const byTitle = state.notebooks.find((item) => String(item.title || "").toLowerCase().includes(lower));
  if (byTitle) return byTitle.url;
  await showMessageDialog({
    title: isZh() ? "未找到 Notebook" : "Notebook Not Found",
    message: isZh() ? "没有匹配到目标 Notebook。" : "No target notebook matched.",
    detail: guide || "-"
  });
  return "";
}

async function handleAllSourcesDownloadSelected() {
  const selectedRows = getSelectedAllSourcesRows();
  if (!selectedRows.length) {
    setStatus(isZh() ? "请先选择来源。" : "Select sources first.");
    return;
  }
  const groups = groupSourcesByNotebook(selectedRows);
  let downloaded = 0;
  for (const group of groups) {
    if (!group.sourceIds.length) continue;
    const response = await sendMessage({
      type: "DOWNLOAD_SELECTED_SOURCES",
      notebookId: group.notebookId,
      notebookUrl: group.notebookUrl,
      sourceIds: group.sourceIds,
      format: "md"
    }, 180000);
    downloaded += Number(response.downloaded || 0);
  }
  setStatus(isZh() ? `已触发下载，共 ${downloaded} 个来源。` : `Download started for ${downloaded} sources.`);
}

async function handleAllSourcesCreateNotebookFromSelected() {
  const selectedRows = getSelectedAllSourcesRows();
  if (!selectedRows.length) {
    setStatus(isZh() ? "请先选择来源。" : "Select sources first.");
    return;
  }
  const title = await askTextDialog({
    title: isZh() ? "创建新笔记本" : "Create Notebook",
    message: isZh() ? "输入新笔记本名称：" : "Input new notebook title:",
    label: isZh() ? "笔记本名称" : "Notebook Title",
    defaultValue: `${isZh() ? "新建笔记本" : "New Notebook"} ${new Date().toLocaleDateString()}`
  });
  if (title === null) return;
  const payload = await sendMessage({
    type: "CREATE_NOTEBOOK_FROM_SOURCES",
    data: {
      title: String(title || "").trim(),
      sources: selectedRows.map((row) => ({
        notebookId: row.notebookId,
        sourceId: row.sourceId,
        sourceName: row.sourceName,
        sourceUrl: row.sourceUrl,
        gDocId: row.gDocId,
        isGDoc: row.isGDoc
      }))
    }
  }, 300000);
  await refreshAll(true);
  await refreshAllSources(true);
  setStatus(
    isZh()
      ? `已创建笔记本：${payload.notebookTitle || "-"}，导入 ${payload.result?.imported || 0}。`
      : `Notebook created: ${payload.notebookTitle || "-"}, imported ${payload.result?.imported || 0}.`
  );
}

async function handleAllSourcesAddToNotebook() {
  const selectedRows = getSelectedAllSourcesRows();
  if (!selectedRows.length) {
    setStatus(isZh() ? "请先选择来源。" : "Select sources first.");
    return;
  }
  const targetNotebookUrl = await pickNotebookFromInput();
  if (!targetNotebookUrl) return;
  const response = await sendMessage({
    type: "ADD_SOURCES_TO_NOTEBOOK",
    data: {
      targetNotebookUrl,
      sources: selectedRows.map((row) => ({
        notebookId: row.notebookId,
        sourceId: row.sourceId,
        sourceName: row.sourceName,
        sourceUrl: row.sourceUrl,
        gDocId: row.gDocId,
        isGDoc: row.isGDoc
      }))
    }
  }, 300000);
  const imported = response.result?.imported || 0;
  const failed = response.result?.failed?.length || 0;
  setStatus(isZh() ? `已添加来源：成功 ${imported}，失败 ${failed}。` : `Sources added: ${imported} success, ${failed} failed.`);
}

async function handleAllSourcesMoveFolder() {
  const selectedRows = getSelectedAllSourcesRows();
  if (!selectedRows.length) {
    setStatus(isZh() ? "请先选择来源。" : "Select sources first.");
    return;
  }
  const existing = state.sourceFolders.map((item) => item.name).join("\n");
  const name = await askTextDialog({
    title: isZh() ? "移动到集合" : "Move to Collection",
    message: isZh() ? "输入目标集合名称（可新建）：" : "Input target collection name (or create new):",
    label: isZh() ? "集合名称" : "Collection Name",
    placeholder: isZh() ? "例如：待处理" : "For example: To Process"
  });
  if (name === null) return;
  const trimmed = String(name || "").trim();
  if (!trimmed) return;

  let target = state.sourceFolders.find((item) => String(item.name || "").trim().toLowerCase() === trimmed.toLowerCase());
  if (!target) {
    target = { id: `folder_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`, name: trimmed };
    state.sourceFolders.push(target);
  }
  selectedRows.forEach((row) => {
    const key = getAllSourceRowKey(row);
    state.sourceFolderAssignments[key] = target.id;
  });
  await persistSourceFolderData();
  renderAllSources();
  setStatus(isZh() ? `已移动 ${selectedRows.length} 个来源到集合：${target.name}` : `Moved ${selectedRows.length} sources to ${target.name}.`);
  if (existing) void existing;
}

async function handleAllSourcesSyncGdocs(rows = null) {
  const selectedRows = rows || getSelectedAllSourcesRows();
  if (!selectedRows.length) {
    setStatus(isZh() ? "请先选择来源。" : "Select sources first.");
    return;
  }
  const gdocs = selectedRows.filter((row) => row.isGDoc && row.sourceId);
  if (!gdocs.length) {
    setStatus(isZh() ? "选中项里没有可同步的 Google 文档来源。" : "No Google Docs sources in selection.");
    return;
  }
  const grouped = groupSourcesByNotebook(gdocs);
  let synced = 0;
  let failed = 0;
  for (const group of grouped) {
    const response = await sendMessage({
      type: "SYNC_ALL_GDOCS",
      data: {
        notebookId: group.notebookId,
        sourceIds: group.sourceIds,
        skipTierCheck: true
      }
    }, 300000);
    synced += Number(response.syncedCount || 0);
    failed += Array.isArray(response.failed) ? response.failed.length : 0;
  }
  await refreshAllSources(true);
  setStatus(isZh() ? `Google 文档同步完成：成功 ${synced}，失败 ${failed}。` : `Google Docs sync finished: ${synced} success, ${failed} failed.`);
}

async function handleAllSourcesDelete(rows = null) {
  const selectedRows = rows || getSelectedAllSourcesRows();
  if (!selectedRows.length) {
    setStatus(isZh() ? "请先选择来源。" : "Select sources first.");
    return;
  }
  const confirmed = await askConfirmDialog({
    title: isZh() ? "删除来源" : "Delete Sources",
    message: isZh() ? `确认删除选中的 ${selectedRows.length} 个来源吗？` : `Delete ${selectedRows.length} selected sources?`,
    detail: isZh() ? "该操作无法撤销。" : "This action cannot be undone.",
    confirmText: isZh() ? "删除" : "Delete",
    cancelText: isZh() ? "取消" : "Cancel"
  });
  if (!confirmed) return;
  const groups = groupSourcesByNotebook(selectedRows);
  let deleted = 0;
  for (const group of groups) {
    if (!group.sourceIds.length) continue;
    await sendMessage({
      type: "DELETE_SOURCES",
      data: {
        notebookId: group.notebookId,
        sourceIds: group.sourceIds
      }
    }, 240000);
    deleted += group.sourceIds.length;
  }
  state.allSourcesSelected.clear();
  await refreshAllSources(true);
  setStatus(isZh() ? `已删除 ${deleted} 个来源。` : `Deleted ${deleted} sources.`);
}

async function handleAllSourcesDeleteBad() {
  const badRows = getAllSourcesFilteredRows().filter((row) => row.isBadSource || Number(row.statusCode) === 3 || row.error);
  if (!badRows.length) {
    setStatus(isZh() ? "当前没有可清理的异常来源。" : "No bad sources to delete.");
    return;
  }
  await handleAllSourcesDelete(badRows);
}

async function openSourcePreview(row) {
  if (!row?.sourceId) return;
  const payload = await sendMessage({
    type: "GET_SOURCE_CONTENT_FOR_PREVIEW",
    data: {
      notebookId: row.notebookId || "",
      notebookUrl: row.notebookUrl || "",
      sourceId: row.sourceId,
      format: "md"
    }
  }, 180000);
  await showMessageDialog({
    title: isZh() ? `来源预览：${row.sourceName || "-"}` : `Source Preview: ${row.sourceName || "-"}`,
    message: row.sourceUrl || row.notebookTitle || "-",
    detail: payload.formatted || payload.content || "-"
  });
}

function renderAllSources() {
  if (!el.allSourcesBody) return;
  const rows = getAllSourcesFilteredRows();
  state.allSourcesFiltered = rows;
  renderNavCounts();

  renderAllSourcesFolders(rows);

  if (el.allSourcesRowsPerPage && el.allSourcesRowsPerPage.value !== String(state.allSourcesPageSize)) {
    el.allSourcesRowsPerPage.value = String(state.allSourcesPageSize);
  }
  const pageSize = Math.max(20, parseIntSafe(el.allSourcesRowsPerPage.value || state.allSourcesPageSize, state.allSourcesPageSize));
  state.allSourcesPageSize = pageSize;
  const total = rows.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  if (state.allSourcesCurrentPage > totalPages) state.allSourcesCurrentPage = totalPages;
  const start = (state.allSourcesCurrentPage - 1) * pageSize;
  state.allSourcesPaged = rows.slice(start, start + pageSize);

  el.allSourcesSelectedCount.textContent = t(state.locale, "manager.selectedCount", { count: state.allSourcesSelected.size });
  el.allSourcesPageInfo.textContent = t(state.locale, "manager.pageInfo", {
    page: state.allSourcesCurrentPage,
    total: totalPages,
    count: total
  });
  el.allSourcesPrevPage.disabled = state.allSourcesCurrentPage <= 1;
  el.allSourcesNextPage.disabled = state.allSourcesCurrentPage >= totalPages;

  const pageKeys = state.allSourcesPaged.map((item) => getAllSourceRowKey(item));
  const selectedOnPage = pageKeys.filter((key) => state.allSourcesSelected.has(key)).length;
  el.allSourcesSelectAll.checked = pageKeys.length > 0 && selectedOnPage === pageKeys.length;
  el.allSourcesSelectAll.indeterminate = selectedOnPage > 0 && selectedOnPage < pageKeys.length;

  const selectedCount = state.allSourcesSelected.size;
  const hasBad = rows.some((row) => row.isBadSource || Number(row.statusCode) === 3 || row.error);
  [el.allSourcesSyncGdocsButton, el.allSourcesDownloadButton, el.allSourcesCreateNotebookButton, el.allSourcesAddToNotebookButton, el.allSourcesMoveFolderButton, el.allSourcesDeleteButton].forEach((btn) => {
    btn.disabled = selectedCount === 0;
  });
  el.allSourcesDeleteBadButton.disabled = !hasBad;

  if (state.allSourcesLoading) {
    el.allSourcesBody.innerHTML = `<tr><td colspan="9" class="empty">${isZh() ? "正在读取所有来源，请稍候..." : "Loading all sources, please wait..."}</td></tr>`;
    return;
  }

  if (!state.allSourcesPaged.length) {
    const emptyText = state.allSourcesError
      ? (isZh() ? `读取失败：${state.allSourcesError}` : `Load failed: ${state.allSourcesError}`)
      : (isZh() ? "暂无来源数据。" : "No source data.");
    el.allSourcesBody.innerHTML = `<tr><td colspan="9" class="empty">${emptyText}</td></tr>`;
    return;
  }

  el.allSourcesBody.innerHTML = "";
  state.allSourcesPaged.forEach((row) => {
    const tr = document.createElement("tr");
    const meta = getSourceMeta(row);
    tr.dataset.highlight = meta.highlight || "none";

    const checkTd = document.createElement("td");
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    const rowKey = getAllSourceRowKey(row);
    checkbox.checked = state.allSourcesSelected.has(rowKey);
    checkbox.addEventListener("change", () => {
      if (checkbox.checked) state.allSourcesSelected.add(rowKey);
      else state.allSourcesSelected.delete(rowKey);
      renderAllSources();
    });
    checkTd.appendChild(checkbox);

    const notebookTd = document.createElement("td");
    notebookTd.textContent = `${row.notebookEmoji ? `${row.notebookEmoji} ` : ""}${row.notebookTitle || "-"}`;

    const nameTd = document.createElement("td");
    const nameWrap = document.createElement("div");
    nameWrap.className = "source-name-cell";
    const nameMain = document.createElement("div");
    nameMain.className = "text-ellipsis";
    nameMain.textContent = row.sourceName || "-";
    nameWrap.appendChild(nameMain);
    if (meta.note) {
      const noteNode = document.createElement("div");
      noteNode.className = "source-note-preview";
      noteNode.textContent = meta.note;
      nameWrap.appendChild(noteNode);
    }
    nameTd.appendChild(nameWrap);

    const urlTd = document.createElement("td");
    urlTd.className = "text-ellipsis";
    if (row.sourceUrl) {
      const link = document.createElement("a");
      link.href = row.sourceUrl;
      link.target = "_blank";
      link.rel = "noreferrer";
      link.textContent = row.sourceUrl;
      urlTd.appendChild(link);
    } else {
      urlTd.textContent = row.gDocId || "-";
    }

    const tagsTd = document.createElement("td");
    const tagsWrap = document.createElement("div");
    tagsWrap.className = "tag-list";
    const tags = getNotebookTags(row.notebookUrl);
    if (!tags.length) {
      const none = document.createElement("span");
      none.className = "tag-pill";
      none.textContent = isZh() ? "空" : "Empty";
      tagsWrap.appendChild(none);
    } else {
      tags.forEach((tag) => {
        const chip = document.createElement("span");
        chip.className = "tag-pill";
        chip.textContent = tag;
        tagsWrap.appendChild(chip);
      });
    }
    tagsTd.appendChild(tagsWrap);

    const folderTd = document.createElement("td");
    const folderWrap = document.createElement("div");
    folderWrap.className = "tag-list";
    const folderId = getAllSourcesCurrentFolderId(row);
    const folder = state.sourceFolders.find((item) => item.id === folderId);
    const folderChip = document.createElement("button");
    folderChip.type = "button";
    folderChip.className = "tag-pill tag-pill-button";
    folderChip.textContent = folder ? `${folder.name} ×` : (isZh() ? "空" : "Empty");
    folderChip.title = folder
      ? (isZh() ? "点击移出集合" : "Remove from collection")
      : (isZh() ? "点击设置集合" : "Assign collection");
    folderChip.addEventListener("click", async () => {
      if (!folder) {
        state.allSourcesSelected.add(rowKey);
        renderAllSources();
        await handleAllSourcesMoveFolder().catch(showActionError);
        return;
      }
      delete state.sourceFolderAssignments[rowKey];
      await persistSourceFolderData();
      renderAllSources();
    });
    folderWrap.appendChild(folderChip);
    const folderPlusBtn = createOpButton("+", isZh() ? "设置集合" : "Set collection", async () => {
      state.allSourcesSelected.add(rowKey);
      renderAllSources();
      await handleAllSourcesMoveFolder().catch(showActionError);
    }, "icon-btn");
    const folderInline = document.createElement("div");
    folderInline.className = "tag-cell-actions";
    folderInline.append(folderWrap, folderPlusBtn);
    folderTd.appendChild(folderInline);

    const statusTd = document.createElement("td");
    statusTd.textContent = row.error ? row.error : toSourceStatusText(row.statusCode);

    const updatedTd = document.createElement("td");
    updatedTd.textContent = row.updatedAt ? formatTime(row.updatedAt) : "-";

    const opsTd = document.createElement("td");
    const ops = document.createElement("div");
    ops.className = "mini-actions";
    const openBtn = createOpButton("↗", isZh() ? "打开来源" : "Open source", () => {
      if (row.sourceUrl) chrome.tabs.create({ url: row.sourceUrl, active: true });
      else openSourceDetailByNotebook(row.notebookUrl);
    }, "icon-btn");
    const previewBtn = createOpButton("👁", isZh() ? "预览内容" : "Preview content", () => openSourcePreview(row).catch(showActionError), "icon-btn");
    const noteBtn = createOpButton("✎", isZh() ? "编辑备注" : "Edit note", () => {
      editSourceNote(row).catch(showActionError);
    }, "icon-btn");
    const highlightBtn = createOpButton("●", sourceHighlightLabel(meta.highlight), () => {
      cycleSourceHighlight(row).catch(showActionError);
    }, `icon-btn source-highlight-btn highlight-${meta.highlight || "none"}`);
    const downloadBtn = createOpButton("↓", isZh() ? "下载来源" : "Download source", () => {
      sendMessage({
        type: "DOWNLOAD_SELECTED_SOURCES",
        notebookId: row.notebookId,
        notebookUrl: row.notebookUrl,
        sourceIds: row.sourceId ? [row.sourceId] : [],
        format: "md"
      }, 180000)
        .then(() => setStatus(isZh() ? "来源下载已开始。" : "Source download started."))
        .catch(showActionError);
    }, "icon-btn");
    const deleteBtn = createOpButton("🗑", isZh() ? "删除来源" : "Delete source", () => {
      handleAllSourcesDelete([row]).catch(showActionError);
    }, "icon-btn");
    ops.append(openBtn, previewBtn, noteBtn, highlightBtn, downloadBtn);
    if (row.isGDoc && row.sourceId) {
      const syncBtn = createOpButton("⟳", isZh() ? "同步 GDocs" : "Sync GDocs", () => {
        handleAllSourcesSyncGdocs([row]).catch(showActionError);
      }, "icon-btn");
      ops.appendChild(syncBtn);
    }
    ops.appendChild(deleteBtn);
    opsTd.appendChild(ops);

    tr.append(checkTd, notebookTd, nameTd, urlTd, tagsTd, folderTd, statusTd, updatedTd, opsTd);
    el.allSourcesBody.appendChild(tr);
  });
}

async function refreshDocuments(force = false) {
  const response = await sendMessage({ type: "FETCH_DOCUMENTS", force }, 300000);
  state.snapshot = response.snapshot || state.snapshot;
  state.allDocuments = Array.isArray(response.documents) ? response.documents : [];
  const validKeys = new Set(state.allDocuments.map((doc) => getDocumentRowKey(doc)));
  state.documentsSelected = new Set([...state.documentsSelected].filter((key) => validKeys.has(key)));
  renderDocuments();
}

function getDocumentRowKey(doc) {
  const notebookId = String(doc?.notebookId || extractNotebookId(doc?.notebookUrl || "") || doc?.notebookUrl || "").trim();
  const docId = String(doc?.id || "").trim();
  const fallback = String(doc?.title || doc?.content || "").trim().toLowerCase();
  return `${notebookId}::${docId || fallback}`;
}

function getDocumentFilteredRows() {
  const key = String(state.documentsSearchKey || "").trim().toLowerCase();
  const typeFilter = String(state.documentsTypeFilter || "").trim().toLowerCase();
  return (state.allDocuments || []).filter((doc) => {
    if (typeFilter && String(doc.type || "Note").toLowerCase() !== typeFilter) return false;
    if (!key) return true;
    return [
      doc.notebookTitle,
      doc.title,
      doc.type,
      doc.content
    ].some((value) => String(value || "").toLowerCase().includes(key));
  });
}

function renderDocumentsTypeOptions() {
  if (!el.documentsTypeFilter) return;
  const current = String(state.documentsTypeFilter || "");
  const types = [...new Set((state.allDocuments || []).map((doc) => String(doc.type || "Note").trim()).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b, "zh-Hans-CN"));
  el.documentsTypeFilter.innerHTML = [
    `<option value="">${t(state.locale, "manager.documentsTypeAll")}</option>`,
    ...types.map((typeValue) => `<option value="${typeValue}">${typeValue}</option>`)
  ].join("");
  el.documentsTypeFilter.value = types.includes(current) ? current : "";
}

function downloadDocumentRow(doc) {
  const title = String(doc?.title || "Document").trim() || "Document";
  const notebook = String(doc?.notebookTitle || "").trim();
  const type = String(doc?.type || "Note").trim();
  const content = String(doc?.content || "").trim();
  const normalizedUrl = normalizeNotebookUrl(doc?.notebookUrl || "", "");
  const payload = [
    `# ${title}`,
    "",
    `Type: ${type || "-"}`,
    `Notebook: ${notebook || "-"}`,
    `Notebook URL: ${normalizedUrl || "-"}`,
    "",
    content || "-"
  ].join("\n");
  const blob = new Blob([payload], { type: "text/markdown;charset=utf-8" });
  const anchor = document.createElement("a");
  anchor.href = URL.createObjectURL(blob);
  anchor.download = `${title.replace(/[\\/:*?"<>|]/g, "_").slice(0, 80) || "document"}.md`;
  anchor.click();
  URL.revokeObjectURL(anchor.href);
}

function downloadSelectedDocuments() {
  const docMap = new Map((state.allDocuments || []).map((doc) => [getDocumentRowKey(doc), doc]));
  const selectedRows = [...state.documentsSelected].map((key) => docMap.get(key)).filter(Boolean);
  if (!selectedRows.length) {
    setStatus(isZh() ? "请先选择文档。" : "Select documents first.");
    return;
  }
  selectedRows.forEach((doc) => downloadDocumentRow(doc));
  setStatus(isZh() ? `已导出 ${selectedRows.length} 条文档。` : `Exported ${selectedRows.length} documents.`);
}

function renderDocuments() {
  renderDocumentsTypeOptions();

  const rows = getDocumentFilteredRows();
  state.documentsFiltered = rows;
  const pageSize = Math.max(20, parseIntSafe(el.documentsRowsPerPage?.value || state.documentsPageSize, state.documentsPageSize));
  state.documentsPageSize = pageSize;
  if (el.documentsRowsPerPage && el.documentsRowsPerPage.value !== String(pageSize)) {
    el.documentsRowsPerPage.value = String(pageSize);
  }

  const total = rows.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  if (state.documentsCurrentPage > totalPages) state.documentsCurrentPage = totalPages;
  if (state.documentsCurrentPage < 1) state.documentsCurrentPage = 1;
  const start = (state.documentsCurrentPage - 1) * pageSize;
  state.documentsPaged = rows.slice(start, start + pageSize);

  if (el.documentsSelectedCount) {
    el.documentsSelectedCount.textContent = t(state.locale, "manager.selectedCount", { count: state.documentsSelected.size });
  }
  if (el.documentsPageInfo) {
    el.documentsPageInfo.textContent = t(state.locale, "manager.pageInfo", {
      page: state.documentsCurrentPage,
      total: totalPages,
      count: total
    });
  }
  if (el.documentsPrevPage) el.documentsPrevPage.disabled = state.documentsCurrentPage <= 1;
  if (el.documentsNextPage) el.documentsNextPage.disabled = state.documentsCurrentPage >= totalPages;

  const pageKeys = state.documentsPaged.map((doc) => getDocumentRowKey(doc));
  const selectedOnPage = pageKeys.filter((key) => state.documentsSelected.has(key)).length;
  if (el.documentsSelectAll) {
    el.documentsSelectAll.checked = pageKeys.length > 0 && selectedOnPage === pageKeys.length;
    el.documentsSelectAll.indeterminate = selectedOnPage > 0 && selectedOnPage < pageKeys.length;
  }

  if (!state.documentsPaged.length) {
    el.documentsBody.innerHTML = `<tr><td colspan="6" class="empty">${isZh() ? "暂无文档数据。" : "No document data."}</td></tr>`;
    renderNavCounts();
    return;
  }
  el.documentsBody.innerHTML = "";
  state.documentsPaged.forEach((doc) => {
    const tr = document.createElement("tr");
    const checkTd = document.createElement("td");
    const checkbox = document.createElement("input");
    const rowKey = getDocumentRowKey(doc);
    checkbox.type = "checkbox";
    checkbox.checked = state.documentsSelected.has(rowKey);
    checkbox.addEventListener("change", () => {
      if (checkbox.checked) state.documentsSelected.add(rowKey);
      else state.documentsSelected.delete(rowKey);
      renderDocuments();
    });
    checkTd.appendChild(checkbox);

    const notebookTd = document.createElement("td");
    notebookTd.textContent = doc.notebookTitle || "-";
    const titleTd = document.createElement("td");
    titleTd.textContent = doc.title || "-";
    const typeTd = document.createElement("td");
    typeTd.textContent = doc.type || "Note";
    const updatedTd = document.createElement("td");
    updatedTd.textContent = doc.updatedAt ? formatTime(doc.updatedAt) : "-";
    const opsTd = document.createElement("td");
    const ops = document.createElement("div");
    ops.className = "mini-actions";
    ops.appendChild(createOpButton(
      isZh() ? "打开Notebook" : "Open Notebook",
      isZh() ? "打开所在 Notebook" : "Open notebook",
      () => openNotebook(doc.notebookUrl),
      "tiny"
    ));
    ops.appendChild(createOpButton(
      isZh() ? "预览" : "Preview",
      isZh() ? "预览文档内容" : "Preview document",
      () => showMessageDialog({
        title: doc.title || (isZh() ? "文档预览" : "Document Preview"),
        message: `${doc.notebookTitle || "-"} | ${doc.type || "Note"}`,
        detail: String(doc.content || "-")
      }),
      "tiny"
    ));
    ops.appendChild(createOpButton(
      isZh() ? "下载" : "Download",
      isZh() ? "下载文档" : "Download document",
      () => downloadDocumentRow(doc),
      "tiny"
    ));
    if (doc.content && /^https?:\/\//i.test(String(doc.content))) {
      ops.appendChild(createOpButton(
        isZh() ? "打开内容" : "Open Content",
        isZh() ? "在新标签打开内容 URL" : "Open content URL",
        () => chrome.tabs.create({ url: doc.content, active: true }),
        "tiny"
      ));
    }
    opsTd.appendChild(ops);
    tr.append(checkTd, notebookTd, titleTd, typeTd, updatedTd, opsTd);
    el.documentsBody.appendChild(tr);
  });
  renderNavCounts();
}

function renderMerge() {
  const key = String(state.mergeSearchKey || "").trim().toLowerCase();
  const rows = (state.notebooks || []).filter((item) => {
    if (!key) return true;
    return String(item.title || "").toLowerCase().includes(key)
      || String(item.url || "").toLowerCase().includes(key);
  });
  if (!rows.length) {
    el.mergeBody.innerHTML = `<tr><td colspan="3" class="empty">${isZh() ? "暂无 notebook。" : "No notebooks."}</td></tr>`;
    if (el.mergeSelectedInfo) {
      el.mergeSelectedInfo.textContent = t(state.locale, "manager.selectedCount", { count: state.mergeSelected.size });
    }
    return;
  }

  if (el.mergeSelectAll) {
    const selectedOnPage = rows.filter((item) => state.mergeSelected.has(item.url)).length;
    el.mergeSelectAll.checked = rows.length > 0 && selectedOnPage === rows.length;
    el.mergeSelectAll.indeterminate = selectedOnPage > 0 && selectedOnPage < rows.length;
  }

  el.mergeBody.innerHTML = "";
  rows.forEach((item) => {
    const tr = document.createElement("tr");
    const checkTd = document.createElement("td");
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = state.mergeSelected.has(item.url);
    checkbox.addEventListener("change", () => {
      if (checkbox.checked) state.mergeSelected.add(item.url);
      else state.mergeSelected.delete(item.url);
      renderMerge();
    });
    checkTd.appendChild(checkbox);
    const titleTd = document.createElement("td");
    titleTd.textContent = `${item.emoji ? `${item.emoji} ` : ""}${item.title}`;
    const sourceTd = document.createElement("td");
    sourceTd.textContent = String(item.sourceCount || 0);
    tr.append(checkTd, titleTd, sourceTd);
    el.mergeBody.appendChild(tr);
  });

  if (el.mergeSelectedInfo) {
    el.mergeSelectedInfo.textContent = t(state.locale, "manager.selectedCount", { count: state.mergeSelected.size });
  }
}

async function performMergeSelected() {
  const notebookUrls = [...state.mergeSelected];
  if (notebookUrls.length < 2) {
    setStatus(isZh() ? "至少选择 2 个 notebook 才能合并。" : "Select at least 2 notebooks to merge.");
    return;
  }
  const response = await withGlobalLoading(
    t(state.locale, "manager.globalLoadingTitle"),
    isZh() ? "正在合并笔记本..." : "Merging notebooks...",
    () => sendMessage({
      type: "MERGE_NOTEBOOKS",
      notebookUrls,
      newTitle: String(el.mergeTitleInput.value || "").trim(),
      deleteOriginal: Boolean(el.mergeDeleteOriginal.checked)
    }, 300000)
  );
  state.snapshot = response.snapshot || state.snapshot;
  setStatus(isZh()
    ? `合并完成：${response.result?.notebookTitle || "-"}，导入 ${response.result?.importedSourceCount || 0} 个来源。`
    : `Merge completed: ${response.result?.notebookTitle || "-"}, imported ${response.result?.importedSourceCount || 0} sources.`);
  state.mergeSelected.clear();
  await refreshAll(true);
  switchView("notebooks");
}

async function quickCreateCollectionForNotebook(url, fallbackTitle = "") {
  const defaultName = `${fallbackTitle || (isZh() ? "新集合" : "New Collection")} ${new Date().toLocaleDateString()}`;
  const existing = (state.collections || []).map((item) => item.name).filter(Boolean);
  const hint = isZh()
    ? `输入集合名（已存在则加入，不存在则新建）。${existing.length ? `\n现有：${existing.join("、")}` : ""}`
    : `Input collection name (existing to append, new to create).${existing.length ? `\nExisting: ${existing.join(", ")}` : ""}`;
  const input = await askTextDialog({
    title: t(state.locale, "manager.batchCreateCollection"),
    message: hint,
    label: t(state.locale, "manager.promptCollectionName"),
    defaultValue: defaultName
  });
  if (input === null) return;
  const name = String(input || "").trim() || defaultName;
  const matched = (state.collections || []).find((item) => String(item.name || "").trim() === name);
  if (matched) {
    const merged = dedupeUrls([...(matched.notebookUrls || []), url]);
    await upsertCollectionMembers(matched, merged, matched.name);
    setStatus(t(state.locale, "manager.statusCollectionMembersUpdated", { name: matched.name, count: merged.length }));
    return;
  }
  const response = await sendMessage({
    type: "SAVE_COLLECTION",
    payload: { name, notebookUrls: [url] }
  }, 120000);
  state.collections = Array.isArray(response.collections) ? response.collections : [];
  renderCollections();
  bindCollectionAndTemplateActions();
  renderTable();
  renderStats();
  setStatus(t(state.locale, "manager.statusCollectionSaved", { name }));
}

function getSelectedDownloadFormat() {
  const selected = document.querySelector("input[name='downloadFormat']:checked");
  return String(selected?.value || "md");
}

function renderDownloadSourceList() {
  const context = state.downloadContext;
  const filterKey = String(context.filterKey || "").toLowerCase();
  const rows = (context.sources || []).filter((source) => {
    if (!filterKey) return true;
    return [
      source.name,
      source.sourceUrl
    ].some((value) => String(value || "").toLowerCase().includes(filterKey));
  });
  if (!rows.length) {
    el.downloadSourceList.innerHTML = `<div class="empty">${isZh() ? "没有匹配来源。" : "No matched source."}</div>`;
    return;
  }
  el.downloadSourceList.innerHTML = "";
  rows.forEach((source) => {
    const item = document.createElement("label");
    item.className = "download-source-item";
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = context.selectedSourceIds.has(source.id);
    checkbox.addEventListener("change", () => {
      if (checkbox.checked) context.selectedSourceIds.add(source.id);
      else context.selectedSourceIds.delete(source.id);
    });
    const body = document.createElement("div");
    const title = document.createElement("strong");
    title.textContent = source.name || source.id;
    const meta = document.createElement("div");
    meta.className = "meta";
    meta.textContent = source.sourceUrl || "-";
    body.append(title, meta);
    item.append(checkbox, body);
    el.downloadSourceList.appendChild(item);
  });
}

function openDownloadDialogForNotebook(notebook) {
  const url = typeof notebook === "string" ? notebook : notebook?.url || "";
  const item = typeof notebook === "string" ? getNotebookByUrl(url) : notebook;
  if (!url) return;
  const detail = state.sourceDetail;
  const useSources = compareNotebookUrl(url, detail.notebookUrl) ? detail.sources : [];
  state.downloadContext = {
    notebookId: item?.id || detail.notebookId || "",
    notebookUrl: url,
    notebookTitle: item?.title || detail.notebookTitle || "",
    sources: Array.isArray(useSources) ? useSources : [],
    selectedSourceIds: new Set((useSources || []).map((source) => source.id).filter(Boolean)),
    filterKey: ""
  };

  const ensureOpen = async () => {
    if (!state.downloadContext.sources.length) {
      const payload = await loadNotebookSources(url, true);
      state.downloadContext.sources = payload.sources || [];
      state.downloadContext.selectedSourceIds = new Set((payload.sources || []).map((source) => source.id).filter(Boolean));
    }
    el.downloadFilterInput.value = "";
    renderDownloadSourceList();
    showDialogCompat(el.downloadDialog);
  };

  ensureOpen().catch((error) => setStatus(t(state.locale, "common.actionFailed", { message: error?.message || "open_download_dialog_failed" })));
}

async function previewDownloadSources() {
  const sourceIds = [...state.downloadContext.selectedSourceIds];
  if (!sourceIds.length) {
    setStatus(isZh() ? "请至少选择 1 个来源。" : "Select at least one source.");
    return;
  }
  const lines = sourceIds
    .map((id) => (state.downloadContext.sources || []).find((item) => item.id === id))
    .filter(Boolean)
    .map((item, index) => `${index + 1}. ${item.name || "-"}\n${item.sourceUrl || "-"}`)
    .join("\n\n");
  await showMessageDialog({
    title: t(state.locale, "manager.previewDownload"),
    message: isZh() ? "来源预览" : "Source Preview",
    detail: lines || (isZh() ? "暂无可预览内容。" : "Nothing to preview.")
  });
}

async function downloadSelectedSourcesFromDialog() {
  const sourceIds = [...state.downloadContext.selectedSourceIds];
  if (!sourceIds.length) {
    setStatus(isZh() ? "请至少选择 1 个来源。" : "Select at least one source.");
    return;
  }
  const response = await sendMessage({
    type: "DOWNLOAD_SELECTED_SOURCES",
    notebookUrl: state.downloadContext.notebookUrl,
    notebookId: state.downloadContext.notebookId,
    sourceIds,
    format: getSelectedDownloadFormat()
  });
  state.snapshot = response.snapshot || state.snapshot;
  closeDialogCompat(el.downloadDialog, "confirm");
  setStatus(isZh()
    ? `已下载 ${response.downloaded || sourceIds.length} 个来源（${response.format || getSelectedDownloadFormat()}）。`
    : `Downloaded ${response.downloaded || sourceIds.length} sources (${response.format || getSelectedDownloadFormat()}).`);
}

function compareNotebookUrl(left, right) {
  return normalizeNotebookUrl(left || "", "") === normalizeNotebookUrl(right || "", "");
}

function renderFavorites() {
  const urls = [...state.favorites];
  if (!urls.length) {
    el.favoritesList.innerHTML = `<li class="empty">${t(state.locale, "manager.favoritesEmpty")}</li>`;
    renderNavCounts();
    return;
  }
  el.favoritesList.innerHTML = urls.map((url) => `
    <li class="feed-item">
      <strong>${notebookDisplayName(url)}</strong>
      <span>${url}</span>
      <div class="feed-ops">
        <button data-open="${url}">${t(state.locale, "manager.open")}</button>
        <button data-run="${url}">${t(state.locale, "manager.runNow")}</button>
        <button data-unfav="${url}">${t(state.locale, "manager.unfavorite")}</button>
      </div>
    </li>
  `).join("");

  el.favoritesList.querySelectorAll("button[data-open]").forEach((btn) => btn.addEventListener("click", () => openNotebook(btn.dataset.open || "")));
  el.favoritesList.querySelectorAll("button[data-run]").forEach((btn) => btn.addEventListener("click", () => runNotebook(btn.dataset.run || "")));
  el.favoritesList.querySelectorAll("button[data-unfav]").forEach((btn) => btn.addEventListener("click", () => toggleFavorite(btn.dataset.unfav || "")));
  renderNavCounts();
}

function renderCollections() {
  if (!state.collections.length) {
    el.collectionsList.innerHTML = `<li class="empty">${t(state.locale, "manager.collectionsEmpty")}</li>`;
    renderNavCounts();
    return;
  }
  el.collectionsList.innerHTML = state.collections.map((collection) => `
    <li class="feed-item">
      <strong>${collection.name}</strong>
      <span>${collection.notebookUrls.length} notebook(s)</span>
      <span>${collection.notebookUrls.map((url) => notebookDisplayName(url)).join(" | ")}</span>
      <div class="feed-ops">
        <button data-select="${collection.id}">${t(state.locale, "manager.useCollectionSelection")}</button>
        <button data-rename="${collection.id}">${t(state.locale, "manager.renameCollection")}</button>
        <button data-replace="${collection.id}">${t(state.locale, "manager.replaceCollectionWithSelected")}</button>
        <button data-append="${collection.id}">${t(state.locale, "manager.appendSelectedToCollection")}</button>
        <button data-remove="${collection.id}">${t(state.locale, "manager.removeSelectedFromCollection")}</button>
        <button data-rules="${collection.id}">${t(state.locale, "manager.addCollectionToRules")}</button>
        <button data-run="${collection.id}">${t(state.locale, "manager.runCollectionNow")}</button>
        <button data-delete="${collection.id}">${t(state.locale, "manager.deleteCollection")}</button>
      </div>
    </li>
  `).join("");
  renderNavCounts();
}

function renderTemplates() {
  if (!state.templates.length) {
    el.templatesList.innerHTML = `<li class="empty">${t(state.locale, "manager.templatesEmpty")}</li>`;
    return;
  }
  el.templatesList.innerHTML = state.templates.map((template) => `
    <li class="feed-item">
      <strong>${template.name}</strong>
      <span>${template.sourceLabels.join(" | ")}</span>
      <span>${template.refreshLabel || "-"}</span>
      <div class="feed-ops">
        <button data-edit="${template.id}">${t(state.locale, "manager.editTemplate")}</button>
        <button data-apply="${template.id}">${t(state.locale, "manager.applyTemplateToSelected")}</button>
        <button data-delete="${template.id}">${t(state.locale, "manager.deleteTemplate")}</button>
      </div>
    </li>
  `).join("");
}
function bindCollectionAndTemplateActions() {
  const selectedNormalizedUrls = () => selectedUrls()
    .map((url) => normalizeNotebookUrl(url, ""))
    .filter(Boolean);

  const saveCollectionMembers = async (collection, notebookUrls, name = collection.name) => {
    if (!collection) return false;
    const uniqueUrls = dedupeUrls(notebookUrls).map((url) => normalizeNotebookUrl(url, "")).filter(Boolean);
    if (!uniqueUrls.length) {
      setStatus(t(state.locale, "manager.statusCollectionCannotEmpty"));
      return false;
    }
    const response = await sendMessage({
      type: "SAVE_COLLECTION",
      payload: {
        id: collection.id,
        createdAt: collection.createdAt,
        name,
        notebookUrls: uniqueUrls
      }
    });
    state.collections = Array.isArray(response.collections) ? response.collections : [];
    renderCollections();
    bindCollectionAndTemplateActions();
    renderStats();
    return true;
  };

  el.collectionsList.querySelectorAll("button[data-select]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const item = state.collections.find((collection) => collection.id === btn.dataset.select);
      if (!item) return;
      state.selected = new Set(item.notebookUrls);
      switchView("notebooks");
      renderTable();
      renderStats();
      setStatus(t(state.locale, "manager.statusCollectionSelection", { name: item.name }));
    });
  });

  el.collectionsList.querySelectorAll("button[data-rename]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const item = state.collections.find((collection) => collection.id === btn.dataset.rename);
      if (!item) return;
      const input = await askTextDialog({
        title: t(state.locale, "manager.renameCollection"),
        message: t(state.locale, "manager.promptCollectionName"),
        label: t(state.locale, "manager.promptCollectionName"),
        defaultValue: item.name || ""
      });
      if (input === null) return;
      const nextName = String(input || "").trim() || item.name;
      if (!nextName || nextName === item.name) return;
      const ok = await saveCollectionMembers(item, item.notebookUrls, nextName);
      if (ok) setStatus(t(state.locale, "manager.statusCollectionRenamed", { name: nextName }));
    });
  });

  el.collectionsList.querySelectorAll("button[data-replace]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const item = state.collections.find((collection) => collection.id === btn.dataset.replace);
      if (!item) return;
      const urls = selectedNormalizedUrls();
      if (!urls.length) return setStatus(t(state.locale, "manager.statusNoSelection"));
      const ok = await saveCollectionMembers(item, urls, item.name);
      if (ok) setStatus(t(state.locale, "manager.statusCollectionMembersUpdated", { name: item.name, count: urls.length }));
    });
  });

  el.collectionsList.querySelectorAll("button[data-append]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const item = state.collections.find((collection) => collection.id === btn.dataset.append);
      if (!item) return;
      const urls = selectedNormalizedUrls();
      if (!urls.length) return setStatus(t(state.locale, "manager.statusNoSelection"));
      const merged = dedupeUrls([...(item.notebookUrls || []), ...urls]);
      const ok = await saveCollectionMembers(item, merged, item.name);
      if (ok) setStatus(t(state.locale, "manager.statusCollectionMembersUpdated", { name: item.name, count: merged.length }));
    });
  });

  el.collectionsList.querySelectorAll("button[data-remove]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const item = state.collections.find((collection) => collection.id === btn.dataset.remove);
      if (!item) return;
      const urls = selectedNormalizedUrls();
      if (!urls.length) return setStatus(t(state.locale, "manager.statusNoSelection"));
      const selectedSet = new Set(urls);
      const nextMembers = (item.notebookUrls || []).filter((url) => !selectedSet.has(normalizeNotebookUrl(url, "")));
      const removed = (item.notebookUrls || []).length - nextMembers.length;
      if (removed <= 0) return setStatus(t(state.locale, "manager.statusCollectionNoChange"));
      const ok = await saveCollectionMembers(item, nextMembers, item.name);
      if (ok) setStatus(t(state.locale, "manager.statusCollectionMembersRemoved", { name: item.name, count: removed }));
    });
  });

  el.collectionsList.querySelectorAll("button[data-rules]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const item = state.collections.find((collection) => collection.id === btn.dataset.rules);
      if (!item) return;
      for (const url of item.notebookUrls) {
        await addRule(url, notebookDisplayName(url));
      }
      setStatus(t(state.locale, "manager.statusCollectionRuleAdded", { name: item.name }));
    });
  });

  el.collectionsList.querySelectorAll("button[data-run]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const item = state.collections.find((collection) => collection.id === btn.dataset.run);
      if (!item) return;
      for (const url of item.notebookUrls) {
        await runNotebook(url);
      }
      setStatus(t(state.locale, "manager.statusCollectionRunTriggered", { name: item.name }));
    });
  });

  el.collectionsList.querySelectorAll("button[data-delete]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const response = await sendMessage({ type: "DELETE_COLLECTION", id: btn.dataset.delete || "" });
      state.collections = Array.isArray(response.collections) ? response.collections : [];
      renderCollections();
      bindCollectionAndTemplateActions();
      renderStats();
      setStatus(t(state.locale, "manager.statusCollectionDeleted"));
    });
  });

  el.templatesList.querySelectorAll("button[data-apply]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const urls = [...state.selected].map((url) => normalizeNotebookUrl(url, "")).filter(Boolean);
      if (!urls.length) return setStatus(t(state.locale, "manager.statusNoSelection"));
      const response = await sendMessage({
        type: "APPLY_TEMPLATE_TO_NOTEBOOKS",
        templateId: btn.dataset.apply || "",
        notebookUrls: urls
      });
      state.snapshot = response.snapshot;
      renderTable();
      renderAutomation(state.snapshot);
      renderStats();
      setStatus(t(state.locale, "manager.statusTemplateApplied", { count: response.added || 0 }));
    });
  });

  el.templatesList.querySelectorAll("button[data-edit]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const template = state.templates.find((item) => item.id === btn.dataset.edit);
      if (!template) return;
      state.editingTemplateId = template.id;
      el.templateNameInput.value = template.name || "";
      el.templateSourcesInput.value = (template.sourceLabels || []).join("\n");
      el.templateRefreshLabelInput.value = template.refreshLabel || "";
      el.cancelTemplateEditButton.style.display = "";
      setStatus(t(state.locale, "manager.statusTemplateEditing", { name: template.name || "-" }));
    });
  });

  el.templatesList.querySelectorAll("button[data-delete]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      if (state.editingTemplateId && state.editingTemplateId === (btn.dataset.delete || "")) {
        resetTemplateEditor();
      }
      const response = await sendMessage({ type: "DELETE_TEMPLATE", id: btn.dataset.delete || "" });
      state.templates = Array.isArray(response.templates) ? response.templates : [];
      renderTemplates();
      bindCollectionAndTemplateActions();
      renderStats();
      setStatus(t(state.locale, "manager.statusTemplateDeleted"));
    });
  });
}

function renderPodcastFeeds(feeds) {
  state.podcastFeedsCount = Array.isArray(feeds) ? feeds.length : 0;
  if (!feeds.length) {
    el.podcastFeedList.innerHTML = `<li class="empty">${t(state.locale, "manager.podcastEmpty")}</li>`;
    renderNavCounts();
    return;
  }

  el.podcastFeedList.innerHTML = feeds.map((feed) => `
    <li class="feed-item">
      <strong>${feed.title}</strong>
      <span>${feed.notebookUrl}</span>
      <span>${isZh() ? "条目数" : "Items"}: ${Array.isArray(feed.items) ? feed.items.length : 0}</span>
      <div class="feed-ops">
        <button data-copy="${feed.id}">${isZh() ? "复制 RSS XML" : "Copy RSS XML"}</button>
        <button data-download="${feed.id}">${isZh() ? "下载 RSS" : "Download RSS"}</button>
        <button data-delete="${feed.id}">${isZh() ? "删除" : "Delete"}</button>
      </div>
    </li>
  `).join("");

  const feedById = new Map((feeds || []).map((item) => [item.id, item]));

  el.podcastFeedList.querySelectorAll("button[data-copy]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const feed = feedById.get(btn.dataset.copy || "");
      if (!feed) return;
      await navigator.clipboard.writeText(feed.rssXml || "");
      setStatus(t(state.locale, "manager.statusCopyXml"));
    });
  });

  el.podcastFeedList.querySelectorAll("button[data-download]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const feed = feedById.get(btn.dataset.download || "");
      if (!feed) return;
      const blob = new Blob([feed.rssXml || ""], { type: "application/rss+xml;charset=utf-8" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `${feed.title.replace(/[\\/:*?"<>|]/g, "_") || "podcast"}.xml`;
      a.click();
      URL.revokeObjectURL(a.href);
    });
  });

  el.podcastFeedList.querySelectorAll("button[data-delete]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const response = await sendMessage({ type: "DELETE_PODCAST_FEED", id: btn.dataset.delete || "" });
      renderPodcastFeeds(response.feeds || []);
      setStatus(t(state.locale, "manager.statusDeleteFeed"));
    });
  });
  renderNavCounts();
}

async function sendMessage(message, timeoutMs = REQUEST_TIMEOUT_MS) {
  const response = await Promise.race([
    chrome.runtime.sendMessage(message),
    new Promise((_, reject) => setTimeout(() => reject(new Error("request_timeout")), timeoutMs))
  ]);
  if (!response?.ok) throw new Error(response?.error || "action_failed");
  return response;
}

async function loadState() {
  const response = await sendMessage({ type: "GET_STATE" });
  state.snapshot = response.snapshot;
  renderAutomation(state.snapshot);
}

async function loadNotebooks(force = false) {
  const response = await sendMessage({ type: "FETCH_NOTEBOOKS", force }, 120000);
  state.snapshot = response.snapshot;
  state.notebooks = Array.isArray(response.notebooks) ? response.notebooks : [];
  state.selected = new Set([...state.selected].filter((url) => state.notebooks.some((item) => item.url === url)));
  state.mergeSelected = new Set([...state.mergeSelected].filter((url) => state.notebooks.some((item) => item.url === url)));
  renderAutomation(state.snapshot);
}

async function loadFeeds() {
  const response = await sendMessage({ type: "GET_PODCAST_FEEDS" }, 90000);
  const feeds = Array.isArray(response.feeds) ? response.feeds : [];
  state.podcastFeedsCount = feeds.length;
  renderPodcastFeeds(feeds);
}

async function loadManagerMeta() {
  const response = await sendMessage({ type: "GET_MANAGER_META" }, 90000);
  state.favorites = new Set(Array.isArray(response.favorites) ? response.favorites : []);
  state.collections = Array.isArray(response.collections) ? response.collections : [];
  state.templates = Array.isArray(response.templates) ? response.templates : [];
  state.notebookTags = response.notebookTags || {};
  state.audioTasks = response.audioTasks || {};
  state.sourceMeta = response.sourceMeta || {};
  state.localUser = response.localUser?.user || null;
}

function getSourceMetaKey(row = {}) {
  const notebookId = String(row?.notebookId || extractNotebookId(row?.notebookUrl || "") || "").trim();
  const notebookUrl = normalizeNotebookUrl(row?.notebookUrl || "", "");
  const sourceId = String(row?.sourceId || row?.id || "").trim();
  const sourceUrl = String(row?.sourceUrl || "").trim();
  const left = notebookId || notebookUrl;
  const right = sourceId || sourceUrl;
  return left && right ? `${left}::${right}` : "";
}

function getSourceMeta(row = {}) {
  const key = getSourceMetaKey(row);
  return state.sourceMeta?.[key] || { note: "", highlight: "none" };
}

function nextSourceHighlight(current = "none") {
  const order = ["none", "green", "blue", "yellow", "orange", "pink", "purple", "red"];
  const index = order.indexOf(String(current || "none"));
  return order[(index + 1 + order.length) % order.length];
}

function sourceHighlightLabel(color = "none") {
  const value = String(color || "none");
  if (value === "none") return isZh() ? "无高亮" : "No Highlight";
  return isZh() ? `高亮：${value}` : `Highlight: ${value}`;
}

async function saveSourceMetaForRow(row, patch = {}) {
  const current = getSourceMeta(row);
  const response = await sendMessage({
    type: "SET_SOURCE_META",
    payload: {
      notebookId: row?.notebookId || "",
      notebookUrl: row?.notebookUrl || "",
      sourceId: row?.sourceId || row?.id || "",
      sourceUrl: row?.sourceUrl || "",
      note: Object.prototype.hasOwnProperty.call(patch, "note") ? patch.note : current.note,
      highlight: Object.prototype.hasOwnProperty.call(patch, "highlight") ? patch.highlight : current.highlight
    }
  }, 90000);
  state.sourceMeta = response.sourceMeta || state.sourceMeta;
}

async function editSourceNote(row) {
  const current = getSourceMeta(row);
  const next = await askTextDialog({
    title: isZh() ? "编辑来源备注" : "Edit Source Note",
    message: row?.sourceName || row?.name || "-",
    label: isZh() ? "备注内容" : "Note",
    defaultValue: current.note || "",
    placeholder: isZh() ? "输入这条来源的备注..." : "Add a note for this source..."
  });
  if (next === null) return;
  await saveSourceMetaForRow(row, { note: String(next || "").trim() });
  renderSourceDetail();
  renderAllSources();
  setStatus(isZh() ? "来源备注已更新。" : "Source note updated.");
}

async function cycleSourceHighlight(row) {
  const current = getSourceMeta(row);
  const next = nextSourceHighlight(current.highlight);
  await saveSourceMetaForRow(row, { highlight: next });
  renderSourceDetail();
  renderAllSources();
  setStatus(sourceHighlightLabel(next));
}

async function refreshAll(force = false) {
  setStatus(t(state.locale, "manager.statusReading"));
  await withGlobalLoading(
    t(state.locale, "manager.globalLoadingTitle"),
    t(state.locale, "manager.globalLoadingHint"),
    () => Promise.all([loadState(), loadNotebooks(force), loadFeeds(), loadManagerMeta()])
  );
  renderNotebookOptions();
  renderTable();
  renderSourceDetail();
  renderAllSources();
  renderDocuments();
  renderMerge();
  renderFavorites();
  renderCollections();
  renderTemplates();
  bindCollectionAndTemplateActions();
  renderStats();
  renderNavCounts();
  startAudioPolling();
  setStatus(t(state.locale, "manager.statusReadDone", { count: state.notebooks.length }));
}
function getTargets() {
  return Array.isArray(state.snapshot?.rule?.targets) ? [...state.snapshot.rule.targets] : [];
}

async function saveTargets(targets) {
  const rule = normalizeRule({ ...(state.snapshot?.rule || {}), targets });
  const response = await sendMessage({ type: "SAVE_RULE", payload: rule });
  state.snapshot = response.snapshot;
  renderTable();
  renderAutomation(state.snapshot);
  renderStats();
}

async function addRule(url, sourceLabel) {
  const normalized = normalizeNotebookUrl(url, "");
  if (!normalized) return;
  const label = String(sourceLabel || "work ai news").trim() || "work ai news";
  const targets = getTargets();
  if (!targets.some((item) => normalizeNotebookUrl(item.notebookUrl, "") === normalized && String(item.sourceLabel || "").trim() === label)) {
    targets.push({ notebookUrl: normalized, sourceLabel: label });
    await saveTargets(targets);
  }
}

async function addRuleWithPrompt(url) {
  const title = state.notebooks.find((item) => item.url === url)?.title || "";
  const source = await askTextDialog({
    title: t(state.locale, "manager.addSource"),
    message: t(state.locale, "manager.promptNotebookSourceName"),
    label: t(state.locale, "manager.promptNotebookSourceName"),
    defaultValue: title || "work ai news"
  });
  if (source === null) return;
  await addRule(url, source);
  setStatus(t(state.locale, "options.statusAddedSingleRule"));
}

async function openNotebook(url) {
  await sendMessage({ type: "OPEN_NOTEBOOK", url });
  setStatus(t(state.locale, "manager.statusNotebookOpened"));
}

async function runNotebook(url, options = {}) {
  const useGlobalLoading = options.globalLoading !== false;
  const execute = () => sendMessage({ type: "RUN_NOTEBOOK_NOW", url });
  const response = useGlobalLoading
    ? await withGlobalLoading(
      t(state.locale, "manager.globalLoadingTitle"),
      isZh() ? "正在执行来源刷新..." : "Running source refresh...",
      execute
    )
    : await execute();
  state.snapshot = response.snapshot;
  renderTable();
  renderAutomation(state.snapshot);
  renderStats();
  setStatus(t(state.locale, "manager.statusRunTriggered"));
}

async function toggleFavorite(url) {
  const response = await sendMessage({ type: "TOGGLE_FAVORITE", notebookUrl: url });
  state.favorites = new Set(response.favorites || []);
  renderFavorites();
  renderTable();
  renderStats();
}

async function editNotebookTags(url) {
  const currentTags = getNotebookTags(url);
  const hint = isZh()
    ? "输入标签，逗号分隔（留空表示清空）"
    : "Input tags separated by comma (empty to clear)";
  const input = await askTextDialog({
    title: t(state.locale, "manager.editTags"),
    message: hint,
    label: t(state.locale, "manager.editTags"),
    defaultValue: currentTags.join(", ")
  });
  if (input === null) return;
  const tags = String(input || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  await setNotebookTags(url, tags);
}

async function setNotebookTags(url, tags) {
  const response = await sendMessage({
    type: "SET_NOTEBOOK_TAGS",
    notebookUrl: url,
    tags
  });
  state.notebookTags = response.notebookTags || {};
  renderTable();
  setStatus(t(state.locale, "manager.statusTagsSaved"));
}

async function addSingleTagFromRow(url) {
  const input = await askTextDialog({
    title: t(state.locale, "manager.editTags"),
    message: isZh() ? "输入要新增的标签：" : "Input tag to add:",
    label: isZh() ? "新增标签" : "New Tag",
    defaultValue: ""
  });
  if (input === null) return;
  const nextTag = String(input || "").trim();
  if (!nextTag) return;
  const current = getNotebookTags(url);
  if (current.includes(nextTag)) return;
  await setNotebookTags(url, [...current, nextTag]);
}

async function upsertCollectionMembers(collection, notebookUrls, nextName = "") {
  const response = await sendMessage({
    type: "SAVE_COLLECTION",
    payload: {
      id: collection?.id,
      createdAt: collection?.createdAt,
      name: nextName || collection?.name || (isZh() ? "集合" : "Collection"),
      notebookUrls
    }
  });
  state.collections = Array.isArray(response.collections) ? response.collections : [];
  renderCollections();
  bindCollectionAndTemplateActions();
  renderTable();
  renderStats();
}

async function removeNotebookFromCollection(collectionId, notebookUrl) {
  const target = state.collections.find((item) => item.id === collectionId);
  if (!target) return;
  const normalized = normalizeNotebookUrl(notebookUrl, "");
  const members = (target.notebookUrls || []).map((url) => normalizeNotebookUrl(url, "")).filter(Boolean);
  const nextMembers = members.filter((url) => url !== normalized);
  if (nextMembers.length === members.length) return;
  if (!nextMembers.length) {
    const response = await sendMessage({ type: "DELETE_COLLECTION", id: target.id || "" });
    state.collections = Array.isArray(response.collections) ? response.collections : [];
    renderCollections();
    bindCollectionAndTemplateActions();
    renderTable();
    renderStats();
    setStatus(t(state.locale, "manager.statusCollectionDeleted"));
    return;
  }
  await upsertCollectionMembers(target, nextMembers, target.name);
  setStatus(t(state.locale, "manager.statusCollectionMembersRemoved", { name: target.name, count: 1 }));
}

function selectedUrls() {
  return [...state.selected];
}

function stopAudioPolling() {
  if (audioPollTimer) {
    clearInterval(audioPollTimer);
    audioPollTimer = null;
  }
}

async function checkAudioStatusForNotebook(url) {
  const response = await sendMessage({
    type: "CHECK_AUDIO_OVERVIEW_STATUS",
    notebookUrl: url
  });
  const normalizedUrl = normalizeNotebookUrl(url, "");
  if (normalizedUrl) {
    state.audioTasks[normalizedUrl] = response.task || { status: response.status || "idle" };
  }
}

function startAudioPolling() {
  stopAudioPolling();
  audioPollTimer = setInterval(async () => {
    const entries = Object.entries(state.audioTasks || {})
      .filter(([, task]) => task?.status === "generating")
      .slice(0, 20);
    if (!entries.length) {
      stopAudioPolling();
      return;
    }
    for (const [url] of entries) {
      await checkAudioStatusForNotebook(url).catch(() => undefined);
    }
    renderTable();
  }, 5000);
}

async function openAudioPlay(url) {
  const response = await sendMessage({ type: "GET_NOTEBOOK_AUDIO_URLS", notebookUrl: url });
  const normalizedUrl = normalizeNotebookUrl(url, "");
  if (normalizedUrl) {
    state.audioTasks[normalizedUrl] = {
      ...(state.audioTasks[normalizedUrl] || {}),
      status: "ready",
      urls: response?.urls || {}
    };
  }
  const playUrl = response?.urls?.playUrl || response?.urls?.downloadUrl || "";
  if (!playUrl) throw new Error("audio_play_url_not_found");
  await chrome.tabs.create({ url: playUrl, active: true });
  renderTable();
  setStatus(t(state.locale, "manager.statusOpenAudio"));
}

async function openAudioDownload(url) {
  const response = await sendMessage({ type: "GET_NOTEBOOK_AUDIO_URLS", notebookUrl: url });
  const normalizedUrl = normalizeNotebookUrl(url, "");
  if (normalizedUrl) {
    state.audioTasks[normalizedUrl] = {
      ...(state.audioTasks[normalizedUrl] || {}),
      status: "ready",
      urls: response?.urls || {}
    };
  }
  const downloadUrl = response?.urls?.downloadUrl || response?.urls?.playUrl || "";
  if (!downloadUrl) throw new Error("audio_download_url_not_found");
  await chrome.tabs.create({ url: downloadUrl, active: true });
  renderTable();
  setStatus(t(state.locale, "manager.statusOpenDownload"));
}

async function syncAudioToPodcast(url, title) {
  const response = await sendMessage({
    type: "SYNC_AUDIO_TO_PODCAST",
    notebookUrl: url,
    feedTitle: `${String(title || "NotebookLM").trim()} Audio Feed`
  });
  await loadFeeds();
  setStatus(t(state.locale, "manager.statusSyncPodcast", { title: response?.feed?.title || "-" }));
}

async function generateAudio(url) {
  const normalizedUrl = normalizeNotebookUrl(url, "");
  if (normalizedUrl) {
    state.audioTasks[normalizedUrl] = {
      ...(state.audioTasks[normalizedUrl] || {}),
      status: "generating",
      updatedAt: new Date().toISOString()
    };
  }
  renderTable();
  setStatus(t(state.locale, "manager.statusAudioChecking"));
  await sendMessage({ type: "GENERATE_NOTEBOOK_AUDIO_OVERVIEW", notebookUrl: url });
  await checkAudioStatusForNotebook(url).catch(() => undefined);
  renderTable();
  startAudioPolling();
  setStatus(t(state.locale, "manager.statusGenerateAudio"));
}

async function batchAddRule() {
  const urls = selectedUrls();
  if (!urls.length) return setStatus(t(state.locale, "manager.statusNoSelection"));
  for (const url of urls) {
    const title = state.notebooks.find((item) => item.url === url)?.title || "work ai news";
    await addRule(url, title);
  }
  setStatus(t(state.locale, "manager.statusBatchRule", { count: urls.length }));
}

async function batchAddSource() {
  const urls = selectedUrls();
  if (!urls.length) return setStatus(t(state.locale, "manager.statusNoSelection"));
  const source = await askTextDialog({
    title: t(state.locale, "manager.batchAddSource"),
    message: t(state.locale, "manager.promptSourceName"),
    label: t(state.locale, "manager.promptSourceName"),
    defaultValue: ""
  });
  if (!source) return;
  for (const url of urls) {
    await addRule(url, source);
  }
  setStatus(t(state.locale, "manager.statusBatchSource", { count: urls.length }));
}

async function batchRunNow() {
  const urls = selectedUrls();
  if (!urls.length) return setStatus(t(state.locale, "manager.statusNoSelection"));
  await withGlobalLoading(
    t(state.locale, "manager.globalLoadingTitle"),
    isZh() ? "正在批量执行刷新..." : "Running batch refresh...",
    async () => {
      for (const url of urls) {
        await runNotebook(url, { globalLoading: false });
      }
    }
  );
  setStatus(t(state.locale, "manager.statusBatchRun", { count: urls.length }));
}

async function batchCreateCollection() {
  const urls = selectedUrls().map((url) => normalizeNotebookUrl(url, "")).filter(Boolean);
  if (!urls.length) return setStatus(t(state.locale, "manager.statusNoSelection"));
  const defaultName = `${isZh() ? "集合" : "Collection"} ${new Date().toLocaleDateString()}`;
  const input = await askTextDialog({
    title: t(state.locale, "manager.batchCreateCollection"),
    message: t(state.locale, "manager.promptCollectionName"),
    label: t(state.locale, "manager.promptCollectionName"),
    defaultValue: defaultName
  });
  if (input === null) return;
  const name = String(input || "").trim() || defaultName;
  const response = await sendMessage({ type: "SAVE_COLLECTION", payload: { name, notebookUrls: urls } });
  state.collections = Array.isArray(response.collections) ? response.collections : [];
  renderCollections();
  bindCollectionAndTemplateActions();
  renderStats();
  setStatus(t(state.locale, "manager.statusCollectionSaved", { name }));
}

async function importFromTabs() {
  const response = await sendMessage({ type: "GET_BROWSER_TAB_URLS" });
  appendImportUrls(response.urls || []);
  setStatus(t(state.locale, "manager.statusTabsLoaded", { count: response.urls?.length || 0 }));
}

async function importFromBookmarks() {
  const response = await sendMessage({ type: "GET_BOOKMARK_URLS" });
  appendImportUrls(response.urls || []);
  setStatus(t(state.locale, "manager.statusBookmarksLoaded", { count: response.urls?.length || 0 }));
}

async function importFromCsv() {
  const file = el.csvFileInput?.files?.[0];
  if (!file) {
    setStatus(t(state.locale, "manager.statusCsvMissingFile"));
    return;
  }
  const text = await file.text();
  const urls = dedupeUrls(
    [...String(text || "").matchAll(/https?:\/\/[^\s,"'<>]+/gi)]
      .map((match) => String(match[0] || "").trim())
  );
  appendImportUrls(urls);
  setStatus(t(state.locale, "manager.statusCsvLoaded", { count: urls.length }));
}

async function importFromPageLinks() {
  const url = String(el.pageUrlInput.value || "").trim();
  const response = await sendMessage({ type: "EXTRACT_PAGE_LINKS", url });
  appendImportUrls(response.urls || []);
  setStatus(t(state.locale, "manager.statusPageLinksLoaded", { count: response.urls?.length || 0 }));
}

async function importFromYoutube() {
  const url = String(el.youtubeUrlInput.value || "").trim();
  const response = await sendMessage({ type: "PARSE_YOUTUBE_PLAYLIST", url });
  appendImportUrls(response.urls || []);
  setStatus(t(state.locale, "manager.statusYtLoaded", { count: response.urls?.length || 0 }));
}

async function importFromRss() {
  const url = String(el.rssUrlInput.value || "").trim();
  const response = await sendMessage({ type: "PARSE_RSS_FEED", url });
  appendImportUrls(response.urls || []);
  setStatus(t(state.locale, "manager.statusRssLoaded", { count: response.urls?.length || 0 }));
}

async function batchImportToNotebook() {
  const notebookUrl = el.targetNotebookSelect.value;
  const urls = getImportUrls();
  if (!notebookUrl) return setStatus(isZh() ? "请先选择目标 notebook。" : "Select target notebook first.");
  if (!urls.length) return setStatus(isZh() ? "请先准备待导入 URL。" : "Prepare URLs to import first.");
  const response = await withGlobalLoading(
    t(state.locale, "manager.globalLoadingTitle"),
    isZh() ? "正在导入来源..." : "Importing sources...",
    () => sendMessage({ type: "BATCH_IMPORT_SOURCES", notebookUrl, urls }, 240000)
  );
  const imported = response.result?.imported || 0;
  const failed = response.result?.failed?.length || 0;
  setStatus(t(state.locale, "manager.statusImportDone", { imported, failed }));
}

async function syncPodcast() {
  const notebookUrl = el.podcastNotebookSelect.value;
  const feedTitle = String(el.podcastTitleInput.value || "").trim();
  if (!notebookUrl) return setStatus(isZh() ? "请先选择 notebook。" : "Select notebook first.");
  const response = await sendMessage({ type: "SYNC_AUDIO_TO_PODCAST", notebookUrl, feedTitle });
  await loadFeeds();
  setStatus(t(state.locale, "manager.statusSyncPodcastFeed", { title: response.feed?.title || "-" }));
}

async function saveCollectionFromSelected() {
  const urls = selectedUrls().map((url) => normalizeNotebookUrl(url, "")).filter(Boolean);
  if (!urls.length) return setStatus(t(state.locale, "manager.statusNoSelection"));
  const name = String(el.collectionNameInput.value || "").trim() || `${isZh() ? "集合" : "Collection"} ${new Date().toLocaleDateString()}`;
  const response = await sendMessage({ type: "SAVE_COLLECTION", payload: { name, notebookUrls: urls } });
  state.collections = Array.isArray(response.collections) ? response.collections : [];
  renderCollections();
  bindCollectionAndTemplateActions();
  renderStats();
  el.collectionNameInput.value = "";
  setStatus(t(state.locale, "manager.statusCollectionSaved", { name }));
}

function resetTemplateEditor() {
  state.editingTemplateId = "";
  el.templateNameInput.value = "";
  el.templateSourcesInput.value = "";
  el.templateRefreshLabelInput.value = "";
  el.cancelTemplateEditButton.style.display = "none";
}

async function saveTemplateFromForm() {
  const name = String(el.templateNameInput.value || "").trim();
  const sourceLabels = String(el.templateSourcesInput.value || "").split(/\r?\n/).map((item) => item.trim()).filter(Boolean);
  const refreshLabel = String(el.templateRefreshLabelInput.value || "").trim();
  if (!name) return setStatus(isZh() ? "请先输入模板名称。" : "Template name is required.");
  if (!sourceLabels.length) return setStatus(isZh() ? "请先输入来源标签。" : "At least one source label is required.");
  const response = await sendMessage({
    type: "SAVE_TEMPLATE",
    payload: {
      id: state.editingTemplateId || undefined,
      name,
      sourceLabels,
      refreshLabel
    }
  });
  state.templates = Array.isArray(response.templates) ? response.templates : [];
  renderTemplates();
  bindCollectionAndTemplateActions();
  renderStats();
  resetTemplateEditor();
  setStatus(t(state.locale, "manager.statusTemplateSaved", { name }));
}

async function runAutomationNow() {
  const response = await sendMessage({ type: "RUN_NOW" });
  state.snapshot = response.snapshot;
  renderAutomation(state.snapshot);
  renderStats();
  setStatus(t(state.locale, "popup.doneRunNow"));
}

async function openAutomationNotebook() {
  const response = await sendMessage({ type: "OPEN_NOTEBOOK" });
  state.snapshot = response.snapshot;
  renderAutomation(state.snapshot);
  setStatus(t(state.locale, "popup.doneOpenNotebook"));
}

async function toggleAutomationEnabled() {
  const response = await sendMessage({ type: "TOGGLE_ENABLED" });
  state.snapshot = response.snapshot;
  renderAutomation(state.snapshot);
  setStatus(t(state.locale, "popup.doneToggle"));
}

function renderAllViews() {
  el.searchInput.value = state.searchKey;
  el.tagFilterInput.value = state.tagFilterKey;
  if (el.documentsSearchInput) el.documentsSearchInput.value = state.documentsSearchKey;
  if (el.mergeSearchInput) el.mergeSearchInput.value = state.mergeSearchKey;
  el.sortField.value = state.sortField;
  el.pageSize.value = String(state.pageSize);
  if (el.documentsRowsPerPage) el.documentsRowsPerPage.value = String(state.documentsPageSize);
  if (el.allSourcesRowsPerPage) el.allSourcesRowsPerPage.value = String(state.allSourcesPageSize);
  el.sortDirection.textContent = t(
    state.locale,
    state.sortDirection === "desc" ? "manager.sortDesc" : "manager.sortAsc"
  );
  updateColumnToggles();
  if (!state.editingTemplateId) {
    el.cancelTemplateEditButton.style.display = "none";
  }
  renderNotebookOptions();
  renderTable();
  renderSourceDetail();
  renderAllSources();
  renderDocuments();
  renderMerge();
  renderFavorites();
  renderCollections();
  renderTemplates();
  bindCollectionAndTemplateActions();
  renderStats();
  const activeMethod = el.bulkMethodButtons.find((btn) => btn.classList.contains("active"))?.dataset.method || "links";
  switchBulkMethod(activeMethod);
  renderAutomation(state.snapshot);
}

function refreshStaticText() {
  document.title = t(state.locale, "manager.pageTitle");
  applyI18n(state.locale, document);
  fillLocaleSelect(el.localeSelect, state.locale);
  updateSelectionCount();
  renderThemeToggle();
  renderAllViews();
  const version = chrome.runtime?.getManifest?.().version || "0.0.0";
  el.buildInfo.textContent = t(state.locale, "common.version", { version });
}

function showActionError(error) {
  const message = error?.message || "unknown_error";
  setStatus(t(state.locale, "common.actionFailed", { message }));
}

function showLoadError(error) {
  const message = error?.message || "unknown_error";
  setStatus(t(state.locale, "common.loadFailed", { message }));
}

function registerEventListeners() {
  el.navItems.forEach((item) => {
    item.addEventListener("click", async () => {
      const nextView = item.dataset.view || "notebooks";
      switchView(nextView);
      if (nextView === "allSources" && !state.allSources.length) {
        setStatus(isZh() ? "正在读取所有来源..." : "Loading all sources...");
        let loaded = true;
        await withGlobalLoading(
          t(state.locale, "manager.globalLoadingTitle"),
          isZh() ? "正在读取所有来源，请稍候..." : "Loading all sources, please wait...",
          () => refreshAllSources(false)
        ).catch((error) => {
          loaded = false;
          showLoadError(error);
        });
        if (loaded) setStatus(isZh() ? "所有来源已更新。" : "All sources updated.");
      }
      if (nextView === "documents" && !state.allDocuments.length) {
        setStatus(isZh() ? "正在读取文档列表..." : "Loading documents...");
        let loaded = true;
        await withGlobalLoading(
          t(state.locale, "manager.globalLoadingTitle"),
          isZh() ? "正在读取文档列表，请稍候..." : "Loading documents, please wait...",
          () => refreshDocuments(false)
        ).catch((error) => {
          loaded = false;
          showLoadError(error);
        });
        if (loaded) setStatus(isZh() ? "文档列表已更新。" : "Documents updated.");
      }
      if (nextView === "merge") {
        renderMerge();
      }
    });
  });

  el.refreshNotebooksButton.addEventListener("click", () => {
    withButtonLoading(
      el.refreshNotebooksButton,
      isZh() ? "加载中..." : "Loading...",
      () => withGlobalLoading(
        t(state.locale, "manager.globalLoadingTitle"),
        t(state.locale, "manager.globalLoadingHint"),
        () => refreshAll(true)
      )
    )
      .catch(showLoadError);
  });

  el.openOptionsButton.addEventListener("click", async () => {
    await chrome.runtime.openOptionsPage();
  });

  el.themeToggle?.addEventListener("click", () => {
    const next = state.theme === "dark" ? "light" : "dark";
    applyTheme(next).catch(showActionError);
  });

  el.searchInput.addEventListener("input", () => {
    state.searchKey = String(el.searchInput.value || "").trim().toLowerCase();
    state.currentPage = 1;
    renderTable();
  });

  el.tagFilterInput.addEventListener("input", () => {
    state.tagFilterKey = String(el.tagFilterInput.value || "").trim().toLowerCase();
    state.currentPage = 1;
    renderTable();
  });

  el.sortField.addEventListener("change", async () => {
    state.sortField = String(el.sortField.value || "title");
    state.currentPage = 1;
    await saveViewPrefs();
    renderTable();
  });

  el.sortDirection.addEventListener("click", async () => {
    state.sortDirection = state.sortDirection === "desc" ? "asc" : "desc";
    el.sortDirection.textContent = t(
      state.locale,
      state.sortDirection === "desc" ? "manager.sortDesc" : "manager.sortAsc"
    );
    state.currentPage = 1;
    await saveViewPrefs();
    renderTable();
  });

  el.pageSize.addEventListener("change", async () => {
    state.pageSize = parseIntSafe(el.pageSize.value, 20);
    state.currentPage = 1;
    await saveViewPrefs();
    renderTable();
  });

  el.pagePrev.addEventListener("click", () => {
    state.currentPage = Math.max(1, state.currentPage - 1);
    renderTable();
  });

  el.pageNext.addEventListener("click", () => {
    state.currentPage += 1;
    renderTable();
  });

  el.selectAllVisibleButton.addEventListener("click", () => {
    state.pagedRows.forEach((item) => state.selected.add(item.url));
    renderTable();
    renderStats();
  });

  el.clearSelectionButton.addEventListener("click", () => {
    state.selected.clear();
    renderTable();
    renderStats();
  });

  el.batchAddRuleButton.addEventListener("click", () => {
    withButtonLoading(el.batchAddRuleButton, isZh() ? "处理中..." : "Working...", batchAddRule)
      .catch(showActionError);
  });

  el.batchAddSourceButton.addEventListener("click", () => {
    withButtonLoading(el.batchAddSourceButton, isZh() ? "处理中..." : "Working...", batchAddSource)
      .catch(showActionError);
  });

  el.batchRunNowButton.addEventListener("click", () => {
    withButtonLoading(el.batchRunNowButton, isZh() ? "执行中..." : "Running...", batchRunNow)
      .catch(showActionError);
  });

  el.batchCreateCollectionButton.addEventListener("click", () => {
    withButtonLoading(el.batchCreateCollectionButton, isZh() ? "创建中..." : "Creating...", batchCreateCollection)
      .catch(showActionError);
  });

  const bindColumnToggle = async (key, node) => {
    state.columnVisible[key] = !!node.checked;
    await saveViewPrefs();
    renderTable();
  };
  el.colSources.addEventListener("change", () => bindColumnToggle("sources", el.colSources));
  el.colCollections.addEventListener("change", () => bindColumnToggle("collections", el.colCollections));
  el.colLastEdited.addEventListener("change", () => bindColumnToggle("lastEdited", el.colLastEdited));
  el.colAudio.addEventListener("change", () => bindColumnToggle("audio", el.colAudio));
  el.colTags.addEventListener("change", () => bindColumnToggle("tags", el.colTags));
  el.colRules.addEventListener("change", () => bindColumnToggle("rules", el.colRules));
  el.colOps.addEventListener("change", () => bindColumnToggle("ops", el.colOps));

  el.sourceDetailBackButton.addEventListener("click", () => switchView("notebooks"));
  el.sourceDetailRefreshButton.addEventListener("click", () => {
    withButtonLoading(el.sourceDetailRefreshButton, isZh() ? "刷新中..." : "Refreshing...", async () => {
      if (!state.sourceDetail.notebookUrl) return;
      await loadNotebookSources(state.sourceDetail.notebookUrl, true);
      renderSourceDetail();
    }).catch(showActionError);
  });
  el.sourceDetailDownloadAllButton.addEventListener("click", () => {
    if (!state.sourceDetail.notebookUrl) return;
    openDownloadDialogForNotebook(state.sourceDetail.notebookUrl);
  });

  el.refreshAllSourcesButton.addEventListener("click", () => {
    withButtonLoading(
      el.refreshAllSourcesButton,
      isZh() ? "刷新中..." : "Refreshing...",
      () => withGlobalLoading(
        t(state.locale, "manager.globalLoadingTitle"),
        isZh() ? "正在刷新所有来源，请稍候..." : "Refreshing all sources, please wait...",
        () => refreshAllSources(true)
      )
    )
      .then(() => setStatus(isZh() ? "所有来源已更新。" : "All sources updated."))
      .catch(showLoadError);
  });
  el.allSourcesSearchInput.addEventListener("input", () => {
    state.allSourcesCurrentPage = 1;
    renderAllSources();
  });
  el.allSourcesRowsPerPage.addEventListener("change", () => {
    state.allSourcesPageSize = parseIntSafe(el.allSourcesRowsPerPage.value, 20);
    state.allSourcesCurrentPage = 1;
    renderAllSources();
  });
  el.allSourcesPrevPage.addEventListener("click", () => {
    state.allSourcesCurrentPage = Math.max(1, state.allSourcesCurrentPage - 1);
    renderAllSources();
  });
  el.allSourcesNextPage.addEventListener("click", () => {
    state.allSourcesCurrentPage += 1;
    renderAllSources();
  });
  el.allSourcesSelectAll.addEventListener("change", () => {
    const pageKeys = state.allSourcesPaged.map((item) => getAllSourceRowKey(item));
    if (el.allSourcesSelectAll.checked) {
      pageKeys.forEach((key) => state.allSourcesSelected.add(key));
    } else {
      pageKeys.forEach((key) => state.allSourcesSelected.delete(key));
    }
    renderAllSources();
  });
  el.allSourcesSyncGdocsButton.addEventListener("click", () => {
    withButtonLoading(el.allSourcesSyncGdocsButton, isZh() ? "同步中..." : "Syncing...", () => withGlobalLoading(
      t(state.locale, "manager.globalLoadingTitle"),
      isZh() ? "正在同步 Google 文档来源..." : "Syncing Google Docs sources...",
      () => handleAllSourcesSyncGdocs()
    )).catch(showActionError);
  });
  el.allSourcesDownloadButton.addEventListener("click", () => {
    withButtonLoading(el.allSourcesDownloadButton, isZh() ? "下载中..." : "Downloading...", () => withGlobalLoading(
      t(state.locale, "manager.globalLoadingTitle"),
      isZh() ? "正在准备下载来源..." : "Preparing source downloads...",
      () => handleAllSourcesDownloadSelected()
    )).catch(showActionError);
  });
  el.allSourcesCreateNotebookButton.addEventListener("click", () => {
    withButtonLoading(el.allSourcesCreateNotebookButton, isZh() ? "创建中..." : "Creating...", () => withGlobalLoading(
      t(state.locale, "manager.globalLoadingTitle"),
      isZh() ? "正在创建笔记本并导入来源..." : "Creating notebook and importing sources...",
      () => handleAllSourcesCreateNotebookFromSelected()
    )).catch(showActionError);
  });
  el.allSourcesAddToNotebookButton.addEventListener("click", () => {
    withButtonLoading(el.allSourcesAddToNotebookButton, isZh() ? "导入中..." : "Importing...", () => withGlobalLoading(
      t(state.locale, "manager.globalLoadingTitle"),
      isZh() ? "正在导入到目标笔记本..." : "Importing to target notebook...",
      () => handleAllSourcesAddToNotebook()
    )).catch(showActionError);
  });
  el.allSourcesMoveFolderButton.addEventListener("click", () => {
    withButtonLoading(el.allSourcesMoveFolderButton, isZh() ? "处理中..." : "Working...", handleAllSourcesMoveFolder)
      .catch(showActionError);
  });
  el.allSourcesDeleteButton.addEventListener("click", () => {
    withButtonLoading(el.allSourcesDeleteButton, isZh() ? "删除中..." : "Deleting...", () => withGlobalLoading(
      t(state.locale, "manager.globalLoadingTitle"),
      isZh() ? "正在删除来源..." : "Deleting selected sources...",
      () => handleAllSourcesDelete()
    )).catch(showActionError);
  });
  el.allSourcesDeleteBadButton.addEventListener("click", () => {
    withButtonLoading(el.allSourcesDeleteBadButton, isZh() ? "清理中..." : "Cleaning...", () => withGlobalLoading(
      t(state.locale, "manager.globalLoadingTitle"),
      isZh() ? "正在清理异常来源..." : "Cleaning bad sources...",
      () => handleAllSourcesDeleteBad()
    )).catch(showActionError);
  });

  el.refreshDocumentsButton.addEventListener("click", () => {
    withButtonLoading(
      el.refreshDocumentsButton,
      isZh() ? "刷新中..." : "Refreshing...",
      () => withGlobalLoading(
        t(state.locale, "manager.globalLoadingTitle"),
        isZh() ? "正在刷新文档列表，请稍候..." : "Refreshing documents, please wait...",
        () => refreshDocuments(true)
      )
    )
      .then(() => setStatus(isZh() ? "文档列表已更新。" : "Documents updated."))
      .catch(showLoadError);
  });

  el.documentsDownloadSelectedButton?.addEventListener("click", () => {
    withButtonLoading(el.documentsDownloadSelectedButton, isZh() ? "下载中..." : "Downloading...", async () => {
      downloadSelectedDocuments();
    }).catch(showActionError);
  });

  el.documentsSearchInput?.addEventListener("input", () => {
    state.documentsSearchKey = String(el.documentsSearchInput.value || "").trim().toLowerCase();
    state.documentsCurrentPage = 1;
    renderDocuments();
  });

  el.documentsTypeFilter?.addEventListener("change", () => {
    state.documentsTypeFilter = String(el.documentsTypeFilter.value || "").trim();
    state.documentsCurrentPage = 1;
    renderDocuments();
  });

  el.documentsRowsPerPage?.addEventListener("change", () => {
    state.documentsPageSize = parseIntSafe(el.documentsRowsPerPage.value, 20);
    state.documentsCurrentPage = 1;
    renderDocuments();
  });

  el.documentsPrevPage?.addEventListener("click", () => {
    state.documentsCurrentPage = Math.max(1, state.documentsCurrentPage - 1);
    renderDocuments();
  });

  el.documentsNextPage?.addEventListener("click", () => {
    state.documentsCurrentPage += 1;
    renderDocuments();
  });

  el.documentsSelectAll?.addEventListener("change", () => {
    const shouldSelect = Boolean(el.documentsSelectAll.checked);
    state.documentsPaged.forEach((doc) => {
      const key = getDocumentRowKey(doc);
      if (shouldSelect) state.documentsSelected.add(key);
      else state.documentsSelected.delete(key);
    });
    renderDocuments();
  });

  el.mergeSelectedNowButton.addEventListener("click", () => {
    withButtonLoading(el.mergeSelectedNowButton, isZh() ? "合并中..." : "Merging...", performMergeSelected)
      .catch(showActionError);
  });
  el.mergeSearchInput?.addEventListener("input", () => {
    state.mergeSearchKey = String(el.mergeSearchInput.value || "").trim().toLowerCase();
    renderMerge();
  });
  el.mergeSelectAll?.addEventListener("change", () => {
    const shouldSelect = Boolean(el.mergeSelectAll.checked);
    const key = String(state.mergeSearchKey || "").trim().toLowerCase();
    const rows = (state.notebooks || []).filter((item) => {
      if (!key) return true;
      return String(item.title || "").toLowerCase().includes(key)
        || String(item.url || "").toLowerCase().includes(key);
    });
    rows.forEach((item) => {
      if (shouldSelect) state.mergeSelected.add(item.url);
      else state.mergeSelected.delete(item.url);
    });
    renderMerge();
  });

  el.addSelectedFavoritesButton.addEventListener("click", () => {
    withButtonLoading(el.addSelectedFavoritesButton, isZh() ? "处理中..." : "Working...", async () => {
      const urls = selectedUrls();
      if (!urls.length) return setStatus(t(state.locale, "manager.statusNoSelection"));
      const response = await sendMessage({ type: "SET_FAVORITES", action: "add", urls });
      state.favorites = new Set(response.favorites || []);
      renderFavorites();
      renderTable();
      renderStats();
      setStatus(t(state.locale, "manager.statusFavoritesAdded", { count: urls.length }));
    }).catch(showActionError);
  });

  el.removeSelectedFavoritesButton.addEventListener("click", () => {
    withButtonLoading(el.removeSelectedFavoritesButton, isZh() ? "处理中..." : "Working...", async () => {
      const urls = selectedUrls();
      if (!urls.length) return setStatus(t(state.locale, "manager.statusNoSelection"));
      const response = await sendMessage({ type: "SET_FAVORITES", action: "remove", urls });
      state.favorites = new Set(response.favorites || []);
      renderFavorites();
      renderTable();
      renderStats();
      setStatus(t(state.locale, "manager.statusFavoritesRemoved", { count: urls.length }));
    }).catch(showActionError);
  });

  el.createCollectionFromSelectedButton.addEventListener("click", () => {
    withButtonLoading(el.createCollectionFromSelectedButton, isZh() ? "创建中..." : "Creating...", saveCollectionFromSelected)
      .catch(showActionError);
  });

  el.saveTemplateButton.addEventListener("click", () => {
    withButtonLoading(el.saveTemplateButton, isZh() ? "保存中..." : "Saving...", saveTemplateFromForm)
      .catch(showActionError);
  });

  el.cancelTemplateEditButton.addEventListener("click", () => {
    resetTemplateEditor();
    setStatus(t(state.locale, "manager.statusTemplateEditCanceled"));
  });

  el.loadFromTabsButton.addEventListener("click", () => {
    withButtonLoading(el.loadFromTabsButton, isZh() ? "加载中..." : "Loading...", importFromTabs)
      .catch(showActionError);
  });

  el.loadFromBookmarksButton.addEventListener("click", () => {
    withButtonLoading(el.loadFromBookmarksButton, isZh() ? "加载中..." : "Loading...", importFromBookmarks)
      .catch(showActionError);
  });

  el.loadFromPageLinksButton.addEventListener("click", () => {
    withButtonLoading(el.loadFromPageLinksButton, isZh() ? "提取中..." : "Extracting...", importFromPageLinks)
      .catch(showActionError);
  });

  el.loadFromYoutubeButton.addEventListener("click", () => {
    withButtonLoading(el.loadFromYoutubeButton, isZh() ? "提取中..." : "Extracting...", importFromYoutube)
      .catch(showActionError);
  });

  el.loadFromRssButton.addEventListener("click", () => {
    withButtonLoading(el.loadFromRssButton, isZh() ? "提取中..." : "Extracting...", importFromRss)
      .catch(showActionError);
  });

  el.loadFromCsvButton.addEventListener("click", () => {
    withButtonLoading(el.loadFromCsvButton, isZh() ? "解析中..." : "Parsing...", importFromCsv)
      .catch(showActionError);
  });

  el.crawlerUpgradeButton.addEventListener("click", () => {
    setStatus(t(state.locale, "manager.statusCrawlerUpgrade"));
  });

  el.bulkMethodButtons.forEach((button) => {
    button.addEventListener("click", () => {
      switchBulkMethod(button.dataset.method || "links");
    });
  });

  el.clearImportUrlsButton.addEventListener("click", () => {
    el.importUrlsTextarea.value = "";
    setStatus(isZh() ? "URL 列表已清空。" : "URL list cleared.");
  });

  el.batchImportToNotebookButton.addEventListener("click", () => {
    withButtonLoading(el.batchImportToNotebookButton, isZh() ? "导入中..." : "Importing...", batchImportToNotebook)
      .catch(showActionError);
  });

  el.syncPodcastFeedButton.addEventListener("click", () => {
    withButtonLoading(el.syncPodcastFeedButton, isZh() ? "同步中..." : "Syncing...", syncPodcast)
      .catch(showActionError);
  });

  el.automationRunNowButton.addEventListener("click", () => {
    withButtonLoading(el.automationRunNowButton, isZh() ? "执行中..." : "Running...", runAutomationNow)
      .catch(showActionError);
  });

  el.automationOpenNotebookButton.addEventListener("click", () => {
    withButtonLoading(el.automationOpenNotebookButton, isZh() ? "打开中..." : "Opening...", openAutomationNotebook)
      .catch(showActionError);
  });

  el.automationToggleEnabledButton.addEventListener("click", () => {
    withButtonLoading(el.automationToggleEnabledButton, isZh() ? "切换中..." : "Switching...", toggleAutomationEnabled)
      .catch(showActionError);
  });

  el.automationLogsPerPage?.addEventListener("change", () => {
    state.automationLogsPerPage = parseIntSafe(el.automationLogsPerPage.value, 8);
    state.automationLogPage = 1;
    renderAutomation(state.snapshot);
  });

  el.automationLogPrevButton?.addEventListener("click", () => {
    state.automationLogPage = Math.max(1, state.automationLogPage - 1);
    renderAutomation(state.snapshot);
  });

  el.automationLogNextButton?.addEventListener("click", () => {
    state.automationLogPage += 1;
    renderAutomation(state.snapshot);
  });

  el.localeSelect.addEventListener("change", async () => {
    state.locale = await setLocale(el.localeSelect.value || "zh-CN");
    refreshStaticText();
  });

  el.downloadFilterInput.addEventListener("input", () => {
    state.downloadContext.filterKey = String(el.downloadFilterInput.value || "").trim();
    renderDownloadSourceList();
  });
  el.downloadPreviewButton.addEventListener("click", () => {
    previewDownloadSources().catch(showActionError);
  });
  el.downloadSelectedButton.addEventListener("click", () => {
    withButtonLoading(el.downloadSelectedButton, isZh() ? "下载中..." : "Downloading...", downloadSelectedSourcesFromDialog)
      .catch(showActionError);
  });

  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== "local") return;
    if (!Object.prototype.hasOwnProperty.call(changes, "uiLocale")) return;
    getLocale()
      .then((locale) => {
        state.locale = locale;
        refreshStaticText();
      })
      .catch(() => undefined);
  });

  window.addEventListener("beforeunload", () => {
    stopAudioPolling();
  });
}

async function bootstrap() {
  state.locale = await getLocale();
  await loadViewPrefs();
  await loadThemePref();
  refreshStaticText();
  registerEventListeners();
  switchView("notebooks");
  await refreshAll(true);
  setStatus(t(state.locale, "manager.statusReady"));
}

bootstrap().catch((error) => {
  console.error("[manager] bootstrap failed", error);
  showLoadError(error);
});
