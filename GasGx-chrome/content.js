const INJECTED_FLAG = "data-gasgx-save-injected";
const CATEGORY_PICKER_CLASS = "gasgx-category-picker";
const FALLBACK_CATEGORY_OPTIONS = ["Insights", "Mining", "Gas Energy", "Events", "Generators", "Data"];
const LINKEDIN_COPY_LINK_LABELS = ["Copy link", "Copy post link", "Copy post URL", "Copy article link"];
const LOG_PREFIX = "[GasGx Collector]";

let categoryOptions = [...FALLBACK_CATEGORY_OPTIONS];
let pageRules = [];
let closeActiveCategoryPicker = null;
let activeAdapter = null;
let activeRouteKey = "";
const savedUrls = new Set();
const activeButtons = new WeakSet();

function getRuntimeApi() {
  return typeof chrome !== "undefined" && chrome.runtime?.id ? chrome.runtime : null;
}

function sendRuntimeMessage(message) {
  const runtime = getRuntimeApi();
  if (!runtime) throw new Error("Extension context invalidated. Reload the page.");
  return new Promise((resolve, reject) => {
    runtime.sendMessage(message, (response) => {
      const lastError = runtime.lastError;
      if (lastError) {
        reject(new Error(lastError.message || "Runtime messaging failed"));
        return;
      }
      resolve(response);
    });
  });
}

function detectPlatform() {
  const host = String(window.location.hostname || "").toLowerCase();
  if (host.includes("linkedin.com")) return "linkedin";
  if (host === "x.com" || host === "www.x.com" || host === "twitter.com" || host === "www.twitter.com") return "x";
  return "web";
}

function normalizeText(text) {
  return String(text || "").replace(/\s+/g, " ").trim();
}

function unique(values) {
  return [...new Set((values || []).map((value) => String(value || "").trim()).filter(Boolean))];
}

function isVisibleElement(element) {
  if (!(element instanceof Element)) return false;
  const style = window.getComputedStyle(element);
  if (style.display === "none" || style.visibility === "hidden") return false;
  const rect = element.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0;
}

async function loadCollectorSettings() {
  try {
    const response = await sendRuntimeMessage({ type: "GET_COLLECTOR_SETTINGS" });
    const settings = response?.settings || {};
    applyCollectorSettings(settings);
  } catch (error) {
    console.warn(`${LOG_PREFIX} Failed to load settings`, error);
    categoryOptions = [...FALLBACK_CATEGORY_OPTIONS];
    pageRules = [];
  }
}

function applyCollectorSettings(settings) {
  categoryOptions = Array.isArray(settings?.categoryOptions) && settings.categoryOptions.length
    ? settings.categoryOptions.map((item) => String(item || "").trim()).filter(Boolean)
    : [...FALLBACK_CATEGORY_OPTIONS];
  pageRules = Array.isArray(settings?.pageRules) ? settings.pageRules : [];
}

function getRulesForPlatform(platform) {
  return pageRules.filter((rule) => String(rule?.platform || "").toLowerCase() === platform);
}

function getActiveRule(platform) {
  const pathname = window.location.pathname || "/";
  const rules = getRulesForPlatform(platform);
  return rules.find((rule) => (rule.pathnamePrefixes || []).some((prefix) => pathname.startsWith(prefix))) || rules[0] || null;
}

function resolvePageInjectionHost(postElement, rule) {
  const selectors = unique(rule?.injectionHostSelectors);
  for (const selector of selectors) {
    const host = postElement.matches?.(selector) ? postElement : postElement.closest?.(selector);
    if (host instanceof HTMLElement) return host;
  }
  return postElement instanceof HTMLElement ? postElement : null;
}

function findActionBar(postElement, rule) {
  for (const selector of unique(rule?.actionBarSelectors)) {
    const bar = postElement.querySelector(selector);
    if (bar instanceof HTMLElement && isVisibleElement(bar)) return bar;
  }
  return null;
}

function extractLinkedInActivityId(text) {
  const value = String(text || "");
  const match = value.match(/urn:li:activity:(\d+)/i) || value.match(/activity-(\d+)/i);
  return match ? match[1] : "";
}

