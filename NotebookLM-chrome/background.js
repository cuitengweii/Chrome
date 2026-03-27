import {
  RULES_KEY,
  LEGACY_RULE_KEY,
  RUNTIME_KEY,
  ALARM_NAME,
  DEFAULT_RULE,
  DEFAULT_RUNTIME,
  normalizeRule,
  normalizeRuntime,
  normalizeNotebookUrl,
  compareNotebookUrls,
  appendRunLog
} from "./settings.js";
import { getLocale, t, localizeResult } from "./i18n.js";

const LOG_PREFIX = "[NotebookLM Refresh]";
const NOTEBOOK_URL_PATTERN = "https://notebooklm.google.com/*";
const NOTEBOOK_HOME_URL = "https://notebooklm.google.com/";
const NOTIFICATION_ICON = "icons/icon128.png";
const PODCAST_FEEDS_KEY = "podcastFeeds";
const FAVORITES_KEY = "favoriteNotebooks";
const COLLECTIONS_KEY = "notebookCollections";
const TEMPLATES_KEY = "ruleTemplates";
const NOTEBOOK_TAGS_KEY = "notebookTags";
const AUDIO_TASKS_KEY = "audioOverviewTasks";
const FOLDERS_KEY = "foldersByType";
const FOLDER_ASSIGNMENTS_KEY = "folderAssignmentsByType";
const NOTEBOOK_LIST_CACHE_TTL_MS = 60000;
const NOTEBOOK_SOURCES_CACHE_TTL_MS = 120000;
const NOTEBOOK_RPC_IDS = Object.freeze({
  LIST_NOTEBOOKS: "wXbhsf",
  CHECK_SOURCE_STATUS: "rLM1Ne",
  GET_SOURCE_CONTENT: "hizoJc",
  GET_GENERATED_CONTENT: "cFji9",
  GET_GENERATED_CONTENT_ALT: "gArtLc",
  CREATE_NOTEBOOK: "CCqFvf",
  ADD_TEXT_SOURCE: "izAoDd",
  SYNC_GDOC_SOURCE: "FLmJqe",
  DELETE_SOURCE: "tGMBJ",
  DELETE_NOTEBOOK: "WWINqb"
});

let storageChain = Promise.resolve();
let executionChain = Promise.resolve();
let notebookListCache = {
  at: 0,
  notebooks: null
};
let notebookSourcesCache = new Map();

function nowIso() {
  return new Date().toISOString();
}

function minutesSince(isoString) {
  if (!isoString) return Number.POSITIVE_INFINITY;
  const ts = Date.parse(isoString);
  if (!Number.isFinite(ts)) return Number.POSITIVE_INFINITY;
  return (Date.now() - ts) / 60000;
}

function withTimeout(promise, timeoutMs, errorMessage) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error(errorMessage)), timeoutMs))
  ]);
}

async function runWithAuthUsers(task, authUsers = [0, 1, 2, 3, 4]) {
  const errors = [];
  for (const authuser of authUsers) {
    try {
      const client = await createNotebookRpcClient(authuser);
      return await task(client, authuser);
    } catch (error) {
      errors.push(`authuser_${authuser}:${error?.message || "rpc_failed"}`);
    }
  }
  throw new Error(errors.join("|").slice(0, 800) || "rpc_failed");
}

function toAlarmTickMinutes(intervalMinutes) {
  if (intervalMinutes <= 15) return intervalMinutes;
  if (intervalMinutes <= 60) return 5;
  return 15;
}

async function readState() {
  const data = await chrome.storage.local.get([RULES_KEY, LEGACY_RULE_KEY, RUNTIME_KEY]);
  const ruleSource = data[RULES_KEY] || data[LEGACY_RULE_KEY] || DEFAULT_RULE;
  return {
    rule: normalizeRule(ruleSource),
    runtime: normalizeRuntime(data[RUNTIME_KEY] || DEFAULT_RUNTIME)
  };
}

async function writeState(state) {
  const normalized = {
    rule: normalizeRule(state.rule || DEFAULT_RULE),
    runtime: normalizeRuntime(state.runtime || DEFAULT_RUNTIME)
  };
  await chrome.storage.local.set({
    [RULES_KEY]: normalized.rule,
    [RUNTIME_KEY]: normalized.runtime
  });
  return normalized;
}

function mutateState(mutator) {
  const task = storageChain.then(async () => {
    const current = await readState();
    const draft = {
      rule: structuredClone(current.rule),
      runtime: structuredClone(current.runtime)
    };
    const next = await mutator(draft);
    return writeState(next || draft);
  });
  storageChain = task.then(() => undefined, () => undefined);
  return task;
}

async function ensureInitialized() {
  const state = await readState();
  return writeState(state);
}

async function syncAlarm(rule = null) {
  const effectiveRule = normalizeRule(rule || (await readState()).rule);
  await chrome.alarms.clear(ALARM_NAME);
  if (!effectiveRule.enabled) return null;
  const tickMinutes = toAlarmTickMinutes(effectiveRule.intervalMinutes);
  chrome.alarms.create(ALARM_NAME, {
    delayInMinutes: tickMinutes,
    periodInMinutes: tickMinutes
  });
  return chrome.alarms.get(ALARM_NAME);
}

async function buildStateSnapshot() {
  const state = await readState();
  const alarm = await chrome.alarms.get(ALARM_NAME);
  return {
    rule: state.rule,
    runtime: state.runtime,
    alarm: alarm
      ? {
        scheduledTime: alarm.scheduledTime || 0,
        periodInMinutes: alarm.periodInMinutes || state.rule.intervalMinutes
      }
      : null
  };
}

function buildErrorKey(result, message, targetUrl) {
  return `${targetUrl}|${result}|${String(message || "").trim()}`.slice(0, 360);
}

async function notifyFailure(errorKey, result, message) {
  if (!errorKey) return;
  try {
    const locale = await getLocale().catch(() => "en");
    await chrome.notifications.create("", {
      type: "basic",
      iconUrl: chrome.runtime.getURL(NOTIFICATION_ICON),
      title: `${t(locale, "common.appName")} · ${localizeResult(locale, result)}`,
      message: String(message || (locale.startsWith("zh") ? "请打开扩展查看详情。" : "Open the extension for details.")).slice(0, 240),
      priority: 1
    });
  } catch (error) {
    console.warn(`${LOG_PREFIX} failed to create notification`, error);
  }
}
async function findExactNotebookTab(targetUrl) {
  const tabs = await chrome.tabs.query({ url: [NOTEBOOK_URL_PATTERN] });
  return tabs.find((tab) => compareNotebookUrls(tab.url, targetUrl)) || null;
}

async function getDedicatedNotebookTab(targetUrl, runtime) {
  const normalizedUrl = normalizeNotebookUrl(targetUrl, "");
  const storedTabId = runtime.dedicatedTabs?.[normalizedUrl];

  if (Number.isInteger(storedTabId)) {
    const storedTab = await chrome.tabs.get(storedTabId).catch(() => null);
    if (storedTab && compareNotebookUrls(storedTab.url, normalizedUrl)) return storedTab;
  }

  const existingTargetTab = await findExactNotebookTab(normalizedUrl);
  if (existingTargetTab) {
    runtime.dedicatedTabs[normalizedUrl] = existingTargetTab.id;
    return existingTargetTab;
  }

  const createdTab = await chrome.tabs.create({ url: normalizedUrl, active: false });
  runtime.dedicatedTabs[normalizedUrl] = createdTab.id;
  return createdTab;
}

async function waitForTabComplete(tabId, timeoutMs = 20000) {
  const initialTab = await chrome.tabs.get(tabId).catch(() => null);
  if (initialTab?.status === "complete") return initialTab;

  return new Promise((resolve, reject) => {
    let settled = false;
    const cleanup = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      chrome.tabs.onUpdated.removeListener(handleUpdated);
      chrome.tabs.onRemoved.removeListener(handleRemoved);
    };
    const finish = (cb) => {
      cleanup();
      cb();
    };
    const handleUpdated = (updatedTabId, changeInfo, tab) => {
      if (updatedTabId !== tabId) return;
      if (changeInfo.status === "complete") finish(() => resolve(tab));
    };
    const handleRemoved = (removedTabId) => {
      if (removedTabId !== tabId) return;
      finish(() => reject(new Error("dedicated_tab_closed")));
    };
    const timer = setTimeout(() => finish(() => reject(new Error("tab_load_timeout"))), timeoutMs);

    chrome.tabs.onUpdated.addListener(handleUpdated);
    chrome.tabs.onRemoved.addListener(handleRemoved);
    chrome.tabs.get(tabId).then((tab) => {
      if (!settled && tab?.status === "complete") finish(() => resolve(tab));
    }).catch(() => undefined);
  });
}

async function loadNotebookIntoDedicatedTab(tabId, targetUrl) {
  const currentTab = await chrome.tabs.get(tabId).catch(() => null);
  if (!currentTab) throw new Error("dedicated_tab_missing");

  if (compareNotebookUrls(currentTab.url, targetUrl)) {
    await chrome.tabs.reload(tabId);
  } else {
    await chrome.tabs.update(tabId, { url: targetUrl, active: false });
  }
  return waitForTabComplete(tabId);
}

