export const COLLECTOR_SETTINGS_KEY = "collector_settings_v1";

const DEFAULT_LINKEDIN_ACTION_BAR_SELECTORS = Object.freeze([
  ".feed-shared-social-action-bar",
  ".social-details-social-actions",
  ".update-v2-social-activity",
  ".update-v2-social-actions",
  ".feed-shared-social-action-bar__action-button-container"
]);

const DEFAULT_LINKEDIN_CONTROL_MENU_TRIGGER_SELECTORS = Object.freeze([
  "[data-view-name='feed-control-menu-trigger']",
  "[data-view-name*='control-menu-trigger']",
  ".feed-shared-control-menu button[aria-expanded]",
  ".feed-shared-control-menu__trigger",
  ".feed-shared-update-v2__control-menu-container button[aria-expanded]",
  ".feed-shared-update-v2__control-menu-container button",
  "button[aria-label*='Control menu']",
  "button[aria-label*='post control menu']",
  "button[aria-label*='More actions']"
]);

const DEFAULT_LINKEDIN_COPY_LINK_MENU_ITEM_SELECTORS = Object.freeze([
  "[data-view-name='feed-control-menu-copy-link']",
  "[data-view-name*='copy-link']",
  "[role='menuitem'][data-view-name*='copy-link']"
]);

const DEFAULT_X_ACTION_BAR_SELECTORS = Object.freeze([
  "div[role='group']"
]);

export const DEFAULT_PAGE_RULES = Object.freeze([
  Object.freeze({
    id: "linkedin-feed",
    platform: "linkedin",
    label: "LinkedIn Feed",
    pathnamePrefixes: ["/feed/"],
    postSelectors: [
      "div.feed-shared-update-v2",
      "div.update-components-update-v2",
      "div[data-urn*='urn:li:activity:'][role='article']"
    ],
    injectionHostSelectors: [
      "div.feed-shared-update-v2",
      "div.update-components-update-v2",
      "div[data-urn*='urn:li:activity:'][role='article']"
    ],
    actionBarSelectors: DEFAULT_LINKEDIN_ACTION_BAR_SELECTORS,
    controlMenuTriggerSelectors: DEFAULT_LINKEDIN_CONTROL_MENU_TRIGGER_SELECTORS,
    copyLinkMenuItemSelectors: DEFAULT_LINKEDIN_COPY_LINK_MENU_ITEM_SELECTORS,
    injectMode: "append_to_action_bar"
  }),
  Object.freeze({
    id: "linkedin-search-content",
    platform: "linkedin",
    label: "LinkedIn Search Content",
    pathnamePrefixes: ["/search/results/content/"],
    postSelectors: [
      "div[data-view-name='feed-full-update']",
      "li.reusable-search__result-container",
      "div.reusable-search__result-container",
      "div.search-content__result"
    ],
    injectionHostSelectors: [
      "div[data-view-name='feed-full-update']",
      "li.reusable-search__result-container",
      "div.reusable-search__result-container"
    ],
    actionBarSelectors: DEFAULT_LINKEDIN_ACTION_BAR_SELECTORS,
    controlMenuTriggerSelectors: DEFAULT_LINKEDIN_CONTROL_MENU_TRIGGER_SELECTORS,
    copyLinkMenuItemSelectors: DEFAULT_LINKEDIN_COPY_LINK_MENU_ITEM_SELECTORS,
    injectMode: "after_action_bar"
  }),
  Object.freeze({
    id: "x-home",
    platform: "x",
    label: "X Home",
    pathnamePrefixes: ["/home"],
    postSelectors: ["article[data-testid='tweet']", "article"],
    injectionHostSelectors: ["article[data-testid='tweet']", "article"],
    actionBarSelectors: DEFAULT_X_ACTION_BAR_SELECTORS,
    controlMenuTriggerSelectors: [],
    copyLinkMenuItemSelectors: [],
    injectMode: "append_to_action_bar"
  }),
  Object.freeze({
    id: "x-search",
    platform: "x",
    label: "X Search",
    pathnamePrefixes: ["/search"],
    postSelectors: ["article[data-testid='tweet']", "article"],
    injectionHostSelectors: ["article[data-testid='tweet']", "article"],
    actionBarSelectors: DEFAULT_X_ACTION_BAR_SELECTORS,
    controlMenuTriggerSelectors: [],
    copyLinkMenuItemSelectors: [],
    injectMode: "append_to_action_bar"
  }),
  Object.freeze({
    id: "x-fallback",
    platform: "x",
    label: "X Fallback",
    pathnamePrefixes: ["/"],
    postSelectors: ["article[data-testid='tweet']", "article"],
    injectionHostSelectors: ["article[data-testid='tweet']", "article"],
    actionBarSelectors: DEFAULT_X_ACTION_BAR_SELECTORS,
    controlMenuTriggerSelectors: [],
    copyLinkMenuItemSelectors: [],
    injectMode: "append_to_action_bar"
  })
]);

export const DEFAULT_COLLECTOR_SETTINGS = Object.freeze({
  categoryOptions: [
    "Insights",
    "Mining",
    "Gas Energy",
    "Events",
    "Generators",
    "Data"
  ],
  defaultCategory: "Gas Energy",
  defaultPublisher: "GasGx Web",
  pageRules: DEFAULT_PAGE_RULES
});