function normalizeLinkedInPublicPostUrl(rawHref, preserveSearch = true) {
  try {
    const url = new URL(String(rawHref || ""), window.location.origin);
    if (!/linkedin\.com$/i.test(url.hostname) || !url.pathname.includes("/posts/")) return "";
    const base = `${url.origin}${url.pathname}`.replace(/\/+$/, "");
    return preserveSearch && url.search ? `${base}${url.search}` : base;
  } catch (_) {
    return "";
  }
}

function normalizeLinkedInPostUrl(rawHref) {
  const publicUrl = normalizeLinkedInPublicPostUrl(rawHref, true);
  if (publicUrl) return publicUrl;
  const activityId = extractLinkedInActivityId(rawHref);
  return activityId ? `https://www.linkedin.com/feed/update/urn:li:activity:${activityId}` : "";
}

function extractLinkedInPostUrl(postElement) {
  for (const link of postElement.querySelectorAll("a[href]")) {
    const publicUrl = normalizeLinkedInPublicPostUrl(link.getAttribute("href") || link.href, true);
    if (publicUrl) return publicUrl;
  }
  for (const link of postElement.querySelectorAll("a[href]")) {
    const url = normalizeLinkedInPostUrl(link.getAttribute("href") || link.href);
    if (url) return url;
  }
  const attributes = ["data-urn", "data-entity-urn", "data-activity-urn", "data-id"];
  for (const node of [postElement, ...postElement.querySelectorAll("[data-urn], [data-entity-urn], [data-activity-urn], [data-id]")]) {
    for (const name of attributes) {
      const activityId = extractLinkedInActivityId(node.getAttribute?.(name));
      if (activityId) return `https://www.linkedin.com/feed/update/urn:li:activity:${activityId}`;
    }
  }
  return "";
}

function findLinkedInControlMenuTrigger(postElement, rule) {
  for (const selector of unique(rule?.controlMenuTriggerSelectors)) {
    const trigger = postElement.querySelector(selector);
    if (trigger instanceof HTMLElement && isVisibleElement(trigger)) return trigger;
  }
  return null;
}

async function debuggerClickPoint(x, y, purpose) {
  const response = await sendRuntimeMessage({
    type: "DEBUGGER_CLICK_AT_POINT",
    payload: { x, y, purpose }
  });
  if (!response?.ok) throw new Error(response?.error || "Debugger click failed");
}

async function debuggerClickElement(element, purpose) {
  element.scrollIntoView({ block: "center", inline: "center" });
  await wait(80);
  const rect = element.getBoundingClientRect();
  await debuggerClickPoint(rect.left + rect.width / 2, rect.top + rect.height / 2, purpose);
}

function findVisibleLinkedInCopyLinkItem(rule) {
  for (const selector of unique(rule?.copyLinkMenuItemSelectors)) {
    const node = [...document.querySelectorAll(selector)]
      .find((item) => item instanceof HTMLElement && isVisibleElement(item));
    if (node) return node.closest("button, a, [role='menuitem'], li, div") || node;
  }

  const fallback = [...document.querySelectorAll("button, a, [role='menuitem'], li, p, span, div")]
    .find((node) => (
      node instanceof HTMLElement &&
      isVisibleElement(node) &&
      LINKEDIN_COPY_LINK_LABELS.some((label) => normalizeText(node.textContent).toLowerCase().includes(label.toLowerCase()))
    ));
  return fallback ? (fallback.closest("button, a, [role='menuitem'], li, div") || fallback) : null;
}

function findToastPublicLink(expectedActivityId) {
  const selectors = [
    "#artdeco-toasts a[href]",
    ".artdeco-toasts a[href]",
    ".artdeco-toast-item__cta[href]",
    "[data-test-artdeco-toast-item-type] a[href]"
  ];
  const visibleAnchors = selectors.flatMap((selector) => [...document.querySelectorAll(selector)])
    .filter((node) => node instanceof HTMLAnchorElement && isVisibleElement(node));

  let firstPublic = "";
  for (const anchor of visibleAnchors) {
    const publicUrl = normalizeLinkedInPublicPostUrl(anchor.getAttribute("href") || anchor.href, true);
    if (!publicUrl) continue;
    if (!firstPublic) firstPublic = publicUrl;
    const activityId = extractLinkedInActivityId(publicUrl);
    if (!expectedActivityId || !activityId || activityId === expectedActivityId) return publicUrl;
  }
  return firstPublic;
}