function classifyTabUrl(tabUrl) {
  if (!tabUrl) return { result: "page_error", message: "NotebookLM tab URL is empty." };
  try {
    const parsed = new URL(tabUrl);
    if (parsed.hostname === "notebooklm.google.com") return null;
    if (parsed.hostname.endsWith("google.com")) {
      return { result: "login_required", message: "NotebookLM tab redirected to login/account page." };
    }
    return { result: "page_error", message: `NotebookLM tab redirected to unexpected host: ${parsed.hostname}` };
  } catch (_) {
    return { result: "page_error", message: "NotebookLM tab URL cannot be parsed." };
  }
}
function notebookDomAutomation(payload) {
  const delay = (ms) => new Promise((resolve) => window.setTimeout(resolve, ms));
  const normalizeText = (value) => String(value || "").replace(/\s+/g, " ").trim().toLowerCase();
  const sourceNeedle = normalizeText(payload?.sourceLabel);
  const refreshNeedle = normalizeText(payload?.refreshLabel);

  const ACCESS_TOKENS = [
    "sign in", "choose an account", "request access", "you need access", "you need permission", "login",
    "??", "????", "??????", "????", "???????"
  ].map((item) => normalizeText(item));

  function isVisible(element) {
    if (!(element instanceof Element)) return false;
    const rect = element.getBoundingClientRect();
    const style = window.getComputedStyle(element);
    return rect.width > 0 && rect.height > 0 && style.visibility !== "hidden" && style.display !== "none" && style.pointerEvents !== "none";
  }

  function bodyText() {
    return normalizeText(document.body?.innerText || "");
  }

  function detectAccessIssue() {
    if (location.hostname !== "notebooklm.google.com") {
      return { ok: false, result: "login_required", stage: "precheck", message: "Current page is not NotebookLM." };
    }
    const pageText = bodyText();
    if (ACCESS_TOKENS.some((token) => token && pageText.includes(token))) {
      return { ok: false, result: "login_required", stage: "precheck", message: "Login or permission required." };
    }
    return null;
  }

  function findClickableAncestor(node) {
    let current = node instanceof Element ? node : node?.parentElement || null;
    while (current && current !== document.body) {
      const tag = current.tagName?.toLowerCase();
      const role = current.getAttribute?.("role");
      const ariaDisabled = current.getAttribute?.("aria-disabled");
      const hasTabIndex = current.hasAttribute?.("tabindex");
      const isClickable = tag === "button" || tag === "a" || role === "button" || typeof current.onclick === "function" || hasTabIndex;
      if (isClickable && ariaDisabled !== "true" && isVisible(current)) return current;
      current = current.parentElement;
    }
    return null;
  }

  function scoreMatch(candidate, needle) {
    if (!candidate || !needle) return 0;
    if (candidate === needle) return 5;
    if (candidate.includes(needle)) return 3;
    return 0;
  }

  function makeCandidate(element, strategy, matchedText, baseScore) {
    const clickable = findClickableAncestor(element) || (isVisible(element) ? element : null);
    if (!clickable) return null;
    const rect = clickable.getBoundingClientRect();
    const centerX = rect.left + (rect.width / 2);
    const leftPaneBonus = centerX < (window.innerWidth * 0.45) ? 0.75 : 0;
    return {
      element: clickable,
      strategy,
      matchedText: matchedText.slice(0, 140),
      tagName: clickable.tagName?.toLowerCase() || "",
      score: baseScore + leftPaneBonus
    };
  }

  function dedupeCandidates(candidates) {
    const bestByElement = new Map();
    for (const candidate of candidates) {
      if (!candidate?.element) continue;
      const existing = bestByElement.get(candidate.element);
      if (!existing || candidate.score > existing.score) bestByElement.set(candidate.element, candidate);
    }
    return [...bestByElement.values()].sort((left, right) => right.score - left.score);
  }

  function findBestSourceCandidate(needle) {
    const rawCandidates = [];
    const selector = ["button", "[role='button']", "[aria-label]", "a", "div", "span", "p"].join(", ");
    for (const element of document.querySelectorAll(selector)) {
      if (!isVisible(element)) continue;
      const ariaLabel = normalizeText(element.getAttribute?.("aria-label"));
      const ariaScore = scoreMatch(ariaLabel, needle);
      if (ariaScore > 0) {
        const c = makeCandidate(element, ariaScore >= 5 ? "aria-exact" : "aria-contains", ariaLabel, ariaScore + 2);
        if (c) rawCandidates.push(c);
      }
      const title = normalizeText(element.getAttribute?.("title"));
      const titleScore = scoreMatch(title, needle);
      if (titleScore > 0) {
        const c = makeCandidate(element, titleScore >= 5 ? "title-exact" : "title-contains", title, titleScore + 1);
        if (c) rawCandidates.push(c);
      }
      const text = normalizeText(element.textContent);
      const textScore = scoreMatch(text, needle);
      if (textScore > 0) {
        const c = makeCandidate(element, textScore >= 5 ? "text-exact" : "text-contains", text, textScore);
        if (c) rawCandidates.push(c);
      }
    }
    return dedupeCandidates(rawCandidates)[0] || null;
  }

  function hasRefreshHint(element) {
    if (!(element instanceof Element)) return false;
    const classText = normalizeText(element.className);
    const ariaLabel = normalizeText(element.getAttribute?.("aria-label"));
    const title = normalizeText(element.getAttribute?.("title"));
    const datasetText = normalizeText(JSON.stringify(element.dataset || {}));
    const combined = `${classText} ${ariaLabel} ${title} ${datasetText}`;
    return combined.includes("refresh") || combined.includes("source-refresh") || combined.includes("cloud") || combined.includes("drive") || combined.includes("鍚屾");
  }

  function findRefreshActionCandidate(needle) {
    const rawCandidates = [];
    const textNodes = document.querySelectorAll("span,div,p,button,[role='button']");
    for (const node of textNodes) {
      if (!isVisible(node)) continue;
      const nodeText = normalizeText(node.textContent);
      if (!scoreMatch(nodeText, needle)) continue;

      let current = node;
      for (let depth = 0; depth < 8 && current && current !== document.body; depth += 1) {
        if (hasRefreshHint(current) && isVisible(current)) {
          const c = makeCandidate(current, "refresh-hint", nodeText, 9 - depth);
          if (c) rawCandidates.push(c);
        }
        current = current.parentElement;
      }
      const fallback = makeCandidate(node, "refresh-text", nodeText, 6);
      if (fallback) rawCandidates.push(fallback);
    }
    return dedupeCandidates(rawCandidates)[0] || null;
  }

  function clickElement(candidate) {
    const element = candidate?.element;
    if (!(element instanceof Element)) return false;
    element.scrollIntoView({ behavior: "instant", block: "center", inline: "center" });
    if (typeof element.focus === "function") element.focus({ preventScroll: true });
    element.click();
    return true;
  }

  async function waitForCandidate(needle, timeoutMs, missResult, stage) {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const accessIssue = detectAccessIssue();
      if (accessIssue) return accessIssue;
      const candidate = stage === "locate_refresh" ? findRefreshActionCandidate(needle) : findBestSourceCandidate(needle);
      if (candidate) return { ok: true, candidate };
      await delay(300);
    }
    return {
      ok: false,
      result: missResult,
      stage,
      message: stage === "locate_source"
        ? `source not found in 15s: ${payload?.sourceLabel || ""}`
        : `refresh entry not found in 5s: ${payload?.refreshLabel || ""}`
    };
  }

  return (async () => {
    if (!document.body) return { ok: false, result: "page_error", stage: "precheck", message: "document.body is not ready." };
    const initialIssue = detectAccessIssue();
    if (initialIssue) return initialIssue;

    const sourceMatch = await waitForCandidate(sourceNeedle, 15000, "source_not_found", "locate_source");
    if (!sourceMatch.ok) return sourceMatch;
    clickElement(sourceMatch.candidate);
    await delay(400);

    const refreshMatch = await waitForCandidate(refreshNeedle, 5000, "refresh_not_found", "locate_refresh");
    if (!refreshMatch.ok) return refreshMatch;
    clickElement(refreshMatch.candidate);

    return {
      ok: true,
      result: "success",
      stage: "done",
      message: "Refresh action clicked.",
      sourceMatch: {
        strategy: sourceMatch.candidate.strategy,
        text: sourceMatch.candidate.matchedText,
        tagName: sourceMatch.candidate.tagName
      },
      refreshMatch: {
        strategy: refreshMatch.candidate.strategy,
        text: refreshMatch.candidate.matchedText,
        tagName: refreshMatch.candidate.tagName
      }
    };
  })();
}
function extractNotebookListDom() {
  const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const normalize = (v) => String(v || "").replace(/\s+/g, " ").trim();
  const normalizeLower = (v) => normalize(v).toLowerCase();
  const loginHints = [
    "sign in", "choose an account", "request access", "you need access", "login", "account", "permission"
  ].map((v) => normalizeLower(v));

  function isVisible(el) {
    if (!(el instanceof Element)) return false;
    const rect = el.getBoundingClientRect();
    const style = getComputedStyle(el);
    return rect.width > 0 && rect.height > 0 && style.display !== "none" && style.visibility !== "hidden";
  }

  function parseNotebookUrl(rawHref) {
    try {
      const url = new URL(rawHref, location.origin);
      if (url.hostname !== "notebooklm.google.com") return "";
      const match = url.pathname.match(/^\/notebook\/([a-z0-9-]+)/i);
      if (!match) return "";
      return `${url.origin}/notebook/${match[1]}`;
    } catch (_) {
      return "";
    }
  }

  function cleanNotebookTitle(raw) {
    let text = normalize(raw);
    if (!text) return "";
    const iconTokens = ["more_vert", "description", "article", "library_books", "folder", "insert_drive_file"];
    for (const token of iconTokens) {
      const reg = new RegExp(`\\b${token}\\b`, "gi");
      text = text.replace(reg, " ");
    }
    text = text.replace(/\b\d+\s*涓潵婧怽b/gi, " ");
    text = text.replace(/\b\d+\s*sources?\b/gi, " ");
    text = text.replace(/\s+/g, " ").trim();
    return text;
  }

  function findTitle(anchor) {
    const aria = cleanNotebookTitle(anchor.getAttribute("aria-label"));
    if (aria) return aria;

    const text = cleanNotebookTitle(anchor.textContent);
    if (text && text.length <= 160) return text;

    let node = anchor.parentElement;
    for (let i = 0; i < 4 && node; i += 1) {
      const candidate = cleanNotebookTitle(node.textContent);
      if (candidate && candidate.length <= 200) return candidate;
      node = node.parentElement;
    }
    return "Untitled Notebook";
  }

  function collectNotebooks() {
    const map = new Map();
    const anchors = document.querySelectorAll("a[href*='/notebook/']");
    for (const anchor of anchors) {
      if (!isVisible(anchor)) continue;
      const notebookUrl = parseNotebookUrl(anchor.getAttribute("href") || "");
      if (!notebookUrl) continue;
      if (map.has(notebookUrl)) continue;
      map.set(notebookUrl, {
        url: notebookUrl,
        title: findTitle(anchor)
      });
    }
    return [...map.values()].sort((a, b) => a.title.localeCompare(b.title, "zh-Hans-CN"));
  }

  function detectAccessIssue() {
    if (location.hostname !== "notebooklm.google.com") {
      return { ok: false, result: "login_required", message: "Current page is not NotebookLM." };
    }
    const bodyText = normalizeLower(document.body?.innerText || "");
    if (loginHints.some((hint) => hint && bodyText.includes(hint))) {
      return { ok: false, result: "login_required", message: "Login or permission required." };
    }
    return null;
  }

  return (async () => {
    const issue = detectAccessIssue();
    if (issue) return issue;

    const deadline = Date.now() + 15000;
    while (Date.now() < deadline) {
      const notebooks = collectNotebooks();
      if (notebooks.length > 0) {
        return { ok: true, result: "success", notebooks };
      }
      await delay(400);
    }

    return { ok: false, result: "page_error", message: "Notebook list not found on page." };
  })();
}
async function runDomAutomation(tabId, payload) {
  const injected = await chrome.scripting.executeScript({
    target: { tabId, allFrames: false },
    func: notebookDomAutomation,
    args: [{ sourceLabel: payload.sourceLabel, refreshLabel: payload.refreshLabel }]
  });
  return injected?.[0]?.result || { ok: false, result: "page_error", stage: "inject", message: "Injected script returned no result." };
}

function shouldRunUrl(rule, runtime, targetUrl, mode) {
  if (mode === "manual") return true;
  if (!rule.enabled) return false;
  const lastRunAt = runtime.lastRunAtByUrl?.[targetUrl] || "";
  return minutesSince(lastRunAt) >= rule.intervalMinutes;
}

function sortedTargets(rule) {
  const seen = new Set();
  const output = [];
  for (const target of (rule.targets || [])) {
    const key = `${target?.notebookUrl || ""}|${target?.sourceLabel || ""}`.trim();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    output.push(target);
  }
  return output;
}

async function runForTarget(rule, runtime, target) {
  const normalizedUrl = normalizeNotebookUrl(target?.notebookUrl, "");
  const sourceLabel = String(target?.sourceLabel || "").trim();
  if (!normalizedUrl) {
    return { ok: false, result: "page_error", message: "Invalid notebook URL in rule.", targetUrl: "" };
  }

  const dedicatedTab = await getDedicatedNotebookTab(normalizedUrl, runtime);
  runtime.dedicatedTabs[normalizedUrl] = dedicatedTab.id;

  const loadedTab = await loadNotebookIntoDedicatedTab(dedicatedTab.id, normalizedUrl);
  const tabIssue = classifyTabUrl(loadedTab.url);
  if (tabIssue) return { ok: false, targetUrl: normalizedUrl, ...tabIssue };

  const automationResult = await runDomAutomation(dedicatedTab.id, {
    sourceLabel: sourceLabel || "work ai news",
    refreshLabel: rule.refreshLabel
  });

  if (!automationResult?.ok) {
    return {
      ok: false,
      targetUrl: normalizedUrl,
      result: automationResult?.result || "page_error",
      message: automationResult?.message || "NotebookLM page automation failed."
    };
  }

  return {
    ok: true,
    targetUrl: normalizedUrl,
    result: "success",
    message: automationResult.message || "Refresh action clicked."
  };
}

async function performRun(mode = "manual", targetUrlFilter = "") {
  const state = await readState();
  const rule = state.rule;
  let runtime = structuredClone(state.runtime);
  const normalizedFilterUrl = normalizeNotebookUrl(targetUrlFilter, "");

  if (mode !== "manual" && !rule.enabled) return buildStateSnapshot();
  if (mode === "scheduled" && minutesSince(runtime.lastRunAt) < 1) return buildStateSnapshot();

  const candidates = sortedTargets(rule).filter((target) => {
    if (normalizedFilterUrl && !compareNotebookUrls(target.notebookUrl, normalizedFilterUrl)) return false;
    return shouldRunUrl(rule, runtime, target.notebookUrl, mode);
  });
  if (!candidates.length) return buildStateSnapshot();

  runtime.lastRunAt = nowIso();
  runtime.lastResult = "running";
  runtime.lastErrorMessage = "";

  const failures = [];
  for (const target of candidates) {
    const targetUrl = target.notebookUrl;
    try {
      const result = await runForTarget(rule, runtime, target);
      runtime.lastRunAtByUrl[targetUrl] = nowIso();
      runtime = appendRunLog(runtime, {
        at: nowIso(),
        mode,
        result: result.result,
        message: `${targetUrl} | ${target.sourceLabel} | ${result.message}`
      });
      if (!result.ok) failures.push(result);
    } catch (error) {
      failures.push({
        ok: false,
        targetUrl,
        result: "page_error",
        message: error?.message || "NotebookLM refresh execution failed."
      });
      runtime.lastRunAtByUrl[targetUrl] = nowIso();
      runtime = appendRunLog(runtime, {
        at: nowIso(),
        mode,
        result: "page_error",
        message: `${targetUrl} | ${target.sourceLabel} | ${error?.message || "NotebookLM refresh execution failed."}`
      });
    }
  }

  if (!failures.length) {
    runtime.lastResult = "success";
    runtime.lastSuccessAt = nowIso();
    runtime.lastErrorMessage = "";
    runtime.lastNotifiedErrorKey = "";
  } else {
    const firstFailure = failures[0];
    runtime.lastResult = firstFailure.result;
    runtime.lastErrorMessage = `${firstFailure.targetUrl} | ${firstFailure.message}`;
    const errorKey = buildErrorKey(firstFailure.result, firstFailure.message, firstFailure.targetUrl);
    if (runtime.lastNotifiedErrorKey !== errorKey) {
      await notifyFailure(errorKey, firstFailure.result, runtime.lastErrorMessage);
      runtime.lastNotifiedErrorKey = errorKey;
    }
  }

  await writeState({ rule, runtime });
  return buildStateSnapshot();
}
function enqueueRun(mode = "manual", targetUrlFilter = "") {
  const task = executionChain.then(() => performRun(mode, targetUrlFilter));
  executionChain = task.then(() => undefined, () => undefined);
  return task;
}

async function runNotebookNow(url = "") {
  const normalizedUrl = normalizeNotebookUrl(url, "");
  if (!normalizedUrl) throw new Error("invalid_notebook_url");
  return enqueueRun("manual", normalizedUrl);
}

async function openManagerPage() {
  const managerUrl = chrome.runtime.getURL("manager.html");
  const tabs = await chrome.tabs.query({ url: [managerUrl] });
  if (tabs.length > 0) {
    const tab = tabs[0];
    await chrome.tabs.update(tab.id, { active: true });
    if (Number.isInteger(tab.windowId)) {
      await chrome.windows.update(tab.windowId, { focused: true }).catch(() => undefined);
    }
    return buildStateSnapshot();
  }
  const created = await chrome.tabs.create({ url: managerUrl, active: true });
  if (Number.isInteger(created.windowId)) {
    await chrome.windows.update(created.windowId, { focused: true }).catch(() => undefined);
  }
  return buildStateSnapshot();
}

async function saveRule(nextRule) {
  const normalizedRule = normalizeRule(nextRule || DEFAULT_RULE);
  await mutateState((state) => {
    state.rule = normalizedRule;
    const validUrls = new Set((normalizedRule.targets || []).map((target) => target.notebookUrl));
    state.runtime.dedicatedTabs = Object.fromEntries(
      Object.entries(state.runtime.dedicatedTabs || {}).filter(([url]) => validUrls.has(url))
    );
    state.runtime.lastRunAtByUrl = Object.fromEntries(
      Object.entries(state.runtime.lastRunAtByUrl || {}).filter(([url]) => validUrls.has(url))
    );
    return state;
  });
  await syncAlarm(normalizedRule);
  return buildStateSnapshot();
}

async function toggleEnabled() {
  const nextState = await mutateState((state) => {
    state.rule.enabled = !state.rule.enabled;
    return state;
  });
  await syncAlarm(nextState.rule);
  return buildStateSnapshot();
}

async function openNotebookForUser(url = "") {
  const state = await readState();
  const preferred = normalizeNotebookUrl(url, "");
  const fallbackUrl = state.rule.targets?.[0]?.notebookUrl || DEFAULT_RULE.targets[0].notebookUrl;
  const targetUrl = preferred || fallbackUrl;
  const runtime = structuredClone(state.runtime);
  const tab = await getDedicatedNotebookTab(targetUrl, runtime);

  const preparedTab = compareNotebookUrls(tab.url, targetUrl)
    ? tab
    : await chrome.tabs.update(tab.id, { url: targetUrl, active: true });

  await chrome.tabs.update(preparedTab.id, { active: true });
  if (Number.isInteger(preparedTab.windowId)) {
    await chrome.windows.update(preparedTab.windowId, { focused: true }).catch(() => undefined);
  }

  await writeState({ rule: state.rule, runtime });
  return buildStateSnapshot();
}

async function getNotebookIndexTab(runtime) {
  const knownId = runtime.notebookIndexTabId;
  if (Number.isInteger(knownId) && knownId > 0) {
    const knownTab = await chrome.tabs.get(knownId).catch(() => null);
    if (knownTab && String(knownTab.url || "").startsWith("https://notebooklm.google.com/")) {
      return knownTab;
    }
  }

  const tabs = await chrome.tabs.query({ url: [NOTEBOOK_URL_PATTERN] });
  if (tabs.length > 0) return tabs[0];
  return chrome.tabs.create({ url: NOTEBOOK_HOME_URL, active: false });
}

