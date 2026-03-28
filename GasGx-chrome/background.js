import {
  COLLECTOR_SETTINGS_KEY,
  DEFAULT_COLLECTOR_SETTINGS,
  normalizeCollectorSettings
} from "./collector-settings.js";
import { SUPABASE_CONFIG } from "./supabase-config.js";

const LOG_PREFIX = "[GasGx Collector]";
const DEBUGGER_VERSION = "1.3";
const FALLBACK_QUEUE_TABLE = "scrape_queue";

async function getCollectorSettings() {
  const data = await chrome.storage.local.get([COLLECTOR_SETTINGS_KEY]);
  return normalizeCollectorSettings(data[COLLECTOR_SETTINGS_KEY] || DEFAULT_COLLECTOR_SETTINGS);
}

async function saveCollectorSettings(settings) {
  const normalized = normalizeCollectorSettings(settings || {});
  await chrome.storage.local.set({ [COLLECTOR_SETTINGS_KEY]: normalized });
  return normalized;
}

async function sha256Hex(text) {
  const bytes = new TextEncoder().encode(String(text || ""));
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(hash)].map((value) => value.toString(16).padStart(2, "0")).join("");
}

function normalizeDebuggerError(error) {
  const message = String(error?.message || error || "").trim();
  if (!message) return "Debugger click failed";
  if (message.includes("Another debugger")) return "Debugger is busy. Close DevTools for this tab.";
  return message;
}

async function performDebuggerClick(tabId, point) {
  const target = { tabId };
  let attached = false;
  try {
    await chrome.debugger.attach(target, DEBUGGER_VERSION);
    attached = true;
    const x = Math.round(point?.x || 0);
    const y = Math.round(point?.y || 0);
    await chrome.debugger.sendCommand(target, "Input.dispatchMouseEvent", {
      type: "mouseMoved",
      x,
      y,
      button: "left",
      buttons: 1
    });
    await chrome.debugger.sendCommand(target, "Input.dispatchMouseEvent", {
      type: "mousePressed",
      x,
      y,
      button: "left",
      buttons: 1,
      clickCount: 1
    });
    await chrome.debugger.sendCommand(target, "Input.dispatchMouseEvent", {
      type: "mouseReleased",
      x,
      y,
      button: "left",
      buttons: 1,
      clickCount: 1
    });
  } catch (error) {
    throw new Error(normalizeDebuggerError(error));
  } finally {
    if (attached) {
      try {
        await chrome.debugger.detach(target);
      } catch (_) {
        // ignore
      }
    }
  }
}

async function saveSocialPost(payload) {
  const platform = String(payload?.platform || "web").trim().toLowerCase() || "web";
  const postUrl = String(payload?.post_url || payload?.url || "").trim();
  if (!postUrl) {
    return { ok: false, error: "No post URL provided" };
  }

  const settings = await getCollectorSettings();
  const platformDefaults = SUPABASE_CONFIG.platformDefaults?.[platform] || {};
  const defaultPublisher =
    String(payload?.publisher || platformDefaults.publisher || settings.defaultPublisher || "GasGx Web").trim() ||
    "GasGx Web";

  const row = {
    platform,
    post_id: "",
    url: postUrl,
    title: String(payload?.title || "").trim(),
    snippet: String(payload?.snippet || "").trim(),
    keyword: "",
    source: defaultPublisher,
    collector_mode: "manual_extension",
    fetched_at_utc: new Date().toISOString(),
    content_hash: await sha256Hex(`${platform}|${postUrl}|${payload?.title || ""}`),
    category: String(payload?.category || settings.defaultCategory || "").trim(),
    main_tag: "News",
    secondary_tag: String(payload?.status || "pending").trim(),
    secondary_tag_group: String(payload?.author || "").trim(),
    categories_json: [String(payload?.category || settings.defaultCategory || "").trim()].filter(Boolean),
    matched_rules_json: [],
    ai_classification_json: {
      source: "gasgx_extension",
      author: String(payload?.author || "").trim(),
      published_time: String(payload?.published_time || "").trim(),
      status: String(payload?.status || "pending").trim()
    },
    raw_json: payload || {},
    synced_at_utc: new Date().toISOString()
  };

  const primaryResult = await insertRowsWithMissingColumnRetry({
    table: SUPABASE_CONFIG.table,
    onConflict: SUPABASE_CONFIG.onConflict,
    rows: [row]
  });
  if (primaryResult.ok) return primaryResult;

  const primaryError = String(primaryResult.error || "");
  const missingPrimaryTable = primaryError.includes("Could not find the table") || primaryError.includes("PGRST205");
  if (!missingPrimaryTable) {
    return primaryResult;
  }

  console.warn(`${LOG_PREFIX} Primary table unavailable, falling back to ${FALLBACK_QUEUE_TABLE}:`, primaryError);
  const queuePayload = buildScrapeQueuePayload(payload, postUrl, defaultPublisher);
  const queueResult = await insertRowsWithMissingColumnRetry({
    table: FALLBACK_QUEUE_TABLE,
    rows: [queuePayload]
  });
  return queueResult;
}

