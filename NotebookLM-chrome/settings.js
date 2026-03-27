export const RULES_KEY = "automationRules";
export const LEGACY_RULE_KEY = "automationRule";
export const RUNTIME_KEY = "automationRuntime";
export const ALARM_NAME = "notebooklm-source-refresh";
export const MAX_LOG_ENTRIES = 40;

export const RESULT_LABELS = Object.freeze({
  idle: "Idle",
  running: "Running",
  success: "Success",
  login_required: "Login/Permission Required",
  source_not_found: "Source Not Found",
  refresh_not_found: "Refresh Entry Not Found",
  page_error: "Page Error"
});

export const MODE_LABELS = Object.freeze({
  manual: "Manual",
  scheduled: "Scheduled",
  system: "System"
});

const VALID_RESULTS = new Set(Object.keys(RESULT_LABELS));
const VALID_MODES = new Set(Object.keys(MODE_LABELS));
const DEFAULT_NOTEBOOK_URL = "https://notebooklm.google.com/notebook/f7a160de-acd3-43eb-8c3d-bc6c6214b6a0";
const DEFAULT_SOURCE_LABEL = "work ai news";

export const DEFAULT_RULE = Object.freeze({
  enabled: true,
  intervalMinutes: 60,
  targets: Object.freeze([Object.freeze({
    notebookUrl: DEFAULT_NOTEBOOK_URL,
    sourceLabel: DEFAULT_SOURCE_LABEL
  })]),
  refreshLabel: "点击即可与 Google 云端硬盘同步"
});

export const DEFAULT_RUNTIME = Object.freeze({
  dedicatedTabs: Object.freeze({}),
  notebookIndexTabId: 0,
  lastRunAt: "",
  lastSuccessAt: "",
  lastResult: "idle",
  lastErrorMessage: "",
  lastNotifiedErrorKey: "",
  lastRunAtByUrl: Object.freeze({}),
  recentRuns: Object.freeze([])
});

function trimText(value, fallback = "") {
  const text = String(value ?? "").trim();
  return text || fallback;
}

function clampInteger(value, fallback, min, max) {
  const number = Number.parseInt(String(value ?? ""), 10);
  if (!Number.isFinite(number)) return fallback;
  if (number < min || number > max) return fallback;
  return number;
}

export function normalizeNotebookUrl(value, fallback = "") {
  const candidate = trimText(value, fallback);
  try {
    const parsed = new URL(candidate);
    if (parsed.protocol !== "https:" || parsed.hostname !== "notebooklm.google.com") return fallback;
    const pathname = parsed.pathname.replace(/\/+$/, "") || "/";
    const search = parsed.search || "";
    return `${parsed.origin}${pathname}${search}`;
  } catch (_) {
    return fallback;
  }
}

export function compareNotebookUrls(left, right) {
  return normalizeNotebookUrl(left, "") === normalizeNotebookUrl(right, "");
}

function parseTargetLine(line, defaultSourceLabel) {
  const raw = trimText(line);
  if (!raw) return null;
  const parts = raw.split("|");
  const notebookUrl = normalizeNotebookUrl(parts[0], "");
  if (!notebookUrl) return null;
  const sourceLabel = trimText(parts.slice(1).join("|"), defaultSourceLabel || DEFAULT_SOURCE_LABEL);
  return { notebookUrl, sourceLabel };
}

export function parseTargetLines(value, defaultSourceLabel = DEFAULT_SOURCE_LABEL) {
  const lines = Array.isArray(value)
    ? value
    : String(value ?? "").split(/\r?\n/);

  const results = [];
  for (const line of lines) {
    const target = parseTargetLine(line, defaultSourceLabel);
    if (!target) continue;
    results.push(target);
  }
  return results;
}