async function fetchNotebookList({ force = false } = {}) {
  const now = Date.now();
  if (!force && Array.isArray(notebookListCache.notebooks) && (now - notebookListCache.at) <= NOTEBOOK_LIST_CACHE_TTL_MS) {
    return {
      snapshot: await buildStateSnapshot(),
      notebooks: notebookListCache.notebooks
    };
  }

  const state = await readState();
  const runtime = structuredClone(state.runtime);
  const authUsers = [0, 1, 2, 3, 4];
  const rpcErrors = [];

  for (const authuser of authUsers) {
    try {
      const client = await createNotebookRpcClient(authuser);
      const rpcNotebooks = await client.listNotebooks();
      if (rpcNotebooks.length) {
        notebookListCache = {
          at: Date.now(),
          notebooks: rpcNotebooks
        };
        await writeState({ rule: state.rule, runtime });
        return {
          snapshot: await buildStateSnapshot(),
          notebooks: rpcNotebooks
        };
      }
      rpcErrors.push(`authuser_${authuser}_empty`);
    } catch (error) {
      rpcErrors.push(error?.message || "rpc_list_failed");
    }
  }

  await writeState({ rule: state.rule, runtime });
  const hint = rpcErrors.length ? ` rpc=${rpcErrors.join("|")}` : "";
  throw new Error(`fetch_notebooks_failed${hint}`);
}

async function resolveNotebookByInput({ notebookUrl = "", notebookId = "", force = false } = {}) {
  const idFromUrl = extractNotebookIdFromUrl(notebookUrl);
  const targetId = String(notebookId || idFromUrl || "").trim();
  if (!targetId) throw new Error("invalid_notebook_id");
  const listPayload = await fetchNotebookList({ force });
  const notebook = (listPayload.notebooks || []).find((item) => String(item.id || "") === targetId) || null;
  return {
    notebookId: targetId,
    notebookUrl: notebook?.url || normalizeNotebookUrl(notebookUrl, ""),
    notebook
  };
}

async function fetchNotebookSources({ notebookUrl = "", notebookId = "", force = false } = {}) {
  const resolved = await resolveNotebookByInput({ notebookUrl, notebookId, force });
  const key = resolved.notebookId;
  const now = Date.now();
  const cached = notebookSourcesCache.get(key);
  if (!force && cached && (now - cached.at) <= NOTEBOOK_SOURCES_CACHE_TTL_MS) {
    return {
      snapshot: await buildStateSnapshot(),
      notebookId: key,
      notebookUrl: resolved.notebookUrl,
      notebookTitle: resolved.notebook?.title || "",
      sources: cached.sources
    };
  }

  const authUsers = [0, 1, 2, 3, 4];
  const rpcErrors = [];
  for (const authuser of authUsers) {
    try {
      const client = await createNotebookRpcClient(authuser);
      const sources = await client.getNotebookSources(key);
      notebookSourcesCache.set(key, { at: Date.now(), sources });
      return {
        snapshot: await buildStateSnapshot(),
        notebookId: key,
        notebookUrl: resolved.notebookUrl,
        notebookTitle: resolved.notebook?.title || "",
        sources
      };
    } catch (error) {
      rpcErrors.push(`authuser_${authuser}:${error?.message || "fetch_sources_failed"}`);
    }
  }

  throw new Error(`fetch_notebook_sources_failed ${rpcErrors.join("|").slice(0, 700)}`);
}

async function fetchAllSources({ force = false } = {}) {
  const listPayload = await fetchNotebookList({ force });
  const notebooks = Array.isArray(listPayload.notebooks) ? listPayload.notebooks : [];
  const rows = [];
  const concurrency = Math.max(2, Math.min(6, Math.floor((notebooks.length || 1) / 3) || 3));
  for (let i = 0; i < notebooks.length; i += concurrency) {
    const chunk = notebooks.slice(i, i + concurrency);
    const chunkRows = await Promise.all(chunk.map(async (notebook) => {
      try {
        const payload = await withTimeout(fetchNotebookSources({
          notebookId: notebook.id,
          notebookUrl: notebook.url,
          force
        }), 45000, "fetch_notebook_sources_timeout");
        return (payload.sources || []).map((source) => ({
          notebookId: notebook.id,
          notebookTitle: notebook.title,
          notebookEmoji: notebook.emoji || "",
          notebookUrl: notebook.url,
          sourceId: source.id,
          sourceName: source.name,
          sourceUrl: source.sourceUrl || "",
          gDocId: source.gDocId || "",
          statusCode: source.statusCode || 0,
          wordCount: source.wordCount || 0,
          isGDoc: Boolean(source.isGDoc),
          isBadSource: Boolean(source.isBadSource),
          updatedAt: source.updatedAt || notebook.lastEditedAt || ""
        }));
      } catch (error) {
        return [{
          notebookId: notebook.id,
          notebookTitle: notebook.title,
          notebookEmoji: notebook.emoji || "",
          notebookUrl: notebook.url,
          sourceId: "",
          sourceName: `[Error] ${notebook.title}`,
          sourceUrl: "",
          gDocId: "",
          statusCode: -1,
          wordCount: 0,
          isGDoc: false,
          isBadSource: true,
          updatedAt: "",
          error: error?.message || "fetch_sources_failed"
        }];
      }
    }));
    chunkRows.forEach((group) => rows.push(...group));
  }
  return {
    snapshot: await buildStateSnapshot(),
    sources: rows
  };
}

async function fetchGeneratedDocuments({ force = false } = {}) {
  const listPayload = await fetchNotebookList({ force });
  const notebooks = Array.isArray(listPayload.notebooks) ? listPayload.notebooks : [];
  const docs = [];
  for (const notebook of notebooks) {
    const notebookId = String(notebook.id || "").trim();
    if (!notebookId) continue;
    const authUsers = [0, 1, 2, 3, 4];
    let found = false;
    for (const authuser of authUsers) {
      try {
        const client = await createNotebookRpcClient(authuser);
        const list = await client.getGeneratedContent(notebookId);
        list.forEach((item) => {
          docs.push({
            notebookId,
            notebookUrl: notebook.url,
            notebookTitle: notebook.title,
            id: item.id,
            title: item.title,
            type: item.type || "Note",
            content: item.content || "",
            updatedAt: item.updatedAt || notebook.lastEditedAt || "",
            sourceIds: Array.isArray(item.sourceIds) ? item.sourceIds : []
          });
        });
        found = true;
        break;
      } catch (_) {
        // try next authuser
      }
    }
    if (!found) {
      // skip silently
    }
  }

  return {
    snapshot: await buildStateSnapshot(),
    documents: docs
  };
}

function sanitizeFileName(name) {
  return String(name || "export")
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, "_")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120) || "export";
}

function escapePdfText(text) {
  return String(text || "")
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)")
    .replace(/[^\x20-\x7E]/g, "?");
}

