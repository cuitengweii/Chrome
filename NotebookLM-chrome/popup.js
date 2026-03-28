import { getLocale, setLocale, fillLocaleSelect, t, localizeResult, localizeMode } from "./i18n.js";

const MESSAGE_TIMEOUT_MS = 30000;
const POPUP_NOTEBOOK_KEY = "popupSelectedNotebook";
const LOCAL_PROFILE_STORAGE_KEY = "localAssistantProfile";
const LOCAL_USAGE_STORAGE_KEY = "localAssistantUsage";
const PROMPTS_STORAGE_KEY = "promptLibrary";
const PROMPT_FOLDERS_STORAGE_KEY = "foldersByType";

const el = {
  localeSelect: document.getElementById("localeSelect"),
  versionBadge: document.getElementById("versionBadge"),
  brandCaption: document.getElementById("popupBrandCaption"),
  title: document.getElementById("popupTitle"),
  heroSummary: document.getElementById("heroSummary"),
  tierPill: document.getElementById("tierPill"),
  upgradeButton: document.getElementById("upgradeButton"),
  openPromptsBtn: document.getElementById("openPromptsBtn"),
  settingsToggleBtn: document.getElementById("settingsToggleBtn"),
  settingsDropdown: document.getElementById("settingsDropdown"),
  manageFeaturesBtn: document.getElementById("manageFeaturesBtn"),
  manageNotebooksDropdownBtn: document.getElementById("manageNotebooksDropdownBtn"),
  manageSubscriptionBtn: document.getElementById("manageSubscriptionBtn"),
  claimPurchaseBtn: document.getElementById("claimPurchaseBtn"),
  customSubscriptionBtn: document.getElementById("customSubscriptionBtn"),
  docsBtn: document.getElementById("docsBtn"),
  tutorialBtn: document.getElementById("tutorialBtn"),
  featureRequestBtn: document.getElementById("featureRequestBtn"),
  contactUsBtn: document.getElementById("contactUsBtn"),
  visitWebsiteBtn: document.getElementById("visitWebsiteBtn"),
  signOutBtn: document.getElementById("signOutBtn"),
  deleteAccountBtn: document.getElementById("deleteAccountBtn"),
  accountLabel: document.getElementById("accountLabel"),
  accountEmail: document.getElementById("accountEmail"),
  accountPlan: document.getElementById("accountPlan"),
  usageImportLabel: document.getElementById("usageImportLabel"),
  usageImportValue: document.getElementById("usageImportValue"),
  usageExportLabel: document.getElementById("usageExportLabel"),
  usageExportValue: document.getElementById("usageExportValue"),
  usageSourceViewLabel: document.getElementById("usageSourceViewLabel"),
  usageSourceViewValue: document.getElementById("usageSourceViewValue"),
  usageCaptureLabel: document.getElementById("usageCaptureLabel"),
  usageCaptureValue: document.getElementById("usageCaptureValue"),
  currentPageLabel: document.getElementById("currentPageLabel"),
  currentPageTitle: document.getElementById("currentPageTitle"),
  currentPageUrl: document.getElementById("currentPageUrl"),
  targetNotebookLabel: document.getElementById("targetNotebookLabel"),
  popupNotebookSelect: document.getElementById("popupNotebookSelect"),
  importCurrentPage: document.getElementById("importCurrentPage"),
  quickImportCurrentPage: document.getElementById("quickImportCurrentPage"),
  captureCurrentPage: document.getElementById("captureCurrentPage"),
  scheduleStatusLabelText: document.getElementById("scheduleStatusLabelText"),
  resultStatusLabelText: document.getElementById("resultStatusLabelText"),
  ruleStatusLabelText: document.getElementById("ruleStatusLabelText"),
  scheduleLabel: document.getElementById("scheduleLabel"),
  scheduleDetail: document.getElementById("scheduleDetail"),
  resultLabel: document.getElementById("resultLabel"),
  resultDetail: document.getElementById("resultDetail"),
  ruleLabel: document.getElementById("ruleLabel"),
  ruleDetail: document.getElementById("ruleDetail"),
  runNow: document.getElementById("runNow"),
  openNotebook: document.getElementById("openNotebook"),
  toggleEnabled: document.getElementById("toggleEnabled"),
  openManager: document.getElementById("openManager"),
  openOptions: document.getElementById("openOptions"),
  promptPanel: document.getElementById("promptPanel"),
  promptLibraryLabel: document.getElementById("promptLibraryLabel"),
  promptLibraryTitle: document.getElementById("promptLibraryTitle"),
  createPromptButton: document.getElementById("createPromptButton"),
  promptSearchInput: document.getElementById("promptSearchInput"),
  promptFolderFilter: document.getElementById("promptFolderFilter"),
  promptList: document.getElementById("promptList"),
  logsTitleText: document.getElementById("logsTitleText"),
  buildInfo: document.getElementById("buildInfo"),
  logList: document.getElementById("logList"),
  popupStatus: document.getElementById("popupStatus"),
  infoDialog: document.getElementById("infoDialog"),
  infoDialogTitle: document.getElementById("infoDialogTitle"),
  infoDialogMessage: document.getElementById("infoDialogMessage"),
  infoDialogCloseTop: document.getElementById("infoDialogCloseTop"),
  infoDialogConfirm: document.getElementById("infoDialogConfirm"),
  promptDialog: document.getElementById("promptDialog"),
  promptDialogTitle: document.getElementById("promptDialogTitle"),
  promptDialogClose: document.getElementById("promptDialogClose"),
  promptTitleLabel: document.getElementById("promptTitleLabel"),
  promptTitleInput: document.getElementById("promptTitleInput"),
  promptFolderLabel: document.getElementById("promptFolderLabel"),
  promptFolderInput: document.getElementById("promptFolderInput"),
  promptTagsLabel: document.getElementById("promptTagsLabel"),
  promptTagsInput: document.getElementById("promptTagsInput"),
  promptContentLabel: document.getElementById("promptContentLabel"),
  promptContentInput: document.getElementById("promptContentInput"),
  promptFavoriteInput: document.getElementById("promptFavoriteInput"),
  promptFavoriteLabel: document.getElementById("promptFavoriteLabel"),
  promptDeleteButton: document.getElementById("promptDeleteButton"),
  promptCancelButton: document.getElementById("promptCancelButton"),
  promptSaveButton: document.getElementById("promptSaveButton")
};