function buildScrapeQueuePayload(payload, postUrl, publisher) {
  const category = String(payload?.category || "").trim();
  const secondaryTag = String(payload?.author || "").trim();
  return {
    link: postUrl,
    category,
    publisher: String(publisher || "").trim(),
    tag_choice: category,
    secondary_tag: secondaryTag,
    status: "pending",
    summary: String(payload?.snippet || "").trim().slice(0, 1000),
    subtitle: String(payload?.title || "").trim().slice(0, 500),
    source_note: String(payload?.platform || "").trim(),
    submitted_at: new Date().toISOString()
  };
}

function getMissingColumnName(errorText, expectedTable = "") {
  const { message } = parsePostgrestError(errorText);
  const match = message.match(
    /Could not find the ['"`]?([^'"`]+)['"`]? column of ['"`]?([^'"`]+)['"`]? in the schema cache/i
  );
  if (!match) return "";

  const [, column, table] = match;
  if (expectedTable && !isSameTableName(table, expectedTable)) return "";
  return column || "";
}

function parsePostgrestError(errorText) {
  const raw = String(errorText || "").trim();
  if (!raw) return { raw: "", message: "", parsed: null };

  const candidates = [raw];
  const firstBrace = raw.indexOf("{");
  const lastBrace = raw.lastIndexOf("}");
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    candidates.push(raw.slice(firstBrace, lastBrace + 1));
  }

  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate);
      if (!parsed || typeof parsed !== "object") continue;
      return {
        raw,
        message: String(parsed?.message || raw),
        parsed
      };
    } catch (_) {
      // try next candidate
    }
  }

  return { raw, message: raw, parsed: null };
}

function normalizeTableName(value) {
  return String(value || "")
    .trim()
    .replace(/^"+|"+$/g, "")
    .replace(/^'+|'+$/g, "")
    .split(".")
    .pop()
    ?.toLowerCase() || "";
}

function isSameTableName(a, b) {
  return normalizeTableName(a) === normalizeTableName(b);
}

async function insertRowsWithMissingColumnRetry({ table, onConflict = "", rows, maxRetries = 5 }) {
  let currentRows = (rows || []).map((row) => ({ ...(row || {}) }));
  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    const result = await insertRowsToTable({
      table,
      onConflict,
      rows: currentRows
    });
    if (result.ok) return result;

    const missingColumn = getMissingColumnName(result.error, table);
    if (!missingColumn) return result;

    const hasMissingColumn = currentRows.some((row) => Object.prototype.hasOwnProperty.call(row, missingColumn));
    if (!hasMissingColumn) return result;

    console.warn(`${LOG_PREFIX} ${table} missing column "${missingColumn}", retrying without it.`);
    currentRows = currentRows.map((row) => {
      const next = { ...row };
      delete next[missingColumn];
      return next;
    });
  }

  return { ok: false, error: `Insert failed for table ${table} after ${maxRetries + 1} attempts` };
}

async function insertRowsToTable({ table, onConflict = "", rows }) {
  const requestUrl =
    `${SUPABASE_CONFIG.url}/rest/v1/${encodeURIComponent(table)}${onConflict ? `?on_conflict=${encodeURIComponent(onConflict)}` : ""}`;

  const response = await fetch(requestUrl, {
    method: "POST",
    headers: {
      apikey: SUPABASE_CONFIG.key,
      Authorization: `Bearer ${SUPABASE_CONFIG.key}`,
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates,return=representation"
    },
    body: JSON.stringify(rows || [])
  });

  if (!response.ok) {
    const errorText = await response.text();
    return { ok: false, error: errorText || `Supabase error ${response.status}` };
  }

  const data = await response.json().catch(() => []);
  return { ok: true, data };
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === "GET_COLLECTOR_SETTINGS") {
    getCollectorSettings()
      .then((settings) => sendResponse({ ok: true, settings }))
      .catch((error) => {
        console.error(`${LOG_PREFIX} GET_COLLECTOR_SETTINGS failed:`, error);
        sendResponse({ ok: false, error: error?.message || "settings_read_failed" });
      });
    return true;
  }

  if (message?.type === "SAVE_COLLECTOR_SETTINGS") {
    saveCollectorSettings(message?.payload || {})
      .then((settings) => sendResponse({ ok: true, settings }))
      .catch((error) => {
        console.error(`${LOG_PREFIX} SAVE_COLLECTOR_SETTINGS failed:`, error);
        sendResponse({ ok: false, error: error?.message || "settings_save_failed" });
      });
    return true;
  }

  if (message?.type === "SAVE_SOCIAL_POST") {
    saveSocialPost(message?.payload || {})
      .then((result) => sendResponse(result))
      .catch((error) => {
        console.error(`${LOG_PREFIX} SAVE_SOCIAL_POST failed:`, error);
        sendResponse({ ok: false, error: error?.message || "save_failed" });
      });
    return true;
  }

  if (message?.type === "DEBUGGER_CLICK_AT_POINT") {
    const tabId = sender?.tab?.id;
    if (typeof tabId !== "number") {
      sendResponse({ ok: false, error: "No sender tab available" });
      return false;
    }

    performDebuggerClick(tabId, message?.payload || {})
      .then(() => sendResponse({ ok: true }))
      .catch((error) => sendResponse({ ok: false, error: error?.message || "debugger_click_failed" }));
    return true;
  }

  return false;
});