function buildSimplePdfBuffer(text) {
  const lines = String(text || "")
    .split(/\r?\n/)
    .slice(0, 70)
    .map((line) => escapePdfText(line));
  const contentOps = ["BT", "/F1 10 Tf", "50 770 Td"];
  lines.forEach((line, index) => {
    if (index > 0) contentOps.push("0 -12 Td");
    contentOps.push(`(${line}) Tj`);
  });
  contentOps.push("ET");
  const stream = contentOps.join("\n");

  const objects = [
    "1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n",
    "2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n",
    "3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>\nendobj\n",
    `4 0 obj\n<< /Length ${stream.length} >>\nstream\n${stream}\nendstream\nendobj\n`,
    "5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n"
  ];

  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((obj) => {
    offsets.push(pdf.length);
    pdf += obj;
  });
  const xrefStart = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += "0000000000 65535 f \n";
  for (let i = 1; i < offsets.length; i += 1) {
    pdf += `${String(offsets[i]).padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;
  return new TextEncoder().encode(pdf);
}

function buildSourceExportContent({ notebookTitle, notebookUrl, sources, sourceContentMap, format }) {
  const lines = [];
  lines.push(`# Notebook: ${notebookTitle || "Untitled"}`);
  lines.push(`URL: ${notebookUrl || ""}`);
  lines.push(`Exported At: ${new Date().toISOString()}`);
  lines.push("");
  (sources || []).forEach((source, idx) => {
    lines.push(`## ${idx + 1}. ${source.sourceName || source.name || "Untitled Source"}`);
    lines.push(`Source ID: ${source.sourceId || source.id || ""}`);
    lines.push(`Source URL: ${source.sourceUrl || ""}`);
    lines.push(`Updated At: ${source.updatedAt || ""}`);
    const blocks = sourceContentMap[source.sourceId || source.id || ""] || [];
    if (Array.isArray(blocks) && blocks.length) {
      lines.push("");
      blocks.forEach((block) => lines.push(block));
    }
    lines.push("");
  });

  const mergedText = lines.join("\n");
  if (format === "txt") {
    return {
      fileExt: "txt",
      mimeType: "text/plain;charset=utf-8",
      data: mergedText
    };
  }
  if (format === "pdf") {
    return {
      fileExt: "pdf",
      mimeType: "application/pdf",
      data: buildSimplePdfBuffer(mergedText)
    };
  }
  return {
    fileExt: "md",
    mimeType: "text/markdown;charset=utf-8",
    data: mergedText
  };
}

async function downloadSelectedSources({
  notebookUrl = "",
  notebookId = "",
  sourceIds = [],
  format = "md"
} = {}) {
  const payload = await fetchNotebookSources({ notebookUrl, notebookId, force: false });
  const all = Array.isArray(payload.sources) ? payload.sources : [];
  const selectedIds = new Set((Array.isArray(sourceIds) ? sourceIds : []).map((id) => String(id || "").trim()).filter(Boolean));
  const targets = selectedIds.size ? all.filter((item) => selectedIds.has(String(item.id || ""))) : all;
  if (!targets.length) throw new Error("no_sources_selected");

  const sourceContentMap = {};
  const notebookIdResolved = payload.notebookId || extractNotebookIdFromUrl(payload.notebookUrl || "");
  const authUsers = [0, 1, 2, 3, 4];

  for (const source of targets) {
    const sourceId = String(source.id || "").trim();
    if (!sourceId) continue;
    let blocks = [];
    for (const authuser of authUsers) {
      try {
        const client = await createNotebookRpcClient(authuser);
        blocks = await client.getSourceContent(sourceId, notebookIdResolved);
        if (Array.isArray(blocks) && blocks.length) break;
      } catch (_) {
        // try next
      }
    }
    sourceContentMap[sourceId] = Array.isArray(blocks) ? blocks.slice(0, 1200) : [];
  }

  const exportData = buildSourceExportContent({
    notebookTitle: payload.notebookTitle,
    notebookUrl: payload.notebookUrl,
    sources: targets.map((source) => ({
      sourceId: source.id,
      sourceName: source.name,
      sourceUrl: source.sourceUrl || "",
      updatedAt: source.updatedAt || ""
    })),
    sourceContentMap,
    format: String(format || "md").toLowerCase()
  });

  const blob = new Blob([exportData.data], { type: exportData.mimeType });
  const blobUrl = URL.createObjectURL(blob);
  const filenameBase = sanitizeFileName(payload.notebookTitle || "NotebookLM-Sources");
  await chrome.downloads.download({
    url: blobUrl,
    filename: `${filenameBase}-sources.${exportData.fileExt}`,
    saveAs: true
  });
  setTimeout(() => URL.revokeObjectURL(blobUrl), 60000);
  return {
    snapshot: await buildStateSnapshot(),
    downloaded: targets.length,
    format: exportData.fileExt
  };
}

async function mergeNotebooks({
  notebookUrls = [],
  newTitle = "",
  deleteOriginal = false
} = {}) {
  const targetUrls = normalizeNotebookUrlList(notebookUrls || []);
  if (targetUrls.length < 2) throw new Error("merge_requires_two_notebooks");

  const listPayload = await fetchNotebookList({ force: true });
  const notebooks = Array.isArray(listPayload.notebooks) ? listPayload.notebooks : [];
  const selected = targetUrls
    .map((url) => notebooks.find((item) => compareNotebookUrls(item.url, url)))
    .filter(Boolean);
  if (selected.length < 2) throw new Error("merge_targets_not_found");

  const sourceUrlSet = new Set();
  for (const notebook of selected) {
    const sourcePayload = await fetchNotebookSources({ notebookId: notebook.id, notebookUrl: notebook.url, force: true });
    (sourcePayload.sources || []).forEach((source) => {
      const url = String(source.sourceUrl || "").trim();
      if (/^https?:\/\//i.test(url)) sourceUrlSet.add(url);
    });
  }
  const sourceUrls = [...sourceUrlSet];
  if (!sourceUrls.length) throw new Error("merge_no_importable_source_urls");

  const authUsers = [0, 1, 2, 3, 4];
  let createdNotebookId = "";
  let usedAuthUser = null;
  const notebookTitle = String(newTitle || "").trim() || `Merged Notebook ${new Date().toLocaleDateString()}`;
  for (const authuser of authUsers) {
    try {
      const client = await createNotebookRpcClient(authuser);
      createdNotebookId = await client.createNotebook(notebookTitle);
      if (createdNotebookId) {
        usedAuthUser = authuser;
        break;
      }
    } catch (_) {
      // try next
    }
  }
  if (!createdNotebookId) throw new Error("merge_create_notebook_failed");

  const importErrors = [];
  const chunkSize = 25;
  for (let i = 0; i < sourceUrls.length; i += chunkSize) {
    const chunk = sourceUrls.slice(i, i + chunkSize);
    try {
      const client = await createNotebookRpcClient(usedAuthUser == null ? 0 : usedAuthUser);
      await client.addSources(createdNotebookId, chunk);
    } catch (error) {
      importErrors.push(error?.message || "merge_add_sources_failed");
    }
  }

  if (deleteOriginal) {
    const sourceIds = selected.map((item) => item.id).filter(Boolean);
    try {
      const client = await createNotebookRpcClient(usedAuthUser == null ? 0 : usedAuthUser);
      await client.deleteNotebooks(sourceIds);
    } catch (error) {
      importErrors.push(`delete_original_failed:${error?.message || "unknown"}`);
    }
  }

  notebookListCache = { at: 0, notebooks: null };
  notebookSourcesCache = new Map();

  return {
    snapshot: await buildStateSnapshot(),
    result: {
      notebookId: createdNotebookId,
      notebookUrl: `https://notebooklm.google.com/notebook/${createdNotebookId}`,
      notebookTitle,
      importedSourceCount: sourceUrls.length,
      warnings: importErrors
    }
  };
}

function normalizeFolderEntry(raw = {}) {
  const id = String(raw?.id || "").trim() || makeEntityId("folder");
  const name = String(raw?.name || "").trim().slice(0, 60) || "Folder";
  return { id, name };
}

async function getFoldersByType(folderType = "sources") {
  const normalizedType = String(folderType || "sources").trim() || "sources";
  const data = await chrome.storage.local.get([FOLDERS_KEY, FOLDER_ASSIGNMENTS_KEY]);
  const folderMap = data?.[FOLDERS_KEY] || {};
  const assignmentMap = data?.[FOLDER_ASSIGNMENTS_KEY] || {};
  const folders = Array.isArray(folderMap?.[normalizedType])
    ? folderMap[normalizedType].map((item) => normalizeFolderEntry(item))
    : [];
  const assignmentsRaw = assignmentMap?.[normalizedType] || {};
  const assignments = {};
  Object.entries(assignmentsRaw || {}).forEach(([key, value]) => {
    const sourceKey = String(key || "").trim();
    const folderId = String(value || "").trim();
    if (!sourceKey) return;
    assignments[sourceKey] = folderId;
  });
  return { folders, assignments };
}

async function saveFoldersByType({ folderType = "sources", folders = [], assignments = {} } = {}) {
  const normalizedType = String(folderType || "sources").trim() || "sources";
  const data = await chrome.storage.local.get([FOLDERS_KEY, FOLDER_ASSIGNMENTS_KEY]);
  const folderMap = data?.[FOLDERS_KEY] || {};
  const assignmentMap = data?.[FOLDER_ASSIGNMENTS_KEY] || {};
  const normalizedFolders = Array.isArray(folders)
    ? folders.map((item) => normalizeFolderEntry(item)).slice(0, 200)
    : [];
  const validFolderIds = new Set(normalizedFolders.map((item) => item.id));
  const normalizedAssignments = {};
  Object.entries(assignments || {}).forEach(([rawKey, rawFolderId]) => {
    const key = String(rawKey || "").trim();
    const folderId = String(rawFolderId || "").trim();
    if (!key) return;
    if (folderId && !validFolderIds.has(folderId)) return;
    normalizedAssignments[key] = folderId;
  });
  folderMap[normalizedType] = normalizedFolders;
  assignmentMap[normalizedType] = normalizedAssignments;
  await chrome.storage.local.set({
    [FOLDERS_KEY]: folderMap,
    [FOLDER_ASSIGNMENTS_KEY]: assignmentMap
  });
  return {
    folders: normalizedFolders,
    assignments: normalizedAssignments
  };
}

function normalizeAllSourceInput(raw = {}) {
  return {
    notebookId: String(raw?.notebookId || "").trim(),
    notebookUrl: normalizeNotebookUrl(raw?.notebookUrl || "", ""),
    sourceId: String(raw?.sourceId || "").trim(),
    sourceName: String(raw?.name || raw?.sourceName || "").trim(),
    sourceUrl: String(raw?.sourceUrl || "").trim(),
    gDocId: String(raw?.gDocId || "").trim(),
    isGDoc: Boolean(raw?.isGDoc)
  };
}

async function deleteSourcesByIds({ notebookId = "", notebookUrl = "", sourceIds = [] } = {}) {
  const resolved = await resolveNotebookByInput({
    notebookId,
    notebookUrl,
    force: false
  });
  const targetNotebookId = String(resolved.notebookId || "").trim();
  const ids = Array.isArray(sourceIds)
    ? [...new Set(sourceIds.map((id) => String(id || "").trim()).filter(Boolean))]
    : [];
  if (!targetNotebookId) throw new Error("invalid_notebook_id");
  if (!ids.length) throw new Error("invalid_source_ids");

  await runWithAuthUsers(async (client) => {
    await client.deleteSources(targetNotebookId, ids);
    return true;
  });

  notebookSourcesCache.delete(targetNotebookId);
  notebookListCache = { at: 0, notebooks: null };
  return {
    snapshot: await buildStateSnapshot(),
    deletedCount: ids.length
  };
}

async function syncAllGdocs({ notebookId = "", notebookUrl = "", sourceIds = [], skipTierCheck = false } = {}) {
  const _skip = Boolean(skipTierCheck);
  void _skip;
  const selectedIds = new Set(
    (Array.isArray(sourceIds) ? sourceIds : [])
      .map((item) => String(item || "").trim())
      .filter(Boolean)
  );

  const notebooks = [];
  if (notebookId || notebookUrl) {
    const resolved = await resolveNotebookByInput({
      notebookId,
      notebookUrl,
      force: false
    });
    notebooks.push({
      id: resolved.notebookId,
      url: resolved.notebookUrl
    });
  } else {
    const listPayload = await fetchNotebookList({ force: false });
    (listPayload.notebooks || []).forEach((item) => {
      notebooks.push({ id: item.id, url: item.url });
    });
  }

  let syncedCount = 0;
  const failed = [];
  for (const notebook of notebooks) {
    const payload = await fetchNotebookSources({
      notebookId: notebook.id,
      notebookUrl: notebook.url,
      force: true
    });
    const gdocs = (payload.sources || []).filter((source) => {
      if (!source?.isGDoc) return false;
      if (!selectedIds.size) return true;
      return selectedIds.has(String(source.id || "").trim());
    });
    for (const source of gdocs) {
      try {
        await runWithAuthUsers(async (client) => {
          await client.syncGdocSource(payload.notebookId, source.id);
          return true;
        });
        syncedCount += 1;
      } catch (error) {
        failed.push({
          notebookId: payload.notebookId,
          sourceId: String(source.id || ""),
          sourceName: String(source.name || ""),
          error: error?.message || "sync_gdoc_failed"
        });
      }
    }
    notebookSourcesCache.delete(payload.notebookId);
  }

  notebookListCache = { at: 0, notebooks: null };
  return {
    snapshot: await buildStateSnapshot(),
    syncedCount,
    failed
  };
}

async function addSourcesToNotebook({
  targetNotebookId = "",
  targetNotebookUrl = "",
  sources = []
} = {}) {
  const resolved = await resolveNotebookByInput({
    notebookId: targetNotebookId,
    notebookUrl: targetNotebookUrl,
    force: false
  });
  const notebookIdResolved = String(resolved.notebookId || "").trim();
  if (!notebookIdResolved) throw new Error("invalid_notebook_id");

  const normalizedSources = Array.isArray(sources)
    ? sources.map((item) => normalizeAllSourceInput(item))
    : [];
  const urlSources = dedupeUrls(
    normalizedSources
      .map((item) => item.sourceUrl)
      .filter((url) => /^https?:\/\//i.test(String(url || "")))
  );
  const gdocSources = normalizedSources
    .filter((item) => item.isGDoc && item.gDocId)
    .map((item) => ({ gDocId: item.gDocId, sourceName: item.sourceName || "Google Doc" }));
  const gdocSeen = new Set();
  const gdocsDeduped = [];
  gdocSources.forEach((item) => {
    const key = String(item.gDocId || "");
    if (!key || gdocSeen.has(key)) return;
    gdocSeen.add(key);
    gdocsDeduped.push(item);
  });
  if (!urlSources.length && !gdocsDeduped.length) throw new Error("no_source_urls");

  const failed = [];
  let imported = 0;

  for (let i = 0; i < urlSources.length; i += 20) {
    const chunk = urlSources.slice(i, i + 20);
    try {
      await runWithAuthUsers(async (client) => {
        await client.addSources(notebookIdResolved, chunk);
        return true;
      });
      imported += chunk.length;
    } catch (error) {
      chunk.forEach((url) => failed.push(`${url}|${error?.message || "add_source_failed"}`));
    }
  }

  for (const source of gdocsDeduped) {
    try {
      await runWithAuthUsers(async (client) => {
        await client.addGdocSource(notebookIdResolved, source.gDocId, source.sourceName);
        return true;
      });
      imported += 1;
    } catch (error) {
      failed.push(`${source.gDocId}|${error?.message || "add_gdoc_failed"}`);
    }
  }

  notebookSourcesCache.delete(notebookIdResolved);
  notebookListCache = { at: 0, notebooks: null };
  return {
    snapshot: await buildStateSnapshot(),
    result: {
      imported,
      failed
    },
    notebookId: notebookIdResolved,
    notebookUrl: resolved.notebookUrl
  };
}

async function createNotebookFromSources({ title = "", sources = [] } = {}) {
  const notebookTitle = String(title || "").trim() || `Notebook ${new Date().toLocaleDateString()}`;
  const createdNotebookId = await runWithAuthUsers(async (client) => {
    const notebookId = await client.createNotebook(notebookTitle);
    if (!notebookId) throw new Error("create_notebook_failed");
    return notebookId;
  });
  const notebookUrl = `https://notebooklm.google.com/notebook/${createdNotebookId}`;
  const added = await addSourcesToNotebook({
    targetNotebookId: createdNotebookId,
    targetNotebookUrl: notebookUrl,
    sources
  });
  return {
    snapshot: await buildStateSnapshot(),
    success: true,
    notebookId: createdNotebookId,
    notebookUrl,
    notebookTitle,
    result: added.result || { imported: 0, failed: [] }
  };
}

async function createNotebookSimple({ title = "" } = {}) {
  const notebookTitle = String(title || "").trim() || `Notebook ${new Date().toLocaleDateString()}`;
  const createdNotebookId = await runWithAuthUsers(async (client) => {
    const notebookId = await client.createNotebook(notebookTitle);
    if (!notebookId) throw new Error("create_notebook_failed");
    return notebookId;
  });
  notebookListCache = { at: 0, notebooks: null };
  return {
    snapshot: await buildStateSnapshot(),
    success: true,
    notebookId: createdNotebookId,
    notebookUrl: `https://notebooklm.google.com/notebook/${createdNotebookId}`,
    notebookTitle
  };
}

async function getSourceContentForPreview({
  notebookId = "",
  notebookUrl = "",
  sourceId = "",
  format = "md"
} = {}) {
  const resolved = await resolveNotebookByInput({
    notebookId,
    notebookUrl,
    force: false
  });
  const notebookSources = await fetchNotebookSources({
    notebookId: resolved.notebookId,
    notebookUrl: resolved.notebookUrl,
    force: false
  });
  const source = (notebookSources.sources || []).find((item) => String(item?.id || "") === String(sourceId || ""));
  if (!source) throw new Error("source_not_found");

  const blocks = await runWithAuthUsers(async (client) => {
    const rows = await client.getSourceContent(source.id, notebookSources.notebookId);
    return Array.isArray(rows) ? rows : [];
  });
  const textBlocks = blocks.slice(0, 1200).map((item) => String(item || "").trim()).filter(Boolean);
  const joined = textBlocks.join("\n\n");
  const normalizedFormat = String(format || "md").toLowerCase();

  if (normalizedFormat === "json") {
    return {
      success: true,
      notebookId: notebookSources.notebookId,
      sourceId: source.id,
      format: "json",
      content: JSON.stringify(textBlocks, null, 2),
      formatted: JSON.stringify({
        notebookTitle: notebookSources.notebookTitle || "",
        sourceName: source.name || "",
        sourceUrl: source.sourceUrl || "",
        blocks: textBlocks
      }, null, 2)
    };
  }

  if (normalizedFormat === "txt") {
    return {
      success: true,
      notebookId: notebookSources.notebookId,
      sourceId: source.id,
      format: "txt",
      content: joined,
      formatted: joined
    };
  }

  const markdown = [
    `# ${source.name || "Source Preview"}`,
    source.sourceUrl ? `Source URL: ${source.sourceUrl}` : "",
    source.updatedAt ? `Updated At: ${source.updatedAt}` : "",
    "",
    joined
  ].filter(Boolean).join("\n\n");

  return {
    success: true,
    notebookId: notebookSources.notebookId,
    sourceId: source.id,
    format: "md",
    content: markdown,
    formatted: markdown
  };
}

function extractNotebookIdFromUrl(notebookUrl) {
  try {
    const parsed = new URL(notebookUrl);
    const match = parsed.pathname.match(/^\/notebook\/([a-z0-9-]+)/i);
    return match?.[1] || "";
  } catch (_) {
    return "";
  }
}

function extractRpcToken(name, html) {
  const match = new RegExp(`"${name}":"([^"]+)"`).exec(String(html || ""));
  return match?.[1] || "";
}

function parseBatchExecuteResponse(text) {
  const raw = String(text || "");

  const parseRows = (rows) => {
    if (!Array.isArray(rows)) return [];
    const results = [];
    for (const row of rows) {
      if (!Array.isArray(row) || row[0] !== "wrb.fr") continue;
      const rpcId = row[1];
      const payloadRaw = row[2];
      let payload = null;
      try {
        payload = JSON.parse(payloadRaw);
      } catch (_) {
        payload = null;
      }
      const index = row[6] === "generic"
        ? 1
        : Number.parseInt(String(row[6] || "1"), 10) || 1;
      results.push({ index, rpcId, data: payload });
    }
    return results.sort((a, b) => a.index - b.index);
  };

  try {
    const payloadText = raw.split("\n").slice(2).join("");
    const parsed = JSON.parse(payloadText);
    const direct = parseRows(parsed);
    if (direct.length > 0) return direct;
  } catch (_) {
    // continue to fallback parser
  }

  // Fallback: older batchexecute style where each JSON row is on its own line.
  const lineRows = [];
  const lines = raw.split("\n").map((line) => line.trim()).filter(Boolean);
  for (const line of lines) {
    if (!line.startsWith("[[")) continue;
    try {
      const parsed = JSON.parse(line);
      if (Array.isArray(parsed)) {
        lineRows.push(...parsed);
      }
    } catch (_) {
      // ignore malformed line
    }
  }
  return parseRows(lineRows);
}

function parseBatchedLinePayload(rawText) {
  const line = String(rawText || "").split("\n").find((item) => String(item || "").trim().startsWith("[["));
  if (!line) return null;
  try {
    return JSON.parse(line);
  } catch (_) {
    return null;
  }
}

function normalizeTimestampToIso(raw) {
  const num = Number(raw || 0);
  if (!Number.isFinite(num) || num <= 0) return "";
  const ms = num < 1e12 ? num * 1000 : num;
  const date = new Date(ms);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString();
}

function findFirstHttpValue(node, guard = null, depth = 0) {
  if (depth > 8) return "";
  if (typeof node === "string") {
    const value = String(node).trim();
    if (/^https?:\/\//i.test(value) && (!guard || guard(value))) return value;
    if (/^\/\//.test(value) && (!guard || guard(`https:${value}`))) return `https:${value}`;
    return "";
  }
  if (!Array.isArray(node)) return "";
  for (const child of node) {
    const found = findFirstHttpValue(child, guard, depth + 1);
    if (found) return found;
  }
  return "";
}

function collectUuidLikeValues(node, depth = 0, out = []) {
  if (depth > 8) return out;
  if (typeof node === "string") {
    const value = String(node).trim();
    if (value.includes("-") && value.length >= 16) out.push(value);
    return out;
  }
  if (!Array.isArray(node)) return out;
  node.forEach((item) => collectUuidLikeValues(item, depth + 1, out));
  return out;
}

function flattenTextBlocks(node, depth = 0, out = []) {
  if (depth > 10) return out;
  if (typeof node === "string") {
    const value = String(node || "").trim();
    if (value.length > 10) out.push(value);
    return out;
  }
  if (!Array.isArray(node)) return out;
  node.forEach((item) => flattenTextBlocks(item, depth + 1, out));
  return out;
}

function inferGeneratedType(title, content = "", typeCode = null, subType = null) {
  const lowerTitle = String(title || "").toLowerCase();
  const lowerContent = String(content || "").toLowerCase().slice(0, 500);
  if (typeCode === 3) return "Video Overview";
  if (typeCode === 5) return "Mind Map";
  if (typeCode === 7) return "Infographic";
  if (typeCode === 8) return "Slides";
  if (typeCode === 9) return "Data Table";
  if (typeCode === 4) return subType === 2 ? "Quiz" : "Flashcard";
  if (lowerTitle.includes("audio overview") || lowerTitle.includes("deep dive")) return "Audio Overview";
  if (lowerTitle.includes("quiz")) return "Quiz";
  if (lowerTitle.includes("faq")) return "FAQ";
  if (lowerTitle.includes("study guide")) return "Study Guide";
  if (lowerTitle.includes("briefing")) return "Briefing";
  if (lowerTitle.includes("timeline")) return "Timeline";
  if (lowerTitle.includes("table of contents")) return "Table of Contents";
  if (lowerContent.includes("## quiz") || lowerContent.includes("answer key")) return "Quiz";
  if (lowerContent.includes("comprehensive briefing") || lowerContent.includes("briefing doc")) return "Briefing";
  if (lowerContent.includes("study guide")) return "Study Guide";
  if (lowerContent.includes("## glossary") && lowerContent.includes("## faq")) return "FAQ";
  return "Note";
}

function parseNotebookSourcesFromStatusText(rawText) {
  const line = String(rawText || "").split("\n")[3];
  if (!line) return [];
  try {
    const parsed = JSON.parse(line);
    const payload = JSON.parse(parsed?.[0]?.[2] || "null");
    const list = Array.isArray(payload?.[0]?.[1]) ? payload[0][1] : [];
    return list
      .map((item) => {
        const id = String(item?.[0]?.[0] || "").trim();
        const name = String(item?.[1] || "").trim();
        const gDocId = item?.[2]?.[0]?.[0] || "";
        const statusTuple = item?.[3];
        const statusCode = Array.isArray(statusTuple) ? Number(statusTuple?.[1] || 0) : 0;
        const wordCount = Array.isArray(item?.[2]) ? Number(item?.[2]?.[1] || 0) : 0;
        const sourceUrl = findFirstHttpValue(item);
        const updatedAt = normalizeTimestampToIso(item?.[4]?.[1] || item?.[5]?.[1] || item?.[6]?.[1] || 0);
        if (!id || !name) return null;
        return {
          id,
          name,
          sourceUrl,
          gDocId: String(gDocId || ""),
          isGDoc: Boolean(gDocId),
          isBadSource: statusCode === 3 || !Number.isFinite(wordCount) || wordCount <= 0,
          wordCount: Number.isFinite(wordCount) ? wordCount : 0,
          statusCode: Number.isFinite(statusCode) ? statusCode : 0,
          updatedAt
        };
      })
      .filter(Boolean);
  } catch (_) {
    return [];
  }
}

function parseGeneratedContentListFromText(rawText, label) {
  const linePayload = parseBatchedLinePayload(rawText);
  if (!Array.isArray(linePayload) || !linePayload[0]) return [];
  if (linePayload?.[0]?.[0] === "e") return [];
  try {
    const raw = linePayload?.[0]?.[2];
    if (!raw) return [];
    const outer = JSON.parse(raw);
    const rows = Array.isArray(outer) && Array.isArray(outer[0]) ? outer[0] : outer;
    if (!Array.isArray(rows)) return [];

    const out = rows.map((row) => {
      if (!Array.isArray(row) || row.length < 2) return null;

      if (Array.isArray(row[1]) && row[1].length >= 5) {
        const item = row[1];
        const id = String(item?.[0] || "");
        const bodyText = String(item?.[1] || "");
        const title = String(item?.[4] || "");
        if (!id || !title) return null;
        const typeCode = Array.isArray(item?.[2]) ? Number(item?.[2]?.[3] || 0) : 0;
        const sourceIds = Array.from(new Set(collectUuidLikeValues(item?.[2] || []).map((value) => String(value))));
        let content = bodyText;
        if ([3, 5, 7, 8].includes(typeCode)) {
          const mediaUrl = findFirstHttpValue(item, (url) => /googleusercontent|\.png|\.jpg|\.jpeg|\.gif|\.webp|\.pdf|\/audio\/|\/video\/|\.mp4|\.mp3/i.test(url));
          if (mediaUrl) content = mediaUrl;
        }
        return {
          id,
          title,
          content: String(content || ""),
          type: inferGeneratedType(title, bodyText, typeCode, null),
          sourceIds,
          updatedAt: nowIso(),
          parser: label
        };
      }

      if (typeof row[0] === "string" && typeof row[1] === "string") {
        const id = String(row[0] || "");
        const title = String(row[1] || "");
        if (!id || !title) return null;
        const typeCode = Number(row?.[2] || 0);
        const sourceIds = Array.from(new Set(collectUuidLikeValues(row?.[3] || []).map((value) => String(value))));
        const mediaUrl = findFirstHttpValue(row, (url) => /googleusercontent|\/audio\/|\/video\/|\.png|\.jpg|\.jpeg|\.gif|\.webp|\.pdf|\.mp4|\.mp3/i.test(url));
        return {
          id,
          title,
          content: String(mediaUrl || ""),
          type: inferGeneratedType(title, mediaUrl || "", typeCode, null),
          sourceIds,
          updatedAt: nowIso(),
          parser: label
        };
      }

      return null;
    }).filter(Boolean);

    return out;
  } catch (error) {
    console.warn(`${LOG_PREFIX} parseGeneratedContentListFromText failed`, error);
    return [];
  }
}

async function createNotebookRpcClient(authuser = 0) {
  const url = new URL("https://notebooklm.google.com/");
  if (authuser) url.searchParams.set("authuser", String(authuser));
  const html = await fetch(url.toString(), {
    method: "GET",
    credentials: "include",
    redirect: "error"
  }).then((r) => r.text());

  const at = extractRpcToken("SNlM0e", html);
  const bl = extractRpcToken("cfb2h", html);
  if (!at || !bl) throw new Error("notebooklm_signin_required");

  const executeText = async (rpcid, args = [], { sourcePath = "/", accountIndex = null } = {}) => {
    const reqid = String(Math.floor(Math.random() * 900000) + 100000);
    const endpoint = new URL("https://notebooklm.google.com/_/LabsTailwindUi/data/batchexecute");
    endpoint.searchParams.set("rpcids", rpcid);
    endpoint.searchParams.set("source-path", sourcePath);
    endpoint.searchParams.set("_reqid", reqid);
    endpoint.searchParams.set("bl", bl);
    endpoint.searchParams.set("rt", "c");
    const effectiveAccount = accountIndex == null ? authuser : accountIndex;
    if (effectiveAccount || effectiveAccount === 0) endpoint.searchParams.set("authuser", String(effectiveAccount));

    const fReq = JSON.stringify([[[rpcid, JSON.stringify(args || []), null, "generic"]]]);

    const body = new URLSearchParams();
    body.set("f.req", fReq);
    body.set("at", at);

    const raw = await fetch(endpoint.toString(), {
      method: "POST",
      credentials: "include",
      headers: {
        "content-type": "application/x-www-form-urlencoded;charset=UTF-8"
      },
      body
    }).then((r) => r.text());
    return raw;
  };

  const execute = async (rpcs = []) => {
    if (!Array.isArray(rpcs) || !rpcs.length) return [];
    if (rpcs.length === 1) {
      const text = await executeText(rpcs[0].id, rpcs[0].args || [], { sourcePath: rpcs[0].sourcePath || "/" });
      const parsed = parseBatchExecuteResponse(text);
      if (!parsed.length) {
        const snippet = text.slice(0, 180).replace(/\s+/g, " ");
        throw new Error(`rpc_parse_empty_${authuser}:${snippet}`);
      }
      return parsed;
    }

    const all = [];
    for (const rpc of rpcs) {
      const text = await executeText(rpc.id, rpc.args || [], { sourcePath: rpc.sourcePath || "/" });
      const parsed = parseBatchExecuteResponse(text);
      if (!parsed.length) {
        const snippet = text.slice(0, 180).replace(/\s+/g, " ");
        throw new Error(`rpc_parse_empty_${authuser}:${snippet}`);
      }
      all.push(...parsed);
    }
    return all;
  };

  return {
    authuser,
    execute,
    executeText,
    async listNotebooks() {
      const text = await executeText(NOTEBOOK_RPC_IDS.LIST_NOTEBOOKS, [null, 1, null, [2]], { sourcePath: "/" });
      const line = String(text || "").split("\n")[3];
      if (!line) return [];
      const payload = JSON.parse(JSON.parse(line)?.[0]?.[2] || "null");
      const rows = Array.isArray(payload?.[0]) ? payload[0] : [];
      return rows
        .filter((row) => row?.[5]?.[0] !== 3)
        .map((row) => {
          const notebookId = String(row?.[2] || "").trim();
          const title = String(row?.[0] || "").trim() || "Untitled";
          const emoji = String(row?.[3] || "").trim();
          const sources = Array.isArray(row?.[1]) ? row[1] : [];
          const sourceCount = sources.length;
          const lastEditedAt = normalizeTimestampToIso(row?.[5]?.[1] || 0);
          return {
            id: notebookId,
            title,
            emoji,
            sourceCount,
            lastEditedAt,
            sources,
            url: notebookId ? `https://notebooklm.google.com/notebook/${notebookId}` : ""
          };
        })
        .filter((item) => item.id);
    },
    async getNotebookSources(notebookId) {
      const targetId = String(notebookId || "").trim();
      if (!targetId) throw new Error("invalid_notebook_id");
      const text = await executeText(NOTEBOOK_RPC_IDS.CHECK_SOURCE_STATUS, [targetId, null, [2]], { sourcePath: "/" });
      return parseNotebookSourcesFromStatusText(text);
    },
    async getSourceContent(sourceId, notebookId = "") {
      const targetSourceId = String(sourceId || "").trim();
      const targetNotebookId = String(notebookId || "").trim();
      if (!targetSourceId) throw new Error("invalid_source_id");
      const text = await executeText(
        NOTEBOOK_RPC_IDS.GET_SOURCE_CONTENT,
        [[targetSourceId], [2], [2]],
        { sourcePath: targetNotebookId ? `/notebook/${targetNotebookId}` : "/" }
      );
      const line = String(text || "").split("\n")[3];
      if (!line) return [];
      const payload = JSON.parse(JSON.parse(line)?.[0]?.[2] || "null");
      return flattenTextBlocks(payload);
    },
    async getGeneratedContent(notebookId) {
      const targetId = String(notebookId || "").trim();
      if (!targetId) throw new Error("invalid_notebook_id");
      const sourcePath = `/notebook/${targetId}`;
      const out = [];
      const text1 = await executeText(NOTEBOOK_RPC_IDS.GET_GENERATED_CONTENT, [targetId], { sourcePath });
      out.push(...parseGeneratedContentListFromText(text1, NOTEBOOK_RPC_IDS.GET_GENERATED_CONTENT));
      const text2 = await executeText(
        NOTEBOOK_RPC_IDS.GET_GENERATED_CONTENT_ALT,
        [[2], targetId, "NOT artifact.status = \"ARTIFACT_STATUS_SUGGESTED\""],
        { sourcePath }
      );
      out.push(...parseGeneratedContentListFromText(text2, NOTEBOOK_RPC_IDS.GET_GENERATED_CONTENT_ALT));
      const deduped = [];
      const seen = new Set();
      out.forEach((item) => {
        if (!item?.id || seen.has(item.id)) return;
        seen.add(item.id);
        deduped.push(item);
      });
      return deduped;
    },
    async createNotebook(title) {
      const notebookTitle = String(title || "").trim() || `Notebook ${new Date().toLocaleDateString()}`;
      const text = await executeText(NOTEBOOK_RPC_IDS.CREATE_NOTEBOOK, [notebookTitle], { sourcePath: "/" });
      const match = text.match(/\b[0-9a-fA-F]{8}-(?:\d|[a-fA-F]){4}-(?:\d|[a-fA-F]){4}-(?:\d|[a-fA-F]){4}-(?:\d|[a-fA-F]){12}\b/);
      return match ? String(match[0]) : "";
    },
    async deleteNotebooks(notebookIds) {
      const ids = Array.isArray(notebookIds) ? notebookIds.map((id) => String(id || "").trim()).filter(Boolean) : [];
      if (!ids.length) return false;
      await executeText(NOTEBOOK_RPC_IDS.DELETE_NOTEBOOK, [ids, [2]], { sourcePath: "/" });
      return true;
    },
    async addSources(notebookId, urls) {
      const args = dedupeUrls(urls).map((item) => (
        String(item).includes("youtube.com")
          ? [null, null, null, null, null, null, null, [item]]
          : [null, null, [item]]
      ));
      const output = await execute([{ id: "izAoDd", args: [args, notebookId, [2]] }]);
      const data = output[0]?.data || null;
      if (data == null) throw new Error(`rpc_add_sources_empty_${authuser}`);
      return data;
    },
    async addGdocSource(notebookId, gDocId, sourceName = "") {
      const targetNotebookId = String(notebookId || "").trim();
      const targetGdocId = String(gDocId || "").trim();
      const targetName = String(sourceName || "").trim() || "Google Doc";
      if (!targetNotebookId) throw new Error("invalid_notebook_id");
      if (!targetGdocId) throw new Error("invalid_gdoc_id");
      const args = [
        [[[targetGdocId, "application/vnd.google-apps.document", 1, targetName], null, null, null, null, null, null, null, null, null, 1]],
        targetNotebookId,
        [2],
        [1, null, null, null, null, null, null, null, null, null, [1]]
      ];
      const text = await executeText(
        NOTEBOOK_RPC_IDS.ADD_TEXT_SOURCE,
        args,
        { sourcePath: `/notebook/${targetNotebookId}` }
      );
      if (String(text || "").includes("reached its source limit")) {
        throw new Error("SOURCE_LIMIT_REACHED");
      }
      return true;
    },
    async syncGdocSource(notebookId, sourceId) {
      const targetNotebookId = String(notebookId || "").trim();
      const targetSourceId = String(sourceId || "").trim();
      if (!targetNotebookId) throw new Error("invalid_notebook_id");
      if (!targetSourceId) throw new Error("invalid_source_id");
      await executeText(
        NOTEBOOK_RPC_IDS.SYNC_GDOC_SOURCE,
        [null, [targetSourceId], [2]],
        { sourcePath: `/notebook/${targetNotebookId}` }
      );
      return true;
    },
    async deleteSources(notebookId, sourceIds = []) {
      const targetNotebookId = String(notebookId || "").trim();
      const ids = Array.isArray(sourceIds)
        ? sourceIds.map((id) => String(id || "").trim()).filter(Boolean)
        : [];
      if (!targetNotebookId) throw new Error("invalid_notebook_id");
      if (!ids.length) throw new Error("invalid_source_ids");
      await executeText(
        NOTEBOOK_RPC_IDS.DELETE_SOURCE,
        [ids.map((id) => [id]), [2]],
        { sourcePath: `/notebook/${targetNotebookId}` }
      );
      return true;
    },
    async getAudioOverviewUrls(notebookId) {
      const output = await execute([{ id: "gArtLc", args: [[2], notebookId] }]);
      const list = output[0]?.data?.[0] || [];
      const node = list.find((item) => item?.[2] === 1)?.[6];
      return {
        playUrl: node?.[2] || "",
        downloadUrl: node?.[3] || ""
      };
    },
    async getAccount() {
      const output = await execute([{ id: "ZwVcOc", args: [] }]);
      const language = output?.[0]?.data?.[0]?.[2]?.at(-1)?.[0] || "en";
      return { language };
    },
    async createAudioOverview(notebookId) {
      const account = await this.getAccount();
      await execute([{ id: "AHyHrd", args: [notebookId, 0, [null, null, null, [], account.language]] }]);
      return { started: true };
    }
  };
}

function dedupeUrls(values = []) {
  const out = [];
  const seen = new Set();
  for (const value of values) {
    const url = String(value || "").trim();
    if (!url || seen.has(url)) continue;
    seen.add(url);
    out.push(url);
  }
  return out;
}

function normalizeNotebookUrlList(values = []) {
  const out = [];
  const seen = new Set();
  for (const raw of values) {
    const url = normalizeNotebookUrl(raw, "");
    if (!url || seen.has(url)) continue;
    seen.add(url);
    out.push(url);
  }
  return out;
}

function makeEntityId(prefix) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function normalizeTagList(values = []) {
  const out = [];
  const seen = new Set();
  for (const raw of values) {
    const tag = String(raw || "").trim().slice(0, 32);
    if (!tag) continue;
    const key = tag.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(tag);
  }
  return out.slice(0, 30);
}

function normalizeNotebookTagMap(rawMap = {}) {
  const map = {};
  Object.entries(rawMap || {}).forEach(([rawUrl, rawTags]) => {
    const notebookUrl = normalizeNotebookUrl(rawUrl, "");
    if (!notebookUrl) return;
    const tags = normalizeTagList(Array.isArray(rawTags) ? rawTags : String(rawTags || "").split(/[,\n]/));
    if (!tags.length) return;
    map[notebookUrl] = tags;
  });
  return map;
}

async function getNotebookTagsMap() {
  const data = await chrome.storage.local.get(NOTEBOOK_TAGS_KEY);
  return normalizeNotebookTagMap(data[NOTEBOOK_TAGS_KEY] || {});
}

async function setNotebookTags({ notebookUrl, tags }) {
  const targetUrl = normalizeNotebookUrl(notebookUrl, "");
  if (!targetUrl) throw new Error("invalid_notebook_url");
  const map = await getNotebookTagsMap();
  const nextTags = normalizeTagList(Array.isArray(tags) ? tags : String(tags || "").split(/[,\n]/));
  if (nextTags.length) {
    map[targetUrl] = nextTags;
  } else {
    delete map[targetUrl];
  }
  await chrome.storage.local.set({ [NOTEBOOK_TAGS_KEY]: map });
  return map;
}

const AUDIO_TASK_STATUS = new Set(["idle", "generating", "ready", "error", "not_ready"]);

function normalizeAudioTask(raw = {}) {
  const status = AUDIO_TASK_STATUS.has(String(raw.status || "")) ? String(raw.status) : "idle";
  const urls = {
    playUrl: String(raw.urls?.playUrl || "").trim(),
    downloadUrl: String(raw.urls?.downloadUrl || "").trim()
  };
  return {
    status,
    startedAt: String(raw.startedAt || "").trim(),
    updatedAt: String(raw.updatedAt || "").trim() || nowIso(),
    finishedAt: String(raw.finishedAt || "").trim(),
    error: String(raw.error || "").trim().slice(0, 500),
    urls
  };
}

function normalizeAudioTaskMap(rawMap = {}) {
  const map = {};
  Object.entries(rawMap || {}).forEach(([rawUrl, rawTask]) => {
    const notebookUrl = normalizeNotebookUrl(rawUrl, "");
    if (!notebookUrl) return;
    map[notebookUrl] = normalizeAudioTask(rawTask);
  });
  return map;
}

async function getAudioTaskMap() {
  const data = await chrome.storage.local.get(AUDIO_TASKS_KEY);
  return normalizeAudioTaskMap(data[AUDIO_TASKS_KEY] || {});
}

async function upsertAudioTask(notebookUrl, patch = {}) {
  const targetUrl = normalizeNotebookUrl(notebookUrl, "");
  if (!targetUrl) throw new Error("invalid_notebook_url");
  const current = await getAudioTaskMap();
  const merged = normalizeAudioTask({
    ...(current[targetUrl] || {}),
    ...patch,
    updatedAt: nowIso()
  });
  current[targetUrl] = merged;
  await chrome.storage.local.set({ [AUDIO_TASKS_KEY]: current });
  return merged;
}

async function getFavorites() {
  const data = await chrome.storage.local.get(FAVORITES_KEY);
  return normalizeNotebookUrlList(Array.isArray(data[FAVORITES_KEY]) ? data[FAVORITES_KEY] : []);
}

async function setFavorites(nextFavorites) {
  const normalized = normalizeNotebookUrlList(nextFavorites);
  await chrome.storage.local.set({ [FAVORITES_KEY]: normalized });
  return normalized;
}

async function toggleFavorite(notebookUrl) {
  const targetUrl = normalizeNotebookUrl(notebookUrl, "");
  if (!targetUrl) throw new Error("invalid_notebook_url");
  const current = await getFavorites();
  const exists = current.includes(targetUrl);
  const next = exists
    ? current.filter((url) => url !== targetUrl)
    : [...current, targetUrl];
  return setFavorites(next);
}

async function setFavoritesByAction({ action = "add", urls = [] } = {}) {
  const current = await getFavorites();
  const selected = normalizeNotebookUrlList(urls);
  if (!selected.length) return current;

  if (action === "remove") {
    return setFavorites(current.filter((url) => !selected.includes(url)));
  }
  return setFavorites([...current, ...selected]);
}

function normalizeCollection(raw = {}) {
  const notebookUrls = normalizeNotebookUrlList(raw.notebookUrls || []);
  const name = String(raw.name || "").trim().slice(0, 80);
  return {
    id: String(raw.id || makeEntityId("col")).trim(),
    name: name || "Collection",
    notebookUrls,
    updatedAt: nowIso(),
    createdAt: String(raw.createdAt || nowIso())
  };
}

async function getCollections() {
  const data = await chrome.storage.local.get(COLLECTIONS_KEY);
  const list = Array.isArray(data[COLLECTIONS_KEY]) ? data[COLLECTIONS_KEY] : [];
  return list
    .map((item) => normalizeCollection(item))
    .filter((item) => item.notebookUrls.length > 0)
    .slice(0, 200);
}

async function saveCollection(payload = {}) {
  const normalized = normalizeCollection(payload);
  if (!normalized.notebookUrls.length) throw new Error("collection_notebook_urls_empty");

  const current = await getCollections();
  const foundIndex = current.findIndex((item) => item.id === normalized.id);
  const next = [...current];
  if (foundIndex >= 0) {
    next[foundIndex] = {
      ...next[foundIndex],
      ...normalized,
      createdAt: next[foundIndex].createdAt || normalized.createdAt
    };
  } else {
    next.unshift(normalized);
  }
  await chrome.storage.local.set({ [COLLECTIONS_KEY]: next.slice(0, 200) });
  return getCollections();
}

async function deleteCollection(id) {
  const key = String(id || "").trim();
  const current = await getCollections();
  const next = current.filter((item) => item.id !== key);
  await chrome.storage.local.set({ [COLLECTIONS_KEY]: next });
  return next;
}

function normalizeTemplate(raw = {}) {
  const labelsRaw = Array.isArray(raw.sourceLabels)
    ? raw.sourceLabels
    : String(raw.sourceLabels || "").split(/\r?\n/);
  const sourceLabels = [...new Set(
    labelsRaw
      .map((item) => String(item || "").trim())
      .filter(Boolean)
  )].slice(0, 50);

  return {
    id: String(raw.id || makeEntityId("tpl")).trim(),
    name: String(raw.name || "").trim().slice(0, 80) || "Template",
    sourceLabels,
    refreshLabel: String(raw.refreshLabel || "").trim().slice(0, 120),
    updatedAt: nowIso(),
    createdAt: String(raw.createdAt || nowIso())
  };
}

async function getTemplates() {
  const data = await chrome.storage.local.get(TEMPLATES_KEY);
  const list = Array.isArray(data[TEMPLATES_KEY]) ? data[TEMPLATES_KEY] : [];
  return list
    .map((item) => normalizeTemplate(item))
    .filter((item) => item.sourceLabels.length > 0)
    .slice(0, 200);
}

async function saveTemplate(payload = {}) {
  const normalized = normalizeTemplate(payload);
  if (!normalized.sourceLabels.length) throw new Error("template_source_labels_empty");

  const current = await getTemplates();
  const foundIndex = current.findIndex((item) => item.id === normalized.id);
  const next = [...current];
  if (foundIndex >= 0) {
    next[foundIndex] = {
      ...next[foundIndex],
      ...normalized,
      createdAt: next[foundIndex].createdAt || normalized.createdAt
    };
  } else {
    next.unshift(normalized);
  }
  await chrome.storage.local.set({ [TEMPLATES_KEY]: next.slice(0, 200) });
  return getTemplates();
}

async function deleteTemplate(id) {
  const key = String(id || "").trim();
  const current = await getTemplates();
  const next = current.filter((item) => item.id !== key);
  await chrome.storage.local.set({ [TEMPLATES_KEY]: next });
  return next;
}

async function applyTemplateToNotebooks({ templateId, notebookUrls }) {
  const id = String(templateId || "").trim();
  if (!id) throw new Error("template_id_required");
  const normalizedUrls = normalizeNotebookUrlList(notebookUrls || []);
  if (!normalizedUrls.length) throw new Error("template_notebook_urls_empty");

  const templates = await getTemplates();
  const template = templates.find((item) => item.id === id);
  if (!template) throw new Error("template_not_found");

  const state = await readState();
  const rule = normalizeRule(state.rule || DEFAULT_RULE);
  const existingKey = new Set((rule.targets || []).map((item) => `${item.notebookUrl}|${item.sourceLabel}`));
  let added = 0;
  for (const notebookUrl of normalizedUrls) {
    for (const sourceLabel of template.sourceLabels) {
      const key = `${notebookUrl}|${sourceLabel}`;
      if (existingKey.has(key)) continue;
      existingKey.add(key);
      rule.targets.push({ notebookUrl, sourceLabel });
      added += 1;
    }
  }
  if (template.refreshLabel) {
    rule.refreshLabel = template.refreshLabel;
  }
  await saveRule(rule);
  return {
    snapshot: await buildStateSnapshot(),
    added
  };
}

async function getManagerMeta() {
  const [favorites, collections, templates, notebookTags, audioTasks] = await Promise.all([
    getFavorites(),
    getCollections(),
    getTemplates(),
    getNotebookTagsMap(),
    getAudioTaskMap()
  ]);
  return {
    favorites,
    collections,
    templates,
    notebookTags,
    audioTasks
  };
}

async function getBrowserTabUrls() {
  const tabs = await chrome.tabs.query({});
  return dedupeUrls(
    tabs
      .map((tab) => String(tab.url || "").trim())
      .filter((url) => /^https?:\/\//i.test(url))
  );
}

async function getBookmarkUrls() {
  const tree = await chrome.bookmarks.getTree();
  const urls = [];
  const walk = (nodes = []) => {
    for (const node of nodes) {
      const rawUrl = String(node?.url || "").trim();
      if (/^https?:\/\//i.test(rawUrl)) urls.push(rawUrl);
      if (Array.isArray(node?.children) && node.children.length) walk(node.children);
    }
  };
  walk(tree || []);
  return dedupeUrls(urls);
}

function extractAnchorsDom() {
  const urls = new Set();
  document.querySelectorAll("a[href]").forEach((a) => {
    const href = a.getAttribute("href") || "";
    try {
      const url = new URL(href, location.href);
      if (!/^https?:$/i.test(url.protocol)) return;
      urls.add(url.toString());
    } catch (_) {
      // noop
    }
  });
  return [...urls];
}

async function extractLinksFromPage(pageUrl) {
  const url = String(pageUrl || "").trim();
  if (!/^https?:\/\//i.test(url)) throw new Error("invalid_page_url");
  const tab = await chrome.tabs.create({ url, active: false });
  try {
    await waitForTabComplete(tab.id, 30000);
    const injected = await chrome.scripting.executeScript({
      target: { tabId: tab.id, allFrames: false },
      func: extractAnchorsDom
    });
    return dedupeUrls(injected?.[0]?.result || []);
  } finally {
    await chrome.tabs.remove(tab.id).catch(() => undefined);
  }
}

async function parseYouTubePlaylist(playlistUrl) {
  const url = String(playlistUrl || "").trim();
  if (!/^https?:\/\//i.test(url)) throw new Error("invalid_youtube_playlist_url");
  const html = await fetch(url, { credentials: "omit" }).then((r) => r.text());
  const ids = new Set();
  const re = /watch\?v=([a-zA-Z0-9_-]{11})/g;
  let m;
  while ((m = re.exec(html)) !== null) {
    ids.add(m[1]);
  }
  return [...ids].map((id) => `https://www.youtube.com/watch?v=${id}`);
}

async function parseRssFeed(rssUrl) {
  const url = String(rssUrl || "").trim();
  if (!/^https?:\/\//i.test(url)) throw new Error("invalid_rss_url");
  const xml = await fetch(url, { credentials: "omit" }).then((r) => r.text());
  const links = [];
  const itemRe = /<item[\s\S]*?<\/item>/gi;
  const linkRe = /<link>([\s\S]*?)<\/link>/i;
  let item;
  while ((item = itemRe.exec(xml)) !== null) {
    const part = item[0];
    const linkMatch = part.match(linkRe);
    if (!linkMatch) continue;
    const link = String(linkMatch[1] || "").trim();
    if (/^https?:\/\//i.test(link)) links.push(link);
  }
  return dedupeUrls(links);
}

function importSourcesDom(payload) {
  const urls = Array.isArray(payload?.urls) ? payload.urls : [];

  const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const norm = (v) => String(v || "").replace(/\s+/g, " ").trim().toLowerCase();
  const isVisible = (el) => {
    if (!(el instanceof Element)) return false;
    const rect = el.getBoundingClientRect();
    const style = getComputedStyle(el);
    return rect.width > 0 && rect.height > 0 && style.display !== "none" && style.visibility !== "hidden";
  };

  function findByText(words, selector = "button,[role='button'],a,div,span") {
    const needles = words.map((w) => norm(w));
    const nodes = document.querySelectorAll(selector);
    for (const node of nodes) {
      if (!isVisible(node)) continue;
      const text = norm(node.textContent) + " " + norm(node.getAttribute?.("aria-label"));
      if (needles.some((n) => n && text.includes(n))) return node;
    }
    return null;
  }

  function findInput() {
    const nodes = [...document.querySelectorAll("input,textarea")];
    for (const node of nodes) {
      if (!isVisible(node)) continue;
      const ph = norm(node.getAttribute("placeholder"));
      const lab = norm(node.getAttribute("aria-label"));
      const all = `${ph} ${lab}`;
      if (all.includes("http") || all.includes("link") || all.includes("url")) return node;
    }
    return nodes.find((n) => isVisible(n)) || null;
  }

  async function addSingle(url) {
    const addButton = findByText(["add source", "add", "+"]);
    if (addButton) {
      addButton.click();
      await delay(300);
    }
    const input = findInput();
    if (!input) return { ok: false, message: "source_input_not_found" };
    input.focus();
    input.value = url;
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    input.dispatchEvent(new KeyboardEvent("keyup", { key: "Enter", bubbles: true }));
    await delay(700);
    return { ok: true };
  }

  return (async () => {
    if (!urls.length) return { ok: false, imported: 0, failed: [], message: "no_urls" };
    const failed = [];
    let imported = 0;
    for (const url of urls) {
      try {
        const result = await addSingle(url);
        if (result.ok) imported += 1;
        else failed.push({ url, reason: result.message || "add_failed" });
      } catch (error) {
        failed.push({ url, reason: error?.message || "add_failed" });
      }
    }
    return { ok: failed.length === 0, imported, failed };
  })();
}

async function batchImportSources({ notebookUrl, urls }) {
  const targetUrl = normalizeNotebookUrl(notebookUrl, "");
  const sourceUrls = dedupeUrls(urls);
  if (!targetUrl) throw new Error("invalid_notebook_url");
  if (!sourceUrls.length) throw new Error("no_source_urls");
  const notebookId = extractNotebookIdFromUrl(targetUrl);
  if (!notebookId) throw new Error("invalid_notebook_id");

  const chunkSize = 25;
  let imported = 0;
  const failed = [];
  const authUsers = [0, 1, 2, 3, 4];

  for (let i = 0; i < sourceUrls.length; i += chunkSize) {
    const chunk = sourceUrls.slice(i, i + chunkSize);
    let done = false;
    let lastError = "rpc_add_sources_failed";
    const authErrors = [];
    for (const authuser of authUsers) {
      try {
        const client = await createNotebookRpcClient(authuser);
        await client.addSources(notebookId, chunk);
        imported += chunk.length;
        done = true;
        break;
      } catch (error) {
        const message = error?.message || "rpc_add_sources_failed";
        lastError = message;
        authErrors.push(`authuser_${authuser}:${message}`);
      }
    }
    if (!done) {
      const reason = authErrors.length
        ? `rpc_add_sources_failed ${authErrors.join("|").slice(0, 600)}`
        : lastError;
      chunk.forEach((url) => failed.push({ url, reason }));
    }
  }

  const result = {
    ok: failed.length === 0,
    imported,
    failed
  };
  notebookListCache = { at: 0, notebooks: null };
  notebookSourcesCache.delete(notebookId);
  return {
    snapshot: await buildStateSnapshot(),
    result
  };
}
function extractAudioOverviewDom() {
  const norm = (v) => String(v || "").replace(/\s+/g, " ").trim();
  const list = [];
  const seen = new Set();

  const audioNodes = document.querySelectorAll("audio,source,a[href$='.mp3'],a[href*='audio'],a[href*='podcast']");
  audioNodes.forEach((node) => {
    const rawSrc = node.getAttribute("src") || node.getAttribute("href") || "";
    let src = "";
    try {
      src = new URL(rawSrc, location.href).toString();
    } catch (_) {
      return;
    }
    if (!/^https?:\/\//i.test(src) || seen.has(src)) return;
    seen.add(src);

    let title = "";
    let cur = node.parentElement;
    for (let i = 0; i < 4 && cur; i += 1) {
      const text = norm(cur.textContent);
      if (text && text.length <= 220) {
        title = text;
        break;
      }
      cur = cur.parentElement;
    }
    list.push({
      title: title || "Audio Overview",
      audioUrl: src,
      publishedAt: new Date().toISOString()
    });
  });

  return list;
}

function buildRssXml(feed) {
  const esc = (v) => String(v || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
  const items = (feed.items || []).map((it) => `
<item>
  <title>${esc(it.title)}</title>
  <enclosure url="${esc(it.audioUrl)}" type="audio/mpeg"/>
  <guid>${esc(it.audioUrl)}</guid>
  <pubDate>${new Date(it.publishedAt || Date.now()).toUTCString()}</pubDate>
</item>`).join("");
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
<channel>
  <title>${esc(feed.title)}</title>
  <description>${esc(feed.description || "NotebookLM Audio Overview Feed")}</description>
  <link>${esc(feed.notebookUrl || NOTEBOOK_HOME_URL)}</link>${items}
</channel>
</rss>`;
}

async function syncAudioOverviewToPodcast({ notebookUrl, feedTitle }) {
  const targetUrl = normalizeNotebookUrl(notebookUrl, "");
  if (!targetUrl) throw new Error("invalid_notebook_url");
  const notebookId = extractNotebookIdFromUrl(targetUrl);
  if (!notebookId) throw new Error("invalid_notebook_id");

  const authUsers = [0, 1, 2, 3, 4];
  let audioUrls = null;
  let lastError = "rpc_audio_fetch_failed";
  for (const authuser of authUsers) {
    try {
      const client = await createNotebookRpcClient(authuser);
      audioUrls = await client.getAudioOverviewUrls(notebookId);
      if (audioUrls?.downloadUrl || audioUrls?.playUrl) break;
    } catch (error) {
      lastError = error?.message || "rpc_audio_fetch_failed";
    }
  }
  if (!audioUrls) throw new Error(lastError);

  const items = [];
  if (audioUrls.downloadUrl || audioUrls.playUrl) {
    items.push({
      title: "Audio Overview",
      audioUrl: audioUrls.downloadUrl || audioUrls.playUrl,
      publishedAt: new Date().toISOString()
    });
  }

  const existing = await chrome.storage.local.get(PODCAST_FEEDS_KEY);
  const feeds = Array.isArray(existing[PODCAST_FEEDS_KEY]) ? existing[PODCAST_FEEDS_KEY] : [];
  const id = `feed_${Date.now()}`;
  const feed = {
    id,
    title: String(feedTitle || "NotebookLM Audio Feed").trim() || "NotebookLM Audio Feed",
    notebookUrl: targetUrl,
    description: "Synced from NotebookLM audio overview",
    updatedAt: new Date().toISOString(),
    items: items.slice(0, 200)
  };
  await chrome.storage.local.set({
    [PODCAST_FEEDS_KEY]: [feed, ...feeds.filter((f) => f.notebookUrl !== targetUrl)].slice(0, 20)
  });
  return {
    snapshot: await buildStateSnapshot(),
    feed,
    rssXml: buildRssXml(feed)
  };
}

async function getNotebookAudioUrls(notebookUrl) {
  const targetUrl = normalizeNotebookUrl(notebookUrl, "");
  if (!targetUrl) throw new Error("invalid_notebook_url");
  const notebookId = extractNotebookIdFromUrl(targetUrl);
  if (!notebookId) throw new Error("invalid_notebook_id");

  const authUsers = [0, 1, 2, 3, 4];
  const errors = [];
  for (const authuser of authUsers) {
    try {
      const client = await createNotebookRpcClient(authuser);
      const urls = await client.getAudioOverviewUrls(notebookId);
      if (urls?.playUrl || urls?.downloadUrl) {
        await upsertAudioTask(targetUrl, {
          status: "ready",
          finishedAt: nowIso(),
          error: "",
          urls
        }).catch(() => undefined);
        return {
          snapshot: await buildStateSnapshot(),
          urls
        };
      }
      errors.push(`authuser_${authuser}_empty`);
    } catch (error) {
      errors.push(`authuser_${authuser}:${error?.message || "audio_urls_failed"}`);
    }
  }
  throw new Error(`audio_overview_not_found ${errors.join("|").slice(0, 600)}`);
}

async function generateNotebookAudioOverview(notebookUrl) {
  const targetUrl = normalizeNotebookUrl(notebookUrl, "");
  if (!targetUrl) throw new Error("invalid_notebook_url");
  const notebookId = extractNotebookIdFromUrl(targetUrl);
  if (!notebookId) throw new Error("invalid_notebook_id");
  await upsertAudioTask(targetUrl, {
    status: "generating",
    startedAt: nowIso(),
    finishedAt: "",
    error: "",
    urls: { playUrl: "", downloadUrl: "" }
  }).catch(() => undefined);

  const authUsers = [0, 1, 2, 3, 4];
  const errors = [];
  for (const authuser of authUsers) {
    try {
      const client = await createNotebookRpcClient(authuser);
      const result = await client.createAudioOverview(notebookId);
      const task = await upsertAudioTask(targetUrl, {
        status: "generating",
        error: ""
      }).catch(() => null);
      return {
        snapshot: await buildStateSnapshot(),
        result: result || { started: true },
        audioTask: task
      };
    } catch (error) {
      errors.push(`authuser_${authuser}:${error?.message || "create_audio_failed"}`);
    }
  }
  await upsertAudioTask(targetUrl, {
    status: "error",
    finishedAt: nowIso(),
    error: errors.join("|").slice(0, 500)
  }).catch(() => undefined);
  throw new Error(`create_audio_overview_failed ${errors.join("|").slice(0, 600)}`);
}

async function checkAudioOverviewStatus(notebookUrl) {
  const targetUrl = normalizeNotebookUrl(notebookUrl, "");
  if (!targetUrl) throw new Error("invalid_notebook_url");
  const map = await getAudioTaskMap();
  const current = normalizeAudioTask(map[targetUrl] || {});

  try {
    const payload = await getNotebookAudioUrls(targetUrl);
    const task = await upsertAudioTask(targetUrl, {
      status: "ready",
      finishedAt: nowIso(),
      error: "",
      urls: payload.urls || {}
    }).catch(() => normalizeAudioTask({ status: "ready", urls: payload.urls || {} }));
    return {
      snapshot: payload.snapshot,
      notebookUrl: targetUrl,
      status: task.status,
      task
    };
  } catch (error) {
    const message = String(error?.message || "");
    const isNotReady = message.includes("audio_overview_not_found");
    if (isNotReady) {
      const nextStatus = current.status === "generating" ? "generating" : "not_ready";
      const task = await upsertAudioTask(targetUrl, {
        status: nextStatus,
        error: ""
      }).catch(() => normalizeAudioTask({ status: nextStatus }));
      return {
        snapshot: await buildStateSnapshot(),
        notebookUrl: targetUrl,
        status: task.status,
        task
      };
    }
    const task = await upsertAudioTask(targetUrl, {
      status: "error",
      finishedAt: nowIso(),
      error: message.slice(0, 500)
    }).catch(() => normalizeAudioTask({ status: "error", error: message }));
    return {
      snapshot: await buildStateSnapshot(),
      notebookUrl: targetUrl,
      status: task.status,
      task
    };
  }
}
async function getPodcastFeeds() {
  const data = await chrome.storage.local.get(PODCAST_FEEDS_KEY);
  const feeds = Array.isArray(data[PODCAST_FEEDS_KEY]) ? data[PODCAST_FEEDS_KEY] : [];
  return feeds.map((feed) => ({ ...feed, rssXml: buildRssXml(feed) }));
}

async function deletePodcastFeed(id) {
  const data = await chrome.storage.local.get(PODCAST_FEEDS_KEY);
  const feeds = Array.isArray(data[PODCAST_FEEDS_KEY]) ? data[PODCAST_FEEDS_KEY] : [];
  await chrome.storage.local.set({
    [PODCAST_FEEDS_KEY]: feeds.filter((feed) => feed.id !== id)
  });
  return getPodcastFeeds();
}

chrome.runtime.onInstalled.addListener(() => {
  ensureInitialized()
    .then((state) => syncAlarm(state.rule))
    .catch((error) => console.error(`${LOG_PREFIX} onInstalled failed`, error));
});

chrome.runtime.onStartup.addListener(() => {
  ensureInitialized()
    .then((state) => syncAlarm(state.rule))
    .catch((error) => console.error(`${LOG_PREFIX} onStartup failed`, error));
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name !== ALARM_NAME) return;
  enqueueRun("scheduled").catch((error) => console.error(`${LOG_PREFIX} scheduled run failed`, error));
});

chrome.tabs.onRemoved.addListener((tabId) => {
  mutateState((state) => {
    state.runtime.dedicatedTabs = Object.fromEntries(
      Object.entries(state.runtime.dedicatedTabs || {}).filter(([, id]) => id !== tabId)
    );
    if (state.runtime.notebookIndexTabId === tabId) {
      state.runtime.notebookIndexTabId = 0;
    }
    return state;
  }).catch((error) => console.warn(`${LOG_PREFIX} failed to clear tab runtime state`, error));
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === "GET_STATE") {
    buildStateSnapshot()
      .then((snapshot) => sendResponse({ ok: true, snapshot }))
      .catch((error) => sendResponse({ ok: false, error: error?.message || "state_failed" }));
    return true;
  }

  if (message?.type === "SAVE_RULE") {
    saveRule(message.payload)
      .then((snapshot) => sendResponse({ ok: true, snapshot }))
      .catch((error) => sendResponse({ ok: false, error: error?.message || "save_rule_failed" }));
    return true;
  }

  if (message?.type === "TOGGLE_ENABLED") {
    toggleEnabled()
      .then((snapshot) => sendResponse({ ok: true, snapshot }))
      .catch((error) => sendResponse({ ok: false, error: error?.message || "toggle_failed" }));
    return true;
  }

  if (message?.type === "OPEN_NOTEBOOK") {
    openNotebookForUser(message?.url || "")
      .then((snapshot) => sendResponse({ ok: true, snapshot }))
      .catch((error) => sendResponse({ ok: false, error: error?.message || "open_notebook_failed" }));
    return true;
  }

  if (message?.type === "RUN_NOW") {
    enqueueRun("manual")
      .then((snapshot) => sendResponse({ ok: true, snapshot }))
      .catch((error) => sendResponse({ ok: false, error: error?.message || "run_failed" }));
    return true;
  }

  if (message?.type === "RUN_NOTEBOOK_NOW") {
    runNotebookNow(message?.url || "")
      .then((snapshot) => sendResponse({ ok: true, snapshot }))
      .catch((error) => sendResponse({ ok: false, error: error?.message || "run_notebook_failed" }));
    return true;
  }

  if (message?.type === "FETCH_NOTEBOOKS" || message?.type === "GET_NOTEBOOK_LIST") {
    withTimeout(fetchNotebookList({ force: Boolean(message?.force) }), 30000, "fetch_notebooks_timeout")
      .then((payload) => sendResponse({ ok: true, ...payload }))
      .catch((error) => sendResponse({ ok: false, error: error?.message || "fetch_notebooks_failed" }));
    return true;
  }

  if (message?.type === "FETCH_NOTEBOOK_SOURCES" || message?.type === "GET_NOTEBOOK_SOURCES") {
    const data = message?.data || message || {};
    withTimeout(
      fetchNotebookSources({
        notebookUrl: data?.notebookUrl || "",
        notebookId: data?.notebookId || "",
        force: Boolean(data?.force)
      }),
      45000,
      "fetch_notebook_sources_timeout"
    )
      .then((payload) => sendResponse({ ok: true, ...payload }))
      .catch((error) => sendResponse({ ok: false, error: error?.message || "fetch_notebook_sources_failed" }));
    return true;
  }

  if (message?.type === "FETCH_ALL_SOURCES") {
    withTimeout(fetchAllSources({ force: Boolean(message?.force) }), 600000, "fetch_all_sources_timeout")
      .then((payload) => sendResponse({ ok: true, ...payload }))
      .catch((error) => sendResponse({ ok: false, error: error?.message || "fetch_all_sources_failed" }));
    return true;
  }

  if (message?.type === "FETCH_DOCUMENTS") {
    withTimeout(fetchGeneratedDocuments({ force: Boolean(message?.force) }), 120000, "fetch_documents_timeout")
      .then((payload) => sendResponse({ ok: true, ...payload }))
      .catch((error) => sendResponse({ ok: false, error: error?.message || "fetch_documents_failed" }));
    return true;
  }

  if (message?.type === "DOWNLOAD_SELECTED_SOURCES") {
    const data = message?.data || message || {};
    withTimeout(downloadSelectedSources({
      notebookUrl: data?.notebookUrl || "",
      notebookId: data?.notebookId || "",
      sourceIds: data?.sourceIds || data?.selectedSourceIds || [],
      format: data?.format || "md"
    }), 120000, "download_sources_timeout")
      .then((payload) => sendResponse({ ok: true, ...payload }))
      .catch((error) => sendResponse({ ok: false, error: error?.message || "download_sources_failed" }));
    return true;
  }

  if (message?.type === "GET_SOURCE_CONTENT_FOR_PREVIEW") {
    const data = message?.data || message || {};
    withTimeout(getSourceContentForPreview({
      notebookId: data?.notebookId || "",
      notebookUrl: data?.notebookUrl || "",
      sourceId: data?.sourceId || "",
      format: data?.format || "md"
    }), 120000, "preview_source_timeout")
      .then((payload) => sendResponse({ ok: true, ...payload }))
      .catch((error) => sendResponse({ ok: false, error: error?.message || "preview_source_failed" }));
    return true;
  }

  if (message?.type === "DELETE_SOURCES") {
    const data = message?.data || message || {};
    withTimeout(deleteSourcesByIds({
      notebookId: data?.notebookId || "",
      notebookUrl: data?.notebookUrl || "",
      sourceIds: data?.sourceIds || []
    }), 180000, "delete_sources_timeout")
      .then((payload) => sendResponse({ ok: true, success: true, ...payload }))
      .catch((error) => sendResponse({ ok: false, success: false, error: error?.message || "delete_sources_failed" }));
    return true;
  }

  if (message?.type === "SYNC_ALL_GDOCS") {
    const data = message?.data || message || {};
    withTimeout(syncAllGdocs({
      notebookId: data?.notebookId || "",
      notebookUrl: data?.notebookUrl || "",
      sourceIds: data?.sourceIds || [],
      skipTierCheck: Boolean(data?.skipTierCheck)
    }), 300000, "sync_all_gdocs_timeout")
      .then((payload) => sendResponse({ ok: true, success: true, ...payload }))
      .catch((error) => sendResponse({ ok: false, success: false, error: error?.message || "sync_all_gdocs_failed" }));
    return true;
  }

  if (message?.type === "CREATE_NOTEBOOK") {
    const data = message?.data || message || {};
    withTimeout(createNotebookSimple({
      title: data?.title || ""
    }), 180000, "create_notebook_timeout")
      .then((payload) => sendResponse({ ok: true, success: true, ...payload }))
      .catch((error) => sendResponse({ ok: false, success: false, error: error?.message || "create_notebook_failed" }));
    return true;
  }

  if (message?.type === "ADD_SOURCES_TO_NOTEBOOK") {
    const data = message?.data || message || {};
    withTimeout(addSourcesToNotebook({
      targetNotebookId: data?.targetNotebookId || data?.notebookId || "",
      targetNotebookUrl: data?.targetNotebookUrl || data?.notebookUrl || "",
      sources: data?.sources || []
    }), 300000, "add_sources_to_notebook_timeout")
      .then((payload) => sendResponse({ ok: true, success: true, ...payload }))
      .catch((error) => sendResponse({ ok: false, success: false, error: error?.message || "add_sources_to_notebook_failed" }));
    return true;
  }

  if (message?.type === "CREATE_NOTEBOOK_FROM_SOURCES") {
    const data = message?.data || message || {};
    withTimeout(createNotebookFromSources({
      title: data?.title || "",
      sources: data?.sources || []
    }), 300000, "create_notebook_from_sources_timeout")
      .then((payload) => sendResponse({ ok: true, success: true, ...payload }))
      .catch((error) => sendResponse({ ok: false, success: false, error: error?.message || "create_notebook_from_sources_failed" }));
    return true;
  }

  if (message?.type === "MERGE_NOTEBOOKS") {
    withTimeout(mergeNotebooks({
      notebookUrls: message?.notebookUrls || [],
      newTitle: message?.newTitle || "",
      deleteOriginal: Boolean(message?.deleteOriginal)
    }), 180000, "merge_notebooks_timeout")
      .then((payload) => sendResponse({ ok: true, ...payload }))
      .catch((error) => sendResponse({ ok: false, error: error?.message || "merge_notebooks_failed" }));
    return true;
  }

  if (message?.type === "OPEN_MANAGER_PAGE") {
    openManagerPage()
      .then((snapshot) => sendResponse({ ok: true, snapshot }))
      .catch((error) => sendResponse({ ok: false, error: error?.message || "open_manager_failed" }));
    return true;
  }

  if (message?.type === "GET_BROWSER_TAB_URLS") {
    getBrowserTabUrls()
      .then((urls) => sendResponse({ ok: true, urls }))
      .catch((error) => sendResponse({ ok: false, error: error?.message || "get_tabs_failed" }));
    return true;
  }

  if (message?.type === "GET_BOOKMARK_URLS") {
    getBookmarkUrls()
      .then((urls) => sendResponse({ ok: true, urls }))
      .catch((error) => sendResponse({ ok: false, error: error?.message || "get_bookmark_urls_failed" }));
    return true;
  }

  if (message?.type === "EXTRACT_PAGE_LINKS") {
    extractLinksFromPage(message?.url || "")
      .then((urls) => sendResponse({ ok: true, urls }))
      .catch((error) => sendResponse({ ok: false, error: error?.message || "extract_page_links_failed" }));
    return true;
  }

  if (message?.type === "PARSE_YOUTUBE_PLAYLIST") {
    parseYouTubePlaylist(message?.url || "")
      .then((urls) => sendResponse({ ok: true, urls }))
      .catch((error) => sendResponse({ ok: false, error: error?.message || "parse_youtube_failed" }));
    return true;
  }

  if (message?.type === "PARSE_RSS_FEED") {
    parseRssFeed(message?.url || "")
      .then((urls) => sendResponse({ ok: true, urls }))
      .catch((error) => sendResponse({ ok: false, error: error?.message || "parse_rss_failed" }));
    return true;
  }

  if (message?.type === "BATCH_IMPORT_SOURCES") {
    batchImportSources({
      notebookUrl: message?.notebookUrl || "",
      urls: message?.urls || []
    })
      .then((payload) => sendResponse({ ok: true, ...payload }))
      .catch((error) => sendResponse({ ok: false, error: error?.message || "batch_import_failed" }));
    return true;
  }

  if (message?.type === "SYNC_AUDIO_TO_PODCAST") {
    syncAudioOverviewToPodcast({
      notebookUrl: message?.notebookUrl || "",
      feedTitle: message?.feedTitle || ""
    })
      .then((payload) => sendResponse({ ok: true, ...payload }))
      .catch((error) => sendResponse({ ok: false, error: error?.message || "sync_audio_failed" }));
    return true;
  }

  if (message?.type === "GET_NOTEBOOK_AUDIO_URLS") {
    getNotebookAudioUrls(message?.notebookUrl || "")
      .then((payload) => sendResponse({ ok: true, ...payload }))
      .catch((error) => sendResponse({ ok: false, error: error?.message || "get_notebook_audio_urls_failed" }));
    return true;
  }

  if (message?.type === "GENERATE_NOTEBOOK_AUDIO_OVERVIEW") {
    generateNotebookAudioOverview(message?.notebookUrl || "")
      .then((payload) => sendResponse({ ok: true, ...payload }))
      .catch((error) => sendResponse({ ok: false, error: error?.message || "generate_notebook_audio_overview_failed" }));
    return true;
  }

  if (message?.type === "CHECK_AUDIO_OVERVIEW_STATUS") {
    checkAudioOverviewStatus(message?.notebookUrl || "")
      .then((payload) => sendResponse({ ok: true, ...payload }))
      .catch((error) => sendResponse({ ok: false, error: error?.message || "check_audio_overview_status_failed" }));
    return true;
  }

  if (message?.type === "GET_PODCAST_FEEDS") {
    getPodcastFeeds()
      .then((feeds) => sendResponse({ ok: true, feeds }))
      .catch((error) => sendResponse({ ok: false, error: error?.message || "get_podcast_feeds_failed" }));
    return true;
  }

  if (message?.type === "DELETE_PODCAST_FEED") {
    deletePodcastFeed(message?.id || "")
      .then((feeds) => sendResponse({ ok: true, feeds }))
      .catch((error) => sendResponse({ ok: false, error: error?.message || "delete_podcast_feed_failed" }));
    return true;
  }

  if (message?.type === "GET_MANAGER_META") {
    getManagerMeta()
      .then((payload) => sendResponse({ ok: true, ...payload }))
      .catch((error) => sendResponse({ ok: false, error: error?.message || "get_manager_meta_failed" }));
    return true;
  }

  if (message?.type === "GET_FOLDERS") {
    const data = message?.data || message || {};
    getFoldersByType(data?.folderType || "sources")
      .then((payload) => sendResponse({ ok: true, success: true, ...payload }))
      .catch((error) => sendResponse({ ok: false, success: false, error: error?.message || "get_folders_failed" }));
    return true;
  }

  if (message?.type === "SAVE_FOLDERS") {
    const data = message?.data || message || {};
    saveFoldersByType({
      folderType: data?.folderType || "sources",
      folders: data?.folders || [],
      assignments: data?.assignments || {}
    })
      .then((payload) => sendResponse({ ok: true, success: true, ...payload }))
      .catch((error) => sendResponse({ ok: false, success: false, error: error?.message || "save_folders_failed" }));
    return true;
  }

  if (message?.type === "TOGGLE_FAVORITE") {
    toggleFavorite(message?.notebookUrl || "")
      .then((favorites) => sendResponse({ ok: true, favorites }))
      .catch((error) => sendResponse({ ok: false, error: error?.message || "toggle_favorite_failed" }));
    return true;
  }

  if (message?.type === "SET_FAVORITES") {
    setFavoritesByAction({
      action: message?.action || "add",
      urls: message?.urls || []
    })
      .then((favorites) => sendResponse({ ok: true, favorites }))
      .catch((error) => sendResponse({ ok: false, error: error?.message || "set_favorites_failed" }));
    return true;
  }

  if (message?.type === "SET_NOTEBOOK_TAGS") {
    setNotebookTags({
      notebookUrl: message?.notebookUrl || "",
      tags: message?.tags || []
    })
      .then((notebookTags) => sendResponse({ ok: true, notebookTags }))
      .catch((error) => sendResponse({ ok: false, error: error?.message || "set_notebook_tags_failed" }));
    return true;
  }

  if (message?.type === "SAVE_COLLECTION") {
    saveCollection(message?.payload || {})
      .then((collections) => sendResponse({ ok: true, collections }))
      .catch((error) => sendResponse({ ok: false, error: error?.message || "save_collection_failed" }));
    return true;
  }

  if (message?.type === "DELETE_COLLECTION") {
    deleteCollection(message?.id || "")
      .then((collections) => sendResponse({ ok: true, collections }))
      .catch((error) => sendResponse({ ok: false, error: error?.message || "delete_collection_failed" }));
    return true;
  }

  if (message?.type === "SAVE_TEMPLATE") {
    saveTemplate(message?.payload || {})
      .then((templates) => sendResponse({ ok: true, templates }))
      .catch((error) => sendResponse({ ok: false, error: error?.message || "save_template_failed" }));
    return true;
  }

  if (message?.type === "DELETE_TEMPLATE") {
    deleteTemplate(message?.id || "")
      .then((templates) => sendResponse({ ok: true, templates }))
      .catch((error) => sendResponse({ ok: false, error: error?.message || "delete_template_failed" }));
    return true;
  }

  if (message?.type === "APPLY_TEMPLATE_TO_NOTEBOOKS") {
    applyTemplateToNotebooks({
      templateId: message?.templateId || "",
      notebookUrls: message?.notebookUrls || []
    })
      .then((payload) => sendResponse({ ok: true, ...payload }))
      .catch((error) => sendResponse({ ok: false, error: error?.message || "apply_template_failed" }));
    return true;
  }

  return false;
});