function normalizeTargets(rawRule = {}) {
  const legacyDefaultSource = trimText(rawRule.sourceLabel, DEFAULT_SOURCE_LABEL);

  if (Array.isArray(rawRule.targets) && rawRule.targets.length) {
    const targetLines = rawRule.targets.map((target) => `${target?.notebookUrl || ""}|${target?.sourceLabel || legacyDefaultSource}`);
    const normalized = parseTargetLines(targetLines, legacyDefaultSource);
    if (normalized.length) return normalized;
  }

  if (trimText(rawRule.targetLines)) {
    const normalized = parseTargetLines(rawRule.targetLines, legacyDefaultSource);
    if (normalized.length) return normalized;
  }

  if (Array.isArray(rawRule.notebookUrls) && rawRule.notebookUrls.length) {
    const normalized = parseTargetLines(rawRule.notebookUrls.map((url) => `${url}|${legacyDefaultSource}`), legacyDefaultSource);
    if (normalized.length) return normalized;
  }

  if (trimText(rawRule.notebookUrl)) {
    const notebookUrl = normalizeNotebookUrl(rawRule.notebookUrl, DEFAULT_NOTEBOOK_URL);
    return [{ notebookUrl, sourceLabel: legacyDefaultSource }];
  }

  return [{ ...DEFAULT_RULE.targets[0] }];
}

export function normalizeRule(rawRule = {}) {
  return {
    enabled: rawRule.enabled !== false,
    intervalMinutes: clampInteger(rawRule.intervalMinutes, DEFAULT_RULE.intervalMinutes, 5, 1440),
    targets: normalizeTargets(rawRule),
    refreshLabel: trimText(rawRule.refreshLabel, DEFAULT_RULE.refreshLabel)
  };
}

function normalizeLogEntry(rawEntry = {}) {
  return {
    at: trimText(rawEntry.at),
    mode: VALID_MODES.has(rawEntry.mode) ? rawEntry.mode : "system",
    result: VALID_RESULTS.has(rawEntry.result) ? rawEntry.result : "page_error",
    message: trimText(rawEntry.message).slice(0, 360)
  };
}

function normalizeTabMap(rawMap = {}) {
  const map = {};
  Object.entries(rawMap || {}).forEach(([url, tabId]) => {
    const normalizedUrl = normalizeNotebookUrl(url, "");
    if (!normalizedUrl || !Number.isInteger(tabId)) return;
    map[normalizedUrl] = tabId;
  });
  return map;
}

function normalizeRunMap(rawMap = {}) {
  const map = {};
  Object.entries(rawMap || {}).forEach(([url, iso]) => {
    const normalizedUrl = normalizeNotebookUrl(url, "");
    const value = trimText(iso);
    if (!normalizedUrl || !value) return;
    map[normalizedUrl] = value;
  });
  return map;
}

export function normalizeRuntime(rawRuntime = {}) {
  const recentRuns = Array.isArray(rawRuntime.recentRuns)
    ? rawRuntime.recentRuns.map((entry) => normalizeLogEntry(entry)).slice(0, MAX_LOG_ENTRIES)
    : [];

  const dedicatedTabs = normalizeTabMap(rawRuntime.dedicatedTabs || {});
  const legacyDedicatedTabId = Number.isInteger(rawRuntime.dedicatedTabId) ? rawRuntime.dedicatedTabId : null;
  if (legacyDedicatedTabId && !dedicatedTabs[DEFAULT_NOTEBOOK_URL]) {
    dedicatedTabs[DEFAULT_NOTEBOOK_URL] = legacyDedicatedTabId;
  }

  return {
    dedicatedTabs,
    notebookIndexTabId: Number.isInteger(rawRuntime.notebookIndexTabId) ? rawRuntime.notebookIndexTabId : 0,
    lastRunAt: trimText(rawRuntime.lastRunAt),
    lastSuccessAt: trimText(rawRuntime.lastSuccessAt),
    lastResult: VALID_RESULTS.has(rawRuntime.lastResult) ? rawRuntime.lastResult : DEFAULT_RUNTIME.lastResult,
    lastErrorMessage: trimText(rawRuntime.lastErrorMessage).slice(0, 360),
    lastNotifiedErrorKey: trimText(rawRuntime.lastNotifiedErrorKey).slice(0, 360),
    lastRunAtByUrl: normalizeRunMap(rawRuntime.lastRunAtByUrl || {}),
    recentRuns
  };
}

export function appendRunLog(runtime, entry) {
  const normalizedRuntime = normalizeRuntime(runtime);
  const normalizedEntry = normalizeLogEntry(entry);
  return normalizeRuntime({
    ...normalizedRuntime,
    recentRuns: [normalizedEntry, ...normalizedRuntime.recentRuns].slice(0, MAX_LOG_ENTRIES)
  });
}