function normalizeCategoryOptions(rawOptions) {
  const fallback = DEFAULT_COLLECTOR_SETTINGS.categoryOptions.slice();
  if (!Array.isArray(rawOptions)) return fallback;
  const seen = new Set();
  const cleaned = [];
  rawOptions.forEach((value) => {
    const text = String(value || "").trim();
    if (!text) return;
    const key = text.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    cleaned.push(text);
  });
  return cleaned.length ? cleaned : fallback;
}

function normalizeStringArray(rawValues, fallbackValues) {
  if (!Array.isArray(rawValues)) return fallbackValues.slice();
  const seen = new Set();
  const cleaned = [];
  rawValues.forEach((value) => {
    const text = String(value || "").trim();
    if (!text || seen.has(text)) return;
    seen.add(text);
    cleaned.push(text);
  });
  return cleaned.length ? cleaned : fallbackValues.slice();
}

function normalizePlatform(rawPlatform, fallbackPlatform = "linkedin") {
  const platform = String(rawPlatform || "").trim().toLowerCase();
  if (platform === "linkedin" || platform === "x") return platform;
  return fallbackPlatform;
}

function normalizeInjectMode(rawMode, fallbackMode = "append_to_action_bar") {
  const mode = String(rawMode || "").trim().toLowerCase();
  if (mode === "append_to_action_bar" || mode === "after_action_bar") return mode;
  return fallbackMode;
}

function normalizePageRules(rawPageRules, legacyLinkedInRules) {
  const sourceRules = Array.isArray(rawPageRules)
    ? rawPageRules
    : (Array.isArray(legacyLinkedInRules)
      ? legacyLinkedInRules.map((rule, index) => ({
        ...(DEFAULT_PAGE_RULES[index] || DEFAULT_PAGE_RULES[0]),
        ...(rule || {}),
        platform: "linkedin"
      }))
      : DEFAULT_PAGE_RULES);

  const normalized = [];
  const seenIds = new Set();

  sourceRules.forEach((rawRule, index) => {
    const baseRule =
      DEFAULT_PAGE_RULES.find((rule) => rule.id === rawRule?.id) ||
      DEFAULT_PAGE_RULES[index] ||
      DEFAULT_PAGE_RULES[0];
    const platform = normalizePlatform(rawRule?.platform, baseRule.platform);
    const actionBarFallback = platform === "linkedin"
      ? DEFAULT_LINKEDIN_ACTION_BAR_SELECTORS
      : DEFAULT_X_ACTION_BAR_SELECTORS;
    const controlMenuFallback = platform === "linkedin"
      ? DEFAULT_LINKEDIN_CONTROL_MENU_TRIGGER_SELECTORS
      : [];
    const copyLinkFallback = platform === "linkedin"
      ? DEFAULT_LINKEDIN_COPY_LINK_MENU_ITEM_SELECTORS
      : [];

    const normalizedRule = {
      id: String(rawRule?.id || baseRule.id || `${platform}-${index + 1}`).trim(),
      platform,
      label: String(rawRule?.label || baseRule.label || baseRule.id).trim() || baseRule.id,
      pathnamePrefixes: normalizeStringArray(rawRule?.pathnamePrefixes, baseRule.pathnamePrefixes || ["/"]),
      postSelectors: normalizeStringArray(rawRule?.postSelectors, baseRule.postSelectors || []),
      injectionHostSelectors: normalizeStringArray(
        rawRule?.injectionHostSelectors,
        baseRule.injectionHostSelectors || baseRule.postSelectors || []
      ),
      actionBarSelectors: normalizeStringArray(rawRule?.actionBarSelectors, actionBarFallback),
      controlMenuTriggerSelectors: normalizeStringArray(rawRule?.controlMenuTriggerSelectors, controlMenuFallback),
      copyLinkMenuItemSelectors: normalizeStringArray(rawRule?.copyLinkMenuItemSelectors, copyLinkFallback),
      injectMode: normalizeInjectMode(rawRule?.injectMode, baseRule.injectMode || "append_to_action_bar")
    };

    if (!normalizedRule.id || seenIds.has(normalizedRule.id) || !normalizedRule.postSelectors.length) {
      return;
    }

    seenIds.add(normalizedRule.id);
    normalized.push(normalizedRule);
  });

  return normalized.length ? normalized : DEFAULT_PAGE_RULES.map((rule) => ({ ...rule }));
}

export function normalizeCollectorSettings(rawSettings) {
  const categoryOptions = normalizeCategoryOptions(rawSettings?.categoryOptions);
  const defaultCategory = categoryOptions.includes(rawSettings?.defaultCategory)
    ? rawSettings.defaultCategory
    : (categoryOptions.includes(DEFAULT_COLLECTOR_SETTINGS.defaultCategory)
      ? DEFAULT_COLLECTOR_SETTINGS.defaultCategory
      : categoryOptions[0]);
  const defaultPublisher = String(rawSettings?.defaultPublisher || "").trim() || DEFAULT_COLLECTOR_SETTINGS.defaultPublisher;
  const pageRules = normalizePageRules(rawSettings?.pageRules, rawSettings?.linkedinPageRules);

  return {
    categoryOptions,
    defaultCategory,
    defaultPublisher,
    pageRules
  };
}