async function waitForToastPublicLink(expectedActivityId, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const publicUrl = findToastPublicLink(expectedActivityId);
    if (publicUrl) return publicUrl;
    await wait(60);
  }
  return "";
}

async function extractLinkedInPublicUrlViaCopyLink(postElement, rule) {
  const existing = extractLinkedInPostUrl(postElement);
  const publicExisting = normalizeLinkedInPublicPostUrl(existing, true);
  if (publicExisting) return publicExisting;

  const trigger = findLinkedInControlMenuTrigger(postElement, rule);
  if (!(trigger instanceof HTMLElement)) return existing;

  await debuggerClickElement(trigger, "linkedin-menu-trigger");
  await wait(220);
  const menuItem = findVisibleLinkedInCopyLinkItem(rule);
  if (!(menuItem instanceof HTMLElement)) {
    console.warn(`${LOG_PREFIX} LinkedIn copy-link menu item not found`);
    return existing;
  }

  const rect = menuItem.getBoundingClientRect();
  const points = [
    [rect.left + Math.min(40, Math.max(16, rect.width * 0.25)), rect.top + rect.height / 2],
    [rect.left + rect.width / 2, rect.top + rect.height / 2]
  ];
  const expectedActivityId = extractLinkedInActivityId(existing);

  for (const [x, y] of points) {
    console.info(`${LOG_PREFIX} Trying LinkedIn copy-link click point`, { x, y });
    await debuggerClickPoint(x, y, "linkedin-copy-link");
    const publicUrl = await waitForToastPublicLink(expectedActivityId, 900);
    if (publicUrl) {
      console.info(`${LOG_PREFIX} LinkedIn public URL captured from toast: ${publicUrl}`);
      return publicUrl;
    }
  }

  return existing;
}

function extractLinkedInAuthor(postElement, fallbackUrl = "") {
  const selectors = [
    ".update-components-actor__title",
    ".feed-shared-actor__name",
    ".update-components-actor__meta-link",
    "a[href*='/in/']",
    "a[href*='/company/']"
  ];
  for (const selector of selectors) {
    const node = postElement.querySelector(selector);
    const text = normalizeText(node?.textContent);
    if (text) return text;
  }
  const activityId = extractLinkedInActivityId(fallbackUrl);
  return activityId ? `LinkedIn ${activityId}` : "LinkedIn";
}

function extractLinkedInPublishedTime(postElement) {
  const node = postElement.querySelector("time, .update-components-actor__sub-description, .feed-shared-actor__sub-description");
  return normalizeText(node?.textContent);
}

function extractLinkedInPostSnippet(postElement) {
  const selectors = [
    ".update-components-text",
    ".feed-shared-update-v2__description",
    ".feed-shared-inline-show-more-text",
    ".update-components-update-v2__commentary"
  ];
  for (const selector of selectors) {
    const text = normalizeText(postElement.querySelector(selector)?.textContent);
    if (text) return text;
  }
  return normalizeText(postElement.textContent).slice(0, 500);
}

function extractLinkedInPostTitle(postElement, fallbackSnippet = "") {
  const author = extractLinkedInAuthor(postElement);
  const snippet = fallbackSnippet || extractLinkedInPostSnippet(postElement);
  return normalizeText(`${author} ${snippet}`.slice(0, 180));
}

function extractXPostUrl(postElement) {
  for (const link of postElement.querySelectorAll("a[href*='/status/'], a[href*='/i/web/status/']")) {
    try {
      const url = new URL(link.getAttribute("href") || link.href, window.location.origin);
      const direct = url.pathname.match(/^\/([A-Za-z0-9_]{1,20})\/status\/(\d+)/i);
      if (direct) return `https://x.com/${direct[1]}/status/${direct[2]}`;
      const web = url.pathname.match(/^\/i\/web\/status\/(\d+)/i);
      if (web) return `https://x.com/i/web/status/${web[1]}`;
    } catch (_) {
      // ignore
    }
  }
  return "";
}

