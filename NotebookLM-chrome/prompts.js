import { getLocale, setLocale, fillLocaleSelect, t } from "./i18n.js";

const MESSAGE_TIMEOUT_MS = 30000;

const el = {
  localeSelect: document.getElementById("localeSelect"),
  pageTitle: document.getElementById("pageTitle"),
  pageCaption: document.getElementById("pageCaption"),
  buildInfo: document.getElementById("buildInfo"),
  backToPopup: document.getElementById("backToPopup"),
  heroEyebrow: document.getElementById("heroEyebrow"),
  heroTitle: document.getElementById("heroTitle"),
  heroSummary: document.getElementById("heroSummary"),
  metricCountLabel: document.getElementById("metricCountLabel"),
  metricCountValue: document.getElementById("metricCountValue"),
  metricFolderLabel: document.getElementById("metricFolderLabel"),
  metricFolderValue: document.getElementById("metricFolderValue"),
  promptSearchInput: document.getElementById("promptSearchInput"),
  promptFolderFilter: document.getElementById("promptFolderFilter"),
  createPromptButton: document.getElementById("createPromptButton"),
  listEyebrow: document.getElementById("listEyebrow"),
  listTitle: document.getElementById("listTitle"),
  promptList: document.getElementById("promptList"),
  pageStatus: document.getElementById("pageStatus"),
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
  prompts: [],
  promptFolders: [],
  promptSearchKey: "",
  promptFolderFilter: "all",
  editingPromptId: ""
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
  el.pageStatus.textContent = String(message || "");
}

async function sendMessage(message, timeoutMs = MESSAGE_TIMEOUT_MS) {
  return Promise.race([
    chrome.runtime.sendMessage(message),
    new Promise((_, reject) => setTimeout(() => reject(new Error("request_timeout")), timeoutMs))
  ]);
}

function showDialog(dialog) {
  if (dialog && typeof dialog.showModal === "function") dialog.showModal();
}