const state = {
  locale: "zh-CN",
  snapshot: null,
  user: null,
  currentTab: null,
  notebooks: [],
  prompts: [],
  promptFolders: [],
  promptSearchKey: "",
  promptFolderFilter: "all",
  promptPanelOpen: false,
  editingPromptId: "",
  infoDialogHandler: null
};

function isZh() {
  return String(state.locale).toLowerCase().startsWith("zh");
}

function text(zh, en) {
  return isZh() ? zh : en;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function setStatus(message) {
  el.popupStatus.textContent = String(message || "");
}

function formatTime(isoString) {
  return isoString ? new Date(isoString).toLocaleString() : t(state.locale, "common.never");
}

function formatScheduledTime(alarm) {
  if (!alarm?.scheduledTime) return t(state.locale, "common.notScheduled");
  return new Date(alarm.scheduledTime).toLocaleString();
}

function resultTone(result) {
  if (result === "success") return "good";
  if (result === "running") return "warn";
  if (result === "idle") return "muted";
  return "warn";
}

function formatUsage(current, limit) {
  const value = Number(current || 0);
  return Number.isFinite(limit) ? `${value} / ${limit}` : `${value} / ∞`;
}

function setButtonLoading(button, loadingText) {
  return async (task) => {
    const originalText = button.textContent;
    const wasDisabled = button.disabled;
    button.disabled = true;
    button.textContent = loadingText;
    try {
      return await task();
    } finally {
      button.disabled = wasDisabled;
      button.textContent = originalText;
    }
  };
}

async function sendMessage(message, timeoutMs = MESSAGE_TIMEOUT_MS) {
  return Promise.race([
    chrome.runtime.sendMessage(message),
    new Promise((_, reject) => setTimeout(() => reject(new Error("request_timeout")), timeoutMs))
  ]);
}

async function getSelectedNotebook() {
  const stored = await chrome.storage.local.get(POPUP_NOTEBOOK_KEY);
  return String(stored?.[POPUP_NOTEBOOK_KEY] || "");
}

async function setSelectedNotebook(url) {
  await chrome.storage.local.set({ [POPUP_NOTEBOOK_KEY]: String(url || "") });
}

async function fetchCurrentTab() {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  state.currentTab = tabs[0] || null;
}

async function fetchSnapshot() {
  const response = await sendMessage({ type: "GET_STATE" }, 15000);
  if (!response?.ok) throw new Error(response?.error || "state_failed");
  state.snapshot = response.snapshot || null;
}

async function fetchUser() {
  const response = await sendMessage({ type: "GET_USER_STATUS" }, 20000);
  if (!response?.ok || response?.success === false) throw new Error(response?.error || "user_status_failed");
  state.user = response.user || null;
}

async function fetchNotebooks(force = false) {
  const response = await sendMessage({ type: "GET_NOTEBOOK_LIST", force }, 40000);
  if (!response?.ok) throw new Error(response?.error || "fetch_notebooks_failed");
  state.notebooks = Array.isArray(response.notebooks) ? response.notebooks : [];
}

async function fetchPrompts() {
  const response = await sendMessage({ type: "GET_PROMPTS" }, 30000);
  if (!response?.ok) throw new Error(response?.error || "get_prompts_failed");
  state.prompts = Array.isArray(response.prompts) ? response.prompts : [];
  state.promptFolders = Array.isArray(response.folders) ? response.folders : [];
}

function showDialog(dialog) {
  if (dialog && typeof dialog.showModal === "function") {
    dialog.showModal();
  }
}

function closeDialog(dialog) {
  if (dialog && typeof dialog.close === "function") {
    dialog.close();
  }
}

function toggleSettingsDropdown(force) {
  const nextOpen = typeof force === "boolean"
    ? force
    : !el.settingsDropdown.classList.contains("is-open");
  el.settingsDropdown.classList.toggle("is-open", nextOpen);
}

function setPromptPanel(open) {
  state.promptPanelOpen = Boolean(open);
  el.promptPanel.classList.toggle("is-hidden", !state.promptPanelOpen);
  el.openPromptsBtn.classList.toggle("primary-button", state.promptPanelOpen);
  el.openPromptsBtn.classList.toggle("secondary-button", !state.promptPanelOpen);
}

async function openPromptsPage() {
  const targetUrl = chrome.runtime.getURL("prompts.html");
  const tabs = await chrome.tabs.query({ url: targetUrl });
  if (tabs.length > 0) {
    const tab = tabs[0];
    await chrome.tabs.update(tab.id, { active: true });
    if (Number.isInteger(tab.windowId)) {
      await chrome.windows.update(tab.windowId, { focused: true }).catch(() => undefined);
    }
    return;
  }
  const created = await chrome.tabs.create({ url: targetUrl, active: true });
  if (Number.isInteger(created.windowId)) {
    await chrome.windows.update(created.windowId, { focused: true }).catch(() => undefined);
  }
}

function showInfoDialog(title, message, onConfirm = null) {
  state.infoDialogHandler = typeof onConfirm === "function" ? onConfirm : null;
  el.infoDialogTitle.textContent = title;
  el.infoDialogMessage.textContent = message;
  el.infoDialogConfirm.textContent = text("知道了", "Got it");
  showDialog(el.infoDialog);
}

function closeInfoDialog() {
  state.infoDialogHandler = null;
  closeDialog(el.infoDialog);
}

function renderStaticText() {
  const manifest = chrome.runtime.getManifest();
  document.title = t(state.locale, "common.appName");
  el.title.textContent = t(state.locale, "common.appName");
  el.brandCaption.textContent = text("NOTEBOOKLM WORKSPACE", "NOTEBOOKLM WORKSPACE");
  el.versionBadge.textContent = `v${manifest.version}`;
  el.heroSummary.textContent = text(
    "导入当前页面、快速建本、截图留存、提示词管理，现在都集中在这里。",
    "Import the current page, quick-create notebooks, capture pages, and manage prompts from one place."
  );
  el.upgradeButton.textContent = state.user?.tier === "basic" ? text("升级", "Upgrade") : text("Pro", "Pro");
  el.upgradeButton.hidden = String(state.user?.tier || "pro").toLowerCase() !== "basic";
  el.openPromptsBtn.textContent = text("提示词", "Prompts");
  el.manageFeaturesBtn.textContent = text("功能设置", "Manage Features");
  el.manageNotebooksDropdownBtn.textContent = text("管理笔记本", "Manage Notebooks");
  el.manageSubscriptionBtn.textContent = text("管理订阅", "Manage Subscription");
  el.claimPurchaseBtn.textContent = text("领取购买", "Claim Purchase");
  el.customSubscriptionBtn.textContent = text("定制订阅", "Custom Subscription");
  el.docsBtn.textContent = text("使用文档", "Documentation");
  el.tutorialBtn.textContent = text("新手教程", "Tutorial");
  el.featureRequestBtn.textContent = text("功能建议", "Feature Request");
  el.contactUsBtn.textContent = text("联系我们", "Contact Us");
  el.visitWebsiteBtn.textContent = text("访问 NotebookLM", "Visit NotebookLM");
  el.signOutBtn.textContent = text("切换到基础版", "Switch to Basic");
  el.deleteAccountBtn.textContent = text("清空本地工作区", "Clear Local Workspace");
  el.accountLabel.textContent = text("本地账号", "Local Account");
  el.usageImportLabel.textContent = text("导入", "Imports");
  el.usageExportLabel.textContent = text("导出", "Exports");
  el.usageSourceViewLabel.textContent = text("来源查看", "Source Views");
  el.usageCaptureLabel.textContent = text("截图", "Capture");
  el.currentPageLabel.textContent = text("当前页面", "Current Page");
  el.targetNotebookLabel.textContent = text("目标 Notebook", "Target Notebook");
  el.importCurrentPage.textContent = text("导入当前页", "Import Current Page");
  el.quickImportCurrentPage.textContent = text("快速导入", "Quick Import");
  el.captureCurrentPage.textContent = text("截图", "Capture");
  el.scheduleStatusLabelText.textContent = t(state.locale, "popup.scheduleStatus");
  el.resultStatusLabelText.textContent = t(state.locale, "popup.resultStatus");
  el.ruleStatusLabelText.textContent = t(state.locale, "popup.ruleStatus");
  el.runNow.textContent = t(state.locale, "popup.runNow");
  el.openNotebook.textContent = t(state.locale, "popup.openNotebook");
  el.openManager.textContent = t(state.locale, "popup.openManager");
  el.openOptions.textContent = t(state.locale, "popup.openOptions");
  el.promptLibraryLabel.textContent = text("提示词库", "Prompt Library");
  el.promptLibraryTitle.textContent = text("沉淀可复用提示词", "Save reusable prompts");
  el.createPromptButton.textContent = text("新建", "New");
  el.promptSearchInput.placeholder = text("搜索标题、内容或标签", "Search title, content, or tag");
  el.logsTitleText.textContent = t(state.locale, "popup.logsTitle");
  el.buildInfo.textContent = t(state.locale, "common.version", { version: manifest.version });
  el.promptDialogTitle.textContent = text("编辑提示词", "Edit Prompt");
  el.promptTitleLabel.textContent = text("标题", "Title");
  el.promptFolderLabel.textContent = text("文件夹", "Folder");
  el.promptTagsLabel.textContent = text("标签", "Tags");
  el.promptContentLabel.textContent = text("内容", "Content");
  el.promptFavoriteLabel.textContent = text("加入收藏", "Favorite this prompt");
  el.promptDeleteButton.textContent = text("删除", "Delete");
  el.promptCancelButton.textContent = text("取消", "Cancel");
  el.promptSaveButton.textContent = text("保存", "Save");
}

function renderUser() {
  const user = state.user || {};
  const tier = String(user.tier || "pro").toLowerCase();
  const subscriptionType = String(user.subscription_type || "").toLowerCase();
  const isLifetime = tier === "pro" && subscriptionType === "lifetime";
  el.tierPill.textContent = isLifetime ? text("本地 Pro", "Local Pro") : text("基础版", "Basic");
  el.accountEmail.textContent = user.email || "local@konglai.ai";
  el.accountPlan.textContent = isLifetime ? text("终身版", "Lifetime") : text("基础版", "Basic");
  el.usageImportValue.textContent = formatUsage(user.import_count, user.import_limit);
  el.usageExportValue.textContent = formatUsage(user.export_count, user.export_limit);
  el.usageSourceViewValue.textContent = formatUsage(user.source_view_count, Number.POSITIVE_INFINITY);
  el.usageCaptureValue.textContent = formatUsage(user.capture_count, Number.POSITIVE_INFINITY);
  el.upgradeButton.textContent = tier === "basic" ? text("升级", "Upgrade") : text("Pro", "Pro");
  el.upgradeButton.hidden = tier !== "basic";
}

function renderCurrentTab() {
  const tab = state.currentTab;
  if (!tab?.url) {
    el.currentPageTitle.textContent = text("未检测到当前页面", "No active page detected");
    el.currentPageUrl.textContent = text("请在任意网页中打开扩展。", "Open the extension on any webpage.");
    return;
  }
  el.currentPageTitle.textContent = tab.title || tab.url;
  el.currentPageUrl.textContent = tab.url;
}

async function renderNotebookOptions() {
  const stored = await getSelectedNotebook();
  const options = state.notebooks
    .map((item) => `<option value="${escapeHtml(item.url)}">${escapeHtml(item.title || item.url)}</option>`)
    .join("");
  el.popupNotebookSelect.innerHTML = options || `<option value="">${escapeHtml(text("暂无可用 Notebook", "No notebooks found"))}</option>`;
  const selected = state.notebooks.find((item) => item.url === stored)?.url || state.notebooks[0]?.url || "";
  el.popupNotebookSelect.value = selected;
}

function renderState() {
  const snapshot = state.snapshot;
  if (!snapshot?.rule || !snapshot?.runtime) {
    el.scheduleLabel.textContent = t(state.locale, "common.loading");
    el.scheduleDetail.textContent = t(state.locale, "popup.statusLoading");
    el.resultLabel.textContent = t(state.locale, "common.loading");
    el.resultDetail.textContent = t(state.locale, "popup.statusLoading");
    el.ruleLabel.textContent = t(state.locale, "common.loading");
    el.ruleDetail.textContent = t(state.locale, "popup.statusLoading");
    return;
  }

  const { rule, runtime, alarm } = snapshot;
  const targets = Array.isArray(rule.targets) ? rule.targets : [];
  const previewTargets = targets
    .slice(0, 2)
    .map((target) => String(target?.sourceLabel || "").trim())
    .filter(Boolean)
    .join(" | ");

  el.scheduleLabel.textContent = rule.enabled
    ? t(state.locale, "popup.scheduleEnabled")
    : t(state.locale, "popup.schedulePaused");
  el.scheduleDetail.textContent = rule.enabled
    ? t(state.locale, "popup.scheduleNext", { time: formatScheduledTime(alarm) })
    : t(state.locale, "popup.schedulePausedHint");
  const scheduleCard = el.scheduleLabel.closest(".status-card");
  if (scheduleCard?.dataset) scheduleCard.dataset.tone = rule.enabled ? "good" : "muted";

  el.resultLabel.textContent = localizeResult(state.locale, runtime.lastResult || "idle");
  el.resultDetail.textContent = runtime.lastResult === "success"
    ? t(state.locale, "popup.resultSuccessAt", { time: formatTime(runtime.lastSuccessAt) })
    : (runtime.lastErrorMessage || t(state.locale, "popup.resultLastRunAt", { time: formatTime(runtime.lastRunAt) }));
  const resultCard = el.resultLabel.closest(".status-card");
  if (resultCard?.dataset) resultCard.dataset.tone = resultTone(runtime.lastResult);

  el.ruleLabel.textContent = t(state.locale, "popup.ruleConfigured", { count: targets.length });
  el.ruleDetail.textContent = previewTargets
    ? `${previewTargets}${targets.length > 2 ? " ..." : ""}`
    : t(state.locale, "popup.ruleNotConfigured");

  el.toggleEnabled.textContent = rule.enabled
    ? t(state.locale, "popup.togglePause")
    : t(state.locale, "popup.toggleResume");

  renderLogs(runtime);
}

function renderLogs(runtime) {
  const recent = Array.isArray(runtime?.recentRuns) ? runtime.recentRuns : [];
  if (!recent.length) {
    el.logList.innerHTML = `<li class="empty-log">${escapeHtml(t(state.locale, "popup.logsEmpty"))}</li>`;
    return;
  }
  el.logList.innerHTML = recent.slice(0, 4).map((entry) => `
    <li class="log-entry">
      <strong>${escapeHtml(localizeMode(state.locale, entry.mode))} · ${escapeHtml(localizeResult(state.locale, entry.result))}</strong>
      <span>${escapeHtml(formatTime(entry.at))}</span>
      <span>${escapeHtml(entry.message || "-")}</span>
    </li>
  `).join("");
}

function renderPromptFolderFilter() {
  const options = [{ id: "all", name: text("全部文件夹", "All Folders") }, ...state.promptFolders];
  el.promptFolderFilter.innerHTML = options.map((item) => (
    `<option value="${escapeHtml(item.id)}">${escapeHtml(item.name)}</option>`
  )).join("");
  if (!options.some((item) => item.id === state.promptFolderFilter)) {
    state.promptFolderFilter = "all";
  }
  el.promptFolderFilter.value = state.promptFolderFilter;
}

function renderPrompts() {
  renderPromptFolderFilter();
  const key = String(state.promptSearchKey || "").trim().toLowerCase();
  const folderId = String(state.promptFolderFilter || "all");
  const rows = state.prompts.filter((item) => {
    if (folderId !== "all" && String(item.folderId || "all") !== folderId) return false;
    if (!key) return true;
    return [item.title, item.content, ...(item.tags || [])]
      .some((value) => String(value || "").toLowerCase().includes(key));
  });

  if (!rows.length) {
    el.promptList.innerHTML = `<div class="prompt-item"><div class="prompt-content">${escapeHtml(text("暂无提示词，点击右上角新建。", "No prompts yet. Click New to create one."))}</div></div>`;
    return;
  }

  el.promptList.innerHTML = rows.map((item) => {
    const folderName = state.promptFolders.find((folder) => folder.id === item.folderId)?.name || text("未分组", "Ungrouped");
    return `
      <article class="prompt-item" data-prompt-id="${escapeHtml(item.id)}">
        <div class="prompt-item-head">
          <div class="prompt-item-title">${escapeHtml(item.favorite ? `★ ${item.title}` : item.title)}</div>
          <span class="prompt-folder-badge">${escapeHtml(folderName)}</span>
        </div>
        <div class="prompt-content">${escapeHtml(item.content)}</div>
        <div class="prompt-tag-list">${(item.tags || []).map((tag) => `<span class="prompt-tag">${escapeHtml(tag)}</span>`).join("")}</div>
        <div class="prompt-item-actions">
          <button class="mini-button secondary-button" type="button" data-action="copy" data-prompt-id="${escapeHtml(item.id)}">${escapeHtml(text("复制", "Copy"))}</button>
          <button class="mini-button secondary-button" type="button" data-action="edit" data-prompt-id="${escapeHtml(item.id)}">${escapeHtml(text("编辑", "Edit"))}</button>
          <button class="mini-button ghost-button" type="button" data-action="delete" data-prompt-id="${escapeHtml(item.id)}">${escapeHtml(text("删除", "Delete"))}</button>
        </div>
      </article>
    `;
  }).join("");

  el.promptList.querySelectorAll("button[data-action]").forEach((button) => {
    const prompt = state.prompts.find((item) => item.id === button.dataset.promptId);
    if (!prompt) return;
    button.addEventListener("click", () => {
      const action = button.dataset.action;
      if (action === "copy") {
        navigator.clipboard.writeText(prompt.content || "")
          .then(() => setStatus(text("提示词已复制。", "Prompt copied.")))
          .catch((error) => setStatus(text(`复制失败：${error.message}`, `Copy failed: ${error.message}`)));
        return;
      }
      if (action === "edit") {
        openPromptDialog(prompt);
        return;
      }
      if (action === "delete") {
        deletePrompt(prompt.id).catch((error) => setStatus(text(`删除失败：${error.message}`, `Delete failed: ${error.message}`)));
      }
    });
  });
}

function openPromptDialog(prompt = null) {
  state.editingPromptId = prompt?.id || "";
  el.promptDialogTitle.textContent = prompt ? text("编辑提示词", "Edit Prompt") : text("新建提示词", "New Prompt");
  el.promptTitleInput.value = prompt?.title || "";
  const folderName = prompt?.folderId
    ? (state.promptFolders.find((item) => item.id === prompt.folderId)?.name || "")
    : "";
  el.promptFolderInput.value = folderName;
  el.promptTagsInput.value = Array.isArray(prompt?.tags) ? prompt.tags.join(", ") : "";
  el.promptContentInput.value = prompt?.content || "";
  el.promptFavoriteInput.checked = Boolean(prompt?.favorite);
  el.promptDeleteButton.hidden = !prompt;
  showDialog(el.promptDialog);
}

async function ensurePromptFolder(folderName) {
  const trimmed = String(folderName || "").trim();
  if (!trimmed) return "all";
  const exists = state.promptFolders.find((item) => String(item.name || "").trim().toLowerCase() === trimmed.toLowerCase());
  if (exists) return exists.id;

  const nextFolders = [
    ...state.promptFolders,
    { id: `folder_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`, name: trimmed }
  ];
  const response = await sendMessage({
    type: "SAVE_FOLDERS",
    data: {
      folderType: "prompts",
      folders: nextFolders,
      assignments: {}
    }
  }, 30000);
  state.promptFolders = Array.isArray(response.folders) ? response.folders : nextFolders;
  return state.promptFolders.find((item) => String(item.name || "").trim().toLowerCase() === trimmed.toLowerCase())?.id || "all";
}

async function savePromptFromDialog() {
  const title = String(el.promptTitleInput.value || "").trim();
  const content = String(el.promptContentInput.value || "").trim();
  if (!title || !content) {
    setStatus(text("标题和内容不能为空。", "Title and content are required."));
    return;
  }

  const folderId = await ensurePromptFolder(el.promptFolderInput.value);
  const payload = {
    id: state.editingPromptId || "",
    title,
    content,
    folderId,
    tags: String(el.promptTagsInput.value || "").split(",").map((item) => item.trim()).filter(Boolean),
    favorite: Boolean(el.promptFavoriteInput.checked)
  };
  const response = await sendMessage({ type: "SAVE_PROMPT", payload }, 30000);
  if (!response?.ok) throw new Error(response?.error || "save_prompt_failed");
  state.prompts = Array.isArray(response.prompts) ? response.prompts : state.prompts;
  closeDialog(el.promptDialog);
  renderPrompts();
  await fetchUser().catch(() => undefined);
  renderUser();
  setStatus(text("提示词已保存。", "Prompt saved."));
}

async function deletePrompt(id) {
  const response = await sendMessage({ type: "DELETE_PROMPT", id }, 30000);
  if (!response?.ok) throw new Error(response?.error || "delete_prompt_failed");
  state.prompts = Array.isArray(response.prompts) ? response.prompts : state.prompts;
  closeDialog(el.promptDialog);
  renderPrompts();
  await fetchUser().catch(() => undefined);
  renderUser();
  setStatus(text("提示词已删除。", "Prompt deleted."));
}

async function invokeAction(button, loadingText, task) {
  return setButtonLoading(button, loadingText)(task);
}

async function importCurrentPage() {
  if (!state.currentTab?.url) throw new Error(text("未检测到当前页面。", "No current page detected."));
  const notebookUrl = String(el.popupNotebookSelect.value || "").trim();
  if (!notebookUrl) throw new Error(text("请先选择目标 Notebook。", "Choose a target notebook first."));
  const response = await sendMessage({
    type: "IMPORT_CURRENT_PAGE",
    notebookUrl,
    pageUrl: state.currentTab.url,
    pageTitle: state.currentTab.title || state.currentTab.url
  }, 120000);
  if (!response?.ok) throw new Error(response?.error || "import_current_page_failed");
  setStatus(text("当前页面已导入到目标 Notebook。", "Current page imported to notebook."));
  await fetchUser().catch(() => undefined);
  renderUser();
}

async function quickImportCurrentPage() {
  if (!state.currentTab?.url) throw new Error(text("未检测到当前页面。", "No current page detected."));
  const response = await sendMessage({
    type: "QUICK_IMPORT_CURRENT_PAGE",
    pageUrl: state.currentTab.url,
    pageTitle: state.currentTab.title || state.currentTab.url
  }, 180000);
  if (!response?.ok) throw new Error(response?.error || "quick_import_current_page_failed");
  setStatus(text("快速导入完成，已创建新 Notebook。", "Quick import finished and created a new notebook."));
  if (response.notebookUrl) {
    await chrome.tabs.create({ url: response.notebookUrl, active: true });
  }
  await Promise.all([fetchUser().catch(() => undefined), fetchNotebooks(true).catch(() => undefined)]);
  renderUser();
  await renderNotebookOptions();
}

async function captureCurrentPage() {
  if (!state.currentTab) throw new Error(text("未检测到当前页面。", "No current page detected."));
  const response = await sendMessage({
    type: "CAPTURE_CURRENT_PAGE",
    windowId: state.currentTab.windowId,
    title: state.currentTab.title || "page-capture"
  }, 120000);
  if (!response?.ok) throw new Error(response?.error || "capture_current_page_failed");
  setStatus(text("页面截图下载已开始。", "Page capture download started."));
  await fetchUser().catch(() => undefined);
  renderUser();
}

async function runNow() {
  const response = await sendMessage({ type: "RUN_NOW" }, 30000);
  if (!response?.ok) throw new Error(response?.error || "run_now_failed");
  state.snapshot = response.snapshot || state.snapshot;
  renderState();
  setStatus(t(state.locale, "popup.doneRunNow"));
}

async function openNotebook() {
  const response = await sendMessage({ type: "OPEN_NOTEBOOK" }, 30000);
  if (!response?.ok) throw new Error(response?.error || "open_notebook_failed");
  state.snapshot = response.snapshot || state.snapshot;
  setStatus(t(state.locale, "popup.doneOpenNotebook"));
}

async function toggleEnabled() {
  const response = await sendMessage({ type: "TOGGLE_ENABLED" }, 30000);
  if (!response?.ok) throw new Error(response?.error || "toggle_enabled_failed");
  state.snapshot = response.snapshot || state.snapshot;
  renderState();
  setStatus(t(state.locale, "popup.doneToggle"));
}

async function openManager() {
  const response = await sendMessage({ type: "OPEN_MANAGER_PAGE" }, 30000);
  if (!response?.ok) throw new Error(response?.error || "open_manager_failed");
  state.snapshot = response.snapshot || state.snapshot;
  setStatus(t(state.locale, "popup.doneOpenManager"));
  window.close();
}

async function switchToPro() {
  const response = await sendMessage({ type: "SET_LOCAL_TIER", tier: "pro" }, 30000);
  if (!response?.ok) throw new Error(response?.error || "set_local_tier_failed");
  state.user = response.user || state.user;
  renderUser();
}

async function switchToBasic() {
  const response = await sendMessage({ type: "LOCAL_SIGN_OUT" }, 30000);
  if (!response?.ok) throw new Error(response?.error || "local_sign_out_failed");
  state.user = response.user || state.user;
  renderUser();
}

async function clearWorkspace() {
  const response = await sendMessage({ type: "LOCAL_DELETE_ACCOUNT" }, 30000);
  if (!response?.ok) throw new Error(response?.error || "local_delete_account_failed");
  state.user = response.user || state.user;
  await fetchPrompts().catch(() => {
    state.prompts = [];
    state.promptFolders = [];
  });
  renderUser();
  renderPrompts();
}

function bindEvents() {
  el.localeSelect.addEventListener("change", async () => {
    state.locale = await setLocale(el.localeSelect.value);
    fillLocaleSelect(el.localeSelect, state.locale);
    renderStaticText();
    renderUser();
    renderCurrentTab();
    renderState();
    renderPrompts();
  });

  el.popupNotebookSelect.addEventListener("change", () => {
    setSelectedNotebook(el.popupNotebookSelect.value).catch(() => undefined);
  });

  el.settingsToggleBtn.addEventListener("click", (event) => {
    event.stopPropagation();
    toggleSettingsDropdown();
  });

  document.addEventListener("click", (event) => {
    if (!event.target.closest(".settings-menu")) {
      toggleSettingsDropdown(false);
    }
  });

  el.openPromptsBtn.addEventListener("click", () => {
    invokeAction(el.openPromptsBtn, text("打开中...", "Opening..."), openPromptsPage)
      .then(() => window.close())
      .catch((error) => setStatus(text(`打开失败：${error.message}`, `Open failed: ${error.message}`)));
  });

  el.promptSearchInput.addEventListener("input", () => {
    state.promptSearchKey = String(el.promptSearchInput.value || "").trim();
    renderPrompts();
  });

  el.promptFolderFilter.addEventListener("change", () => {
    state.promptFolderFilter = String(el.promptFolderFilter.value || "all");
    renderPrompts();
  });

  el.createPromptButton.addEventListener("click", () => openPromptDialog());
  el.promptDialogClose.addEventListener("click", () => closeDialog(el.promptDialog));
  el.promptCancelButton.addEventListener("click", () => closeDialog(el.promptDialog));
  el.promptDeleteButton.addEventListener("click", () => {
    if (!state.editingPromptId) return;
    deletePrompt(state.editingPromptId).catch((error) => setStatus(text(`删除失败：${error.message}`, `Delete failed: ${error.message}`)));
  });
  el.promptSaveButton.addEventListener("click", () => {
    invokeAction(el.promptSaveButton, text("保存中...", "Saving..."), savePromptFromDialog)
      .catch((error) => setStatus(text(`保存失败：${error.message}`, `Save failed: ${error.message}`)));
  });

  el.infoDialogCloseTop.addEventListener("click", () => closeInfoDialog());
  el.infoDialogConfirm.addEventListener("click", async () => {
    const handler = state.infoDialogHandler;
    closeInfoDialog();
    if (handler) {
      try {
        await handler();
      } catch (error) {
        setStatus(text(`操作失败：${error.message}`, `Action failed: ${error.message}`));
      }
    }
  });

  el.upgradeButton.addEventListener("click", () => {
    if (String(state.user?.tier || "pro").toLowerCase() === "pro") {
      showInfoDialog(
        text("专业版已启用", "Pro already enabled"),
        text("当前本地工作区已经是 Pro 模式，所有高级功能均已解锁。", "This local workspace is already in Pro mode with advanced features unlocked.")
      );
      return;
    }
    showInfoDialog(
      text("升级本地 Pro", "Upgrade local Pro"),
      text("这会把当前本地账号切换到 Pro 模式，并解除基础版限制。", "This switches the current local account to Pro mode and unlocks basic-tier limits."),
      async () => {
        await switchToPro();
        setStatus(text("本地 Pro 已启用。", "Local Pro enabled."));
      }
    );
  });

  el.manageFeaturesBtn.addEventListener("click", async () => {
    toggleSettingsDropdown(false);
    await chrome.runtime.openOptionsPage();
    window.close();
  });

  el.manageNotebooksDropdownBtn.addEventListener("click", () => {
    toggleSettingsDropdown(false);
    invokeAction(el.manageNotebooksDropdownBtn, text("打开中...", "Opening..."), openManager)
      .catch((error) => setStatus(text(`打开失败：${error.message}`, `Open failed: ${error.message}`)));
  });

  el.manageSubscriptionBtn.addEventListener("click", () => {
    toggleSettingsDropdown(false);
    showInfoDialog(
      text("本地订阅状态", "Local subscription status"),
      text("当前版本采用本地授权模式，不依赖在线订阅中心。你可以直接在这里切换基础版或 Pro。", "This build uses local licensing, so there is no online billing center. You can switch between Basic and Pro here.")
    );
  });

  el.claimPurchaseBtn.addEventListener("click", () => {
    toggleSettingsDropdown(false);
    showInfoDialog(
      text("领取本地 Pro", "Claim local Pro"),
      text("确认后会直接把当前本地账号标记为 Pro。", "Confirm to mark the current local account as Pro."),
      async () => {
        await switchToPro();
        setStatus(text("本地 Pro 已领取。", "Local Pro claimed."));
      }
    );
  });

  el.customSubscriptionBtn.addEventListener("click", () => {
    toggleSettingsDropdown(false);
    showInfoDialog(
      text("定制订阅说明", "Custom subscription"),
      text("当前是离线本地版，暂不接支付流。若后续接入企业授权，可在这个入口扩展。", "This is an offline local build without payments. This entry is reserved for future enterprise licensing.")
    );
  });

  el.docsBtn.addEventListener("click", async () => {
    toggleSettingsDropdown(false);
    await chrome.runtime.openOptionsPage();
    window.close();
  });

  el.tutorialBtn.addEventListener("click", async () => {
    toggleSettingsDropdown(false);
    const response = await sendMessage({ type: "OPEN_NOTEBOOK" }, 30000).catch(() => null);
    if (response?.ok) {
      setStatus(text("已打开 Notebook，新手流程请结合设置页说明使用。", "Notebook opened. Use the guide in Settings for the onboarding flow."));
    } else {
      setStatus(text("请先在设置页查看首次使用说明。", "Please open Settings to view the onboarding guide."));
    }
  });

  el.featureRequestBtn.addEventListener("click", () => {
    toggleSettingsDropdown(false);
    showInfoDialog(
      text("功能建议", "Feature request"),
      text("这一版已经把参考扩展的大部分核心工作台能力本地化了；如果你还想继续 1:1 补齐，可以继续在这个线程里直接提。", "Most core workspace features from the reference extension have been localized here. If you want even tighter 1:1 parity, just keep adding requests in this thread.")
    );
  });

  el.contactUsBtn.addEventListener("click", () => {
    toggleSettingsDropdown(false);
    showInfoDialog(
      text("联系入口", "Contact"),
      text("当前版本没有外部客服中心，建议直接通过当前协作线程继续迭代需求。", "This build has no external support portal, so the fastest path is continuing through this collaboration thread.")
    );
  });

  el.visitWebsiteBtn.addEventListener("click", async () => {
    toggleSettingsDropdown(false);
    await chrome.tabs.create({ url: "https://notebooklm.google.com/", active: true });
  });

  el.signOutBtn.addEventListener("click", () => {
    toggleSettingsDropdown(false);
    showInfoDialog(
      text("切换到基础版", "Switch to Basic"),
      text("确认后会把当前本地账号切回基础版，但不会删除你的规则。", "Confirm to switch the current local account back to Basic without deleting your rules."),
      async () => {
        await switchToBasic();
        setStatus(text("已切换为基础版。", "Switched to Basic."));
      }
    );
  });

  el.deleteAccountBtn.addEventListener("click", () => {
    toggleSettingsDropdown(false);
    showInfoDialog(
      text("清空本地工作区", "Clear local workspace"),
      text("这会清空本地提示词、来源批注和用量统计，并把账号重置为基础版。", "This clears local prompts, source notes, and usage stats, then resets the account to Basic."),
      async () => {
        await clearWorkspace();
        setStatus(text("本地工作区已重置。", "Local workspace reset."));
      }
    );
  });

  el.importCurrentPage.addEventListener("click", () => {
    invokeAction(el.importCurrentPage, text("导入中...", "Importing..."), importCurrentPage)
      .catch((error) => setStatus(text(`导入失败：${error.message}`, `Import failed: ${error.message}`)));
  });

  el.quickImportCurrentPage.addEventListener("click", () => {
    invokeAction(el.quickImportCurrentPage, text("处理中...", "Working..."), quickImportCurrentPage)
      .catch((error) => setStatus(text(`快速导入失败：${error.message}`, `Quick import failed: ${error.message}`)));
  });

  el.captureCurrentPage.addEventListener("click", () => {
    invokeAction(el.captureCurrentPage, text("截图中...", "Capturing..."), captureCurrentPage)
      .catch((error) => setStatus(text(`截图失败：${error.message}`, `Capture failed: ${error.message}`)));
  });

  el.runNow.addEventListener("click", () => {
    invokeAction(el.runNow, text("执行中...", "Running..."), runNow)
      .catch((error) => setStatus(t(state.locale, "common.actionFailed", { message: error.message })));
  });

  el.openNotebook.addEventListener("click", () => {
    invokeAction(el.openNotebook, text("打开中...", "Opening..."), openNotebook)
      .catch((error) => setStatus(t(state.locale, "common.actionFailed", { message: error.message })));
  });

  el.toggleEnabled.addEventListener("click", () => {
    invokeAction(el.toggleEnabled, text("切换中...", "Switching..."), toggleEnabled)
      .catch((error) => setStatus(t(state.locale, "common.actionFailed", { message: error.message })));
  });

  el.openManager.addEventListener("click", () => {
    invokeAction(el.openManager, text("打开中...", "Opening..."), openManager)
      .catch((error) => setStatus(t(state.locale, "common.actionFailed", { message: error.message })));
  });

  el.openOptions.addEventListener("click", async () => {
    await chrome.runtime.openOptionsPage();
    window.close();
  });

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "local") return;
    if (changes.uiLocale) {
      state.locale = changes.uiLocale.newValue;
      fillLocaleSelect(el.localeSelect, state.locale);
      renderStaticText();
      renderUser();
      renderCurrentTab();
      renderState();
      renderPrompts();
      return;
    }

    if (changes[LOCAL_PROFILE_STORAGE_KEY] || changes[LOCAL_USAGE_STORAGE_KEY]) {
      fetchUser().then(renderUser).catch(() => undefined);
    }

    if (changes[PROMPTS_STORAGE_KEY] || changes[PROMPT_FOLDERS_STORAGE_KEY]) {
      fetchPrompts().then(renderPrompts).catch(() => undefined);
    }

    fetchSnapshot().then(renderState).catch(() => undefined);
  });
}

async function bootstrap() {
  state.locale = await getLocale();
  fillLocaleSelect(el.localeSelect, state.locale);
  bindEvents();
  renderStaticText();
  renderUser();
  renderCurrentTab();
  renderState();
  renderPrompts();
  setPromptPanel(false);
  setStatus(t(state.locale, "popup.statusLoading"));

  try {
    await Promise.all([
      fetchCurrentTab(),
      fetchSnapshot(),
      fetchUser(),
      fetchNotebooks(false),
      fetchPrompts()
    ]);
    renderStaticText();
    renderUser();
    renderCurrentTab();
    renderState();
    await renderNotebookOptions();
    renderPrompts();
    setStatus(t(state.locale, "popup.statusReady"));
  } catch (error) {
    renderStaticText();
    renderUser();
    renderCurrentTab();
    renderState();
    renderPrompts();
    setStatus(text(`加载失败：${error.message}`, `Load failed: ${error.message}`));
  }
}

bootstrap();