function extractXAuthor(postElement, fallbackUrl = "") {
  const text = normalizeText(postElement.querySelector("[data-testid='User-Name']")?.textContent);
  if (text) return text;
  const match = String(fallbackUrl || "").match(/x\.com\/([^/]+)\/status\//i);
  return match ? match[1] : "X";
}

function extractXPublishedTime(postElement) {
  const timeNode = postElement.querySelector("time");
  return normalizeText(timeNode?.getAttribute("datetime") || timeNode?.textContent);
}

function extractXPostSnippet(postElement) {
  const text = normalizeText(postElement.querySelector("[data-testid='tweetText']")?.textContent);
  return text || normalizeText(postElement.textContent).slice(0, 500);
}

function extractXPostTitle(postElement, fallbackSnippet = "") {
  const author = extractXAuthor(postElement);
  const snippet = fallbackSnippet || extractXPostSnippet(postElement);
  return normalizeText(`${author} ${snippet}`.slice(0, 180));
}

function getPlatformAdapter() {
  const platform = detectPlatform();
  const rule = getActiveRule(platform);
  if (platform === "linkedin") {
    const selector = unique(rule?.postSelectors).join(", ");
    return {
      platform,
      rule,
      selector,
      resolveInjectionHost(postElement) {
        return resolvePageInjectionHost(postElement, rule);
      },
      findActionBar(postElement) {
        return findActionBar(postElement, rule);
      },
      extractUrl(postElement) {
        return extractLinkedInPostUrl(postElement);
      },
      async resolveUrl(postElement) {
        return extractLinkedInPublicUrlViaCopyLink(postElement, rule);
      },
      extractAuthor: extractLinkedInAuthor,
      extractPublishedTime: extractLinkedInPublishedTime,
      extractSnippet: extractLinkedInPostSnippet,
      extractTitle: extractLinkedInPostTitle,
      isPostElement(postElement) {
        return Boolean(
          extractLinkedInPostUrl(postElement) ||
          findActionBar(postElement, rule) ||
          findLinkedInControlMenuTrigger(postElement, rule)
        );
      }
    };
  }

  if (platform === "x") {
    const selector = unique(rule?.postSelectors).join(", ");
    return {
      platform,
      rule,
      selector,
      resolveInjectionHost(postElement) {
        return resolvePageInjectionHost(postElement, rule);
      },
      findActionBar(postElement) {
        return findActionBar(postElement, rule);
      },
      extractUrl(postElement) {
        return extractXPostUrl(postElement);
      },
      async resolveUrl(postElement) {
        return extractXPostUrl(postElement);
      },
      extractAuthor: extractXAuthor,
      extractPublishedTime: extractXPublishedTime,
      extractSnippet: extractXPostSnippet,
      extractTitle: extractXPostTitle,
      isPostElement(postElement) {
        return Boolean(extractXPostUrl(postElement) || findActionBar(postElement, rule));
      }
    };
  }

  return null;
}

function removeCategoryPicker(selectedCategory = null) {
  if (typeof closeActiveCategoryPicker === "function") {
    closeActiveCategoryPicker(selectedCategory);
    return;
  }
  document.querySelector(`.${CATEGORY_PICKER_CLASS}`)?.remove();
}

function showCategoryPicker(anchorButton) {
  removeCategoryPicker();
  const picker = document.createElement("div");
  picker.className = CATEGORY_PICKER_CLASS;
  picker.innerHTML = '<div class="gasgx-category-picker__title">Choose category</div>';

  const list = document.createElement("div");
  list.className = "gasgx-category-picker__options";
  picker.appendChild(list);

  const cancel = document.createElement("button");
  cancel.type = "button";
  cancel.className = "gasgx-category-picker__cancel";
  cancel.textContent = "Cancel";
  picker.appendChild(cancel);

  categoryOptions.forEach((category) => {
    const option = document.createElement("button");
    option.type = "button";
    option.className = "gasgx-category-picker__option";
    option.dataset.category = category;
    option.textContent = category;
    list.appendChild(option);
  });

  const rect = anchorButton.getBoundingClientRect();
  picker.style.top = `${window.scrollY + rect.bottom + 8}px`;
  picker.style.left = `${window.scrollX + Math.max(16, rect.left)}px`;
  document.body.appendChild(picker);

  return new Promise((resolve) => {
    let settled = false;
    const ignoreUntil = performance.now() + 250;

    const finish = (value) => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(value);
    };

    const onPointerDown = (event) => {
      if (performance.now() < ignoreUntil) return;
      const target = event.target;
      if (target instanceof Node && picker.contains(target)) return;
      if (target === anchorButton) return;
      finish(null);
    };

    const onKeyDown = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        finish(null);
      }
    };

    const cleanup = () => {
      document.removeEventListener("mousedown", onPointerDown, true);
      document.removeEventListener("keydown", onKeyDown, true);
      if (closeActiveCategoryPicker === finish) closeActiveCategoryPicker = null;
      picker.remove();
    };

    closeActiveCategoryPicker = finish;

    picker.querySelectorAll(".gasgx-category-picker__option").forEach((button) => {
      button.addEventListener("click", () => finish(button.dataset.category || null));
    });
    cancel.addEventListener("click", () => finish(null));

    document.addEventListener("mousedown", onPointerDown, true);
    document.addEventListener("keydown", onKeyDown, true);
  });
}