function closeDialog(dialog) {
  if (dialog && typeof dialog.close === "function") dialog.close();
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

async function invokeAction(button, loadingText, task) {
  return setButtonLoading(button, loadingText)(task);
}

async function fetchPrompts() {
  const response = await sendMessage({ type: "GET_PROMPTS" }, 30000);
  if (!response?.ok) throw new Error(response?.error || "get_prompts_failed");
  state.prompts = Array.isArray(response.prompts) ? response.prompts : [];
  state.promptFolders = Array.isArray(response.folders) ? response.folders : [];
}

function renderStaticText() {
  const manifest = chrome.runtime.getManifest();
  document.title = text("空来Ai-NotebookLM辅助器 | 提示词", "Konglai Ai - Prompt Library");
  el.pageTitle.textContent = text("提示词工作台", "Prompt Workspace");
  el.pageCaption.textContent = text("独立页面管理可复用提示词", "Manage reusable prompts in a dedicated page");
  el.buildInfo.textContent = t(state.locale, "common.version", { version: manifest.version });
  el.backToPopup.textContent = text("返回设置", "Open Settings");
  el.heroEyebrow.textContent = text("Prompt Library", "Prompt Library");
  el.heroTitle.textContent = text("把提示词单独放到一个舒服的页面里", "Keep prompts on a dedicated page");
  el.heroSummary.textContent = text(
    "这里专门管理提示词、分组、收藏和快速复制，不再挤在 popup 里。",
    "This page is dedicated to prompts, folders, favorites, and quick copy instead of squeezing them into the popup."
  );
  el.metricCountLabel.textContent = text("提示词总数", "Prompts");
  el.metricFolderLabel.textContent = text("分组数量", "Folders");
  el.promptSearchInput.placeholder = text("搜索标题、内容或标签", "Search title, content, or tags");
  el.createPromptButton.textContent = text("新建提示词", "New Prompt");
  el.listEyebrow.textContent = text("列表", "Library");
  el.listTitle.textContent = text("全部提示词", "All Prompts");
  el.promptDialogTitle.textContent = text("新建提示词", "New Prompt");
  el.promptTitleLabel.textContent = text("标题", "Title");
  el.promptFolderLabel.textContent = text("分组", "Folder");
  el.promptTagsLabel.textContent = text("标签", "Tags");
  el.promptContentLabel.textContent = text("内容", "Content");
  el.promptFavoriteLabel.textContent = text("加入收藏", "Favorite this prompt");
  el.promptDeleteButton.textContent = text("删除", "Delete");
  el.promptCancelButton.textContent = text("取消", "Cancel");
  el.promptSaveButton.textContent = text("保存", "Save");
}

function renderPromptFolderFilter() {
  const options = [{ id: "all", name: text("全部分组", "All Folders") }, ...state.promptFolders];
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
  el.metricCountValue.textContent = String(state.prompts.length);
  el.metricFolderValue.textContent = String(state.promptFolders.length);

  const key = String(state.promptSearchKey || "").trim().toLowerCase();
  const folderId = String(state.promptFolderFilter || "all");
  const rows = state.prompts.filter((item) => {
    if (folderId !== "all" && String(item.folderId || "all") !== folderId) return false;
    if (!key) return true;
    return [item.title, item.content, ...(item.tags || [])]
      .some((value) => String(value || "").toLowerCase().includes(key));
  });

  if (!rows.length) {
    el.promptList.innerHTML = `<article class="prompt-item"><div class="empty-state">${escapeHtml(text("还没有提示词，点右上角新建即可。", "No prompts yet. Click New Prompt to create one."))}</div></article>`;
    return;
  }

  el.promptList.innerHTML = rows.map((item) => {
    const folderName = state.promptFolders.find((folder) => folder.id === item.folderId)?.name || text("未分组", "Ungrouped");
    const updatedAt = item.updatedAt ? new Date(item.updatedAt).toLocaleString() : text("未知时间", "Unknown time");
    return `
      <article class="prompt-item">
        <div class="prompt-item-head">
          <div class="prompt-item-title-wrap">
            <div class="prompt-item-title">${escapeHtml(item.favorite ? `★ ${item.title}` : item.title)}</div>
            <div class="prompt-meta">${escapeHtml(folderName)} · ${escapeHtml(updatedAt)}</div>
          </div>
          <span class="prompt-folder-badge">${escapeHtml(folderName)}</span>
        </div>
        <div class="prompt-content">${escapeHtml(item.content || "")}</div>
        <div class="prompt-tag-list">${(item.tags || []).map((tag) => `<span class="prompt-tag">${escapeHtml(tag)}</span>`).join("")}</div>
        <div class="prompt-item-actions">
          <button class="secondary-button" type="button" data-action="copy" data-prompt-id="${escapeHtml(item.id)}">${escapeHtml(text("复制", "Copy"))}</button>
          <button class="secondary-button" type="button" data-action="edit" data-prompt-id="${escapeHtml(item.id)}">${escapeHtml(text("编辑", "Edit"))}</button>
          <button class="ghost-button" type="button" data-action="delete" data-prompt-id="${escapeHtml(item.id)}">${escapeHtml(text("删除", "Delete"))}</button>
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
      deletePrompt(prompt.id).catch((error) => setStatus(text(`删除失败：${error.message}`, `Delete failed: ${error.message}`)));
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
  setStatus(text("提示词已保存。", "Prompt saved."));
}

async function deletePrompt(id) {
  const response = await sendMessage({ type: "DELETE_PROMPT", id }, 30000);
  if (!response?.ok) throw new Error(response?.error || "delete_prompt_failed");
  state.prompts = Array.isArray(response.prompts) ? response.prompts : state.prompts;
  closeDialog(el.promptDialog);
  renderPrompts();
  setStatus(text("提示词已删除。", "Prompt deleted."));
}

async function openOptionsPage() {
  await chrome.runtime.openOptionsPage();
}

function bindEvents() {
  el.localeSelect.addEventListener("change", async () => {
    state.locale = await setLocale(el.localeSelect.value);
    fillLocaleSelect(el.localeSelect, state.locale);
    renderStaticText();
    renderPrompts();
  });

  el.backToPopup.addEventListener("click", () => {
    invokeAction(el.backToPopup, text("打开中...", "Opening..."), openOptionsPage)
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

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "local") return;
    if (changes.uiLocale) {
      state.locale = changes.uiLocale.newValue;
      fillLocaleSelect(el.localeSelect, state.locale);
      renderStaticText();
      renderPrompts();
    }
  });
}

async function bootstrap() {
  state.locale = await getLocale();
  fillLocaleSelect(el.localeSelect, state.locale);
  bindEvents();
  renderStaticText();
  setStatus(text("正在加载提示词...", "Loading prompts..."));

  try {
    await fetchPrompts();
    renderPrompts();
    setStatus(text("提示词页面已就绪。", "Prompt page ready."));
  } catch (error) {
    renderPrompts();
    setStatus(text(`加载失败：${error.message}`, `Load failed: ${error.message}`));
  }
}

bootstrap();