function setButtonState(button, state, errorMessage = "") {
  button.className = "gasgx-save-button";
  button.disabled = false;
  button.title = "";

  if (state === "resolving") {
    button.textContent = "Finding Link...";
    button.disabled = true;
    button.classList.add("gasgx-save-button--saving");
    return;
  }
  if (state === "saving") {
    button.textContent = "Saving...";
    button.disabled = true;
    button.classList.add("gasgx-save-button--saving");
    return;
  }
  if (state === "saved") {
    button.textContent = "Saved";
    button.disabled = true;
    button.classList.add("gasgx-save-button--saved");
    return;
  }
  if (state === "error") {
    button.textContent = String(errorMessage || "").toLowerCase().includes("no post url") ? "No Post URL" : "Retry Save";
    button.title = errorMessage || "Save failed";
    button.classList.add("gasgx-save-button--error");
    return;
  }
  button.textContent = "Save to DB";
}

async function handleSaveClick(button, postElement) {
  if (activeButtons.has(button)) return;
  activeButtons.add(button);
  console.info(`${LOG_PREFIX} Save button clicked`);
  try {
    const category = await showCategoryPicker(button);
    if (!category) {
      setButtonState(button, "idle");
      return;
    }
    setButtonState(button, "resolving");
    const postUrl = await activeAdapter.resolveUrl(postElement);
    if (!postUrl) {
      setButtonState(button, "error", "No post URL found");
      return;
    }
    if (savedUrls.has(postUrl)) {
      setButtonState(button, "saved");
      return;
    }
    setButtonState(button, "saving");
    const snippet = activeAdapter.extractSnippet(postElement);
    const response = await sendRuntimeMessage({
      type: "SAVE_SOCIAL_POST",
      payload: {
        platform: activeAdapter.platform,
        post_url: postUrl,
        category,
        title: activeAdapter.extractTitle(postElement, snippet),
        snippet,
        author: activeAdapter.extractAuthor(postElement, postUrl),
        published_time: activeAdapter.extractPublishedTime(postElement),
        status: "pending"
      }
    });
    if (!response?.ok) throw new Error(response?.error || "Save failed");
    savedUrls.add(postUrl);
    setButtonState(button, "saved");
  } catch (error) {
    console.error(`${LOG_PREFIX} Save failed`, error);
    setButtonState(button, "error", error?.message || "Save failed");
  } finally {
    activeButtons.delete(button);
  }
}

function createSaveButton(postElement) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "gasgx-save-button";
  setButtonState(button, "idle");

  const run = (event) => {
    event.preventDefault();
    event.stopPropagation();
    if (typeof event.stopImmediatePropagation === "function") event.stopImmediatePropagation();
    handleSaveClick(button, postElement);
  };

  button.addEventListener("pointerdown", run, true);
  button.addEventListener("mousedown", run, true);
  button.addEventListener("click", run, true);
  return button;
}

function insertButton(postElement) {
  if (!activeAdapter) return;
  const host = activeAdapter.resolveInjectionHost(postElement);
  if (!(host instanceof HTMLElement)) return;
  if (!activeAdapter.isPostElement(host)) return;
  if (host.getAttribute(INJECTED_FLAG) === "1") return;

  const actionBar = activeAdapter.findActionBar(host);
  if (actionBar?.querySelector(".gasgx-save-button, .gasgx-save-button-container")) {
    host.setAttribute(INJECTED_FLAG, "1");
    return;
  }
  if (activeAdapter.rule?.injectMode === "after_action_bar") {
    const next = actionBar?.nextElementSibling;
    if (next instanceof HTMLElement && next.classList.contains("gasgx-save-button-container")) {
      host.setAttribute(INJECTED_FLAG, "1");
      return;
    }
  }

  const button = createSaveButton(host);
  host.setAttribute(INJECTED_FLAG, "1");

  if (actionBar instanceof HTMLElement) {
    if (activeAdapter.rule?.injectMode === "after_action_bar") {
      const container = document.createElement("div");
      container.className = "gasgx-save-button-container gasgx-save-button-container--after";
      container.appendChild(button);
      actionBar.insertAdjacentElement("afterend", container);
      console.info(`${LOG_PREFIX} Injected Save button after LinkedIn search result action bar`);
      return;
    }
    actionBar.appendChild(button);
    return;
  }

  const fallback = document.createElement("div");
  fallback.className = "gasgx-save-button-container";
  fallback.appendChild(button);
  host.appendChild(fallback);
}

function resetInjectedButtons() {
  document.querySelectorAll(".gasgx-save-button-container").forEach((node) => node.remove());
  document.querySelectorAll(".gasgx-save-button").forEach((node) => node.remove());
  document.querySelectorAll(`[${INJECTED_FLAG}]`).forEach((node) => node.removeAttribute(INJECTED_FLAG));
}

function scanAndInject() {
  if (!activeAdapter?.selector) return;
  document.querySelectorAll(activeAdapter.selector).forEach((postElement) => insertButton(postElement));
}

let rafScheduled = false;
function scheduleScan() {
  if (rafScheduled) return;
  rafScheduled = true;
  window.requestAnimationFrame(() => {
    rafScheduled = false;
    refreshAdapter();
    scanAndInject();
  });
}

function refreshAdapter(force = false) {
  const nextKey = `${detectPlatform()}:${window.location.pathname}`;
  if (!force && activeRouteKey === nextKey) return;
  activeRouteKey = nextKey;
  activeAdapter = getPlatformAdapter();
  resetInjectedButtons();
}

function observeRouteChanges() {
  const wrap = (name) => {
    const original = history[name];
    if (typeof original !== "function") return;
    history[name] = function wrappedHistoryMethod(...args) {
      const result = original.apply(this, args);
      window.setTimeout(() => scheduleScan(), 50);
      return result;
    };
  };
  wrap("pushState");
  wrap("replaceState");
  window.addEventListener("popstate", () => scheduleScan(), true);
}

function wait(ms) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

const observer = new MutationObserver(() => scheduleScan());

async function start() {
  if (!document.body) {
    window.requestAnimationFrame(start);
    return;
  }
  await loadCollectorSettings();
  refreshAdapter(true);
  observeRouteChanges();
  observer.observe(document.body, { childList: true, subtree: true });
  scanAndInject();
}

if (typeof chrome !== "undefined" && chrome.storage?.onChanged) {
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== "local" || !changes?.collector_settings_v1) return;
    applyCollectorSettings(changes.collector_settings_v1.newValue || {});
    refreshAdapter(true);
    scheduleScan();
  });
}

start();
