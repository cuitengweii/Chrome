import {
  COLLECTOR_SETTINGS_KEY,
  DEFAULT_COLLECTOR_SETTINGS,
  DEFAULT_PAGE_RULES,
  normalizeCollectorSettings
} from "./collector-settings.js";

const categoryOptionsInput = document.getElementById("categoryOptions");
const defaultCategorySelect = document.getElementById("defaultCategory");
const defaultPublisherInput = document.getElementById("defaultPublisher");
const saveButton = document.getElementById("saveSettings");
const resetButton = document.getElementById("resetSettings");
const statusNode = document.getElementById("status");
const ruleGroupsNode = document.getElementById("ruleGroups");

function arrayToMultiline(values) {
  return (values || []).join("\n");
}

function multilineToArray(text) {
  return String(text || "")
    .split(/\r?\n/)
    .map((value) => value.trim())
    .filter(Boolean);
}

function setStatus(message) {
  statusNode.textContent = message;
}

function populateDefaultCategoryOptions(categories, selectedValue) {
  defaultCategorySelect.innerHTML = "";
  categories.forEach((category) => {
    const option = document.createElement("option");
    option.value = category;
    option.textContent = category;
    if (category === selectedValue) option.selected = true;
    defaultCategorySelect.appendChild(option);
  });
}

function buildRuleCard(rule, index) {
  const card = document.createElement("article");
  card.className = "rule-card";
  card.dataset.ruleId = rule.id;
  card.innerHTML = `
    <h3>${rule.label}</h3>
    <div class="rule-grid">
      <label>
        Rule Label
        <input data-field="label" type="text" value="${rule.label}">
      </label>
      <label>
        Path Prefixes
        <textarea data-field="pathnamePrefixes">${arrayToMultiline(rule.pathnamePrefixes)}</textarea>
      </label>
      <label class="full">
        Post Selectors
        <textarea data-field="postSelectors">${arrayToMultiline(rule.postSelectors)}</textarea>
      </label>
      <label class="full">
        Injection Host Selectors
        <textarea data-field="injectionHostSelectors">${arrayToMultiline(rule.injectionHostSelectors)}</textarea>
      </label>
      <label class="full">
        Action Bar Selectors
        <textarea data-field="actionBarSelectors">${arrayToMultiline(rule.actionBarSelectors)}</textarea>
      </label>
      <label class="full">
        Control Menu Trigger Selectors
        <textarea data-field="controlMenuTriggerSelectors">${arrayToMultiline(rule.controlMenuTriggerSelectors)}</textarea>
      </label>
      <label class="full">
        Copy Link Menu Item Selectors
        <textarea data-field="copyLinkMenuItemSelectors">${arrayToMultiline(rule.copyLinkMenuItemSelectors)}</textarea>
      </label>
      <label>
        Inject Mode
        <select data-field="injectMode">
          <option value="append_to_action_bar"${rule.injectMode === "append_to_action_bar" ? " selected" : ""}>append_to_action_bar</option>
          <option value="after_action_bar"${rule.injectMode === "after_action_bar" ? " selected" : ""}>after_action_bar</option>
        </select>
      </label>
      <label>
        Platform
        <input type="text" value="${rule.platform}" disabled>
      </label>
    </div>
  `;
  card.dataset.index = String(index);
  return card;
}

function renderRuleGroups(settings) {
  ruleGroupsNode.innerHTML = "";
  const grouped = settings.pageRules.reduce((accumulator, rule, index) => {
    const platform = rule.platform || "web";
    if (!accumulator.has(platform)) accumulator.set(platform, []);
    accumulator.get(platform).push({ rule, index });
    return accumulator;
  }, new Map());

  grouped.forEach((entries, platform) => {
    const section = document.createElement("section");
    section.className = "rule-group";
    const heading = document.createElement("div");
    heading.className = "panel";
    heading.innerHTML = `<h2>${platform === "linkedin" ? "LinkedIn" : platform === "x" ? "X" : platform}</h2>`;
    section.appendChild(heading);
    entries.forEach(({ rule, index }) => section.appendChild(buildRuleCard(rule, index)));
    ruleGroupsNode.appendChild(section);
  });
}

function readSettingsFromForm() {
  const categories = multilineToArray(categoryOptionsInput.value);
  const pageRules = [];
  document.querySelectorAll(".rule-card").forEach((card) => {
    const index = Number(card.dataset.index || "-1");
    const baseRule = DEFAULT_PAGE_RULES[index] || DEFAULT_PAGE_RULES[0];
    pageRules.push({
      ...baseRule,
      id: card.dataset.ruleId || baseRule.id,
      platform: baseRule.platform,
      label: card.querySelector("[data-field='label']").value.trim(),
      pathnamePrefixes: multilineToArray(card.querySelector("[data-field='pathnamePrefixes']").value),
      postSelectors: multilineToArray(card.querySelector("[data-field='postSelectors']").value),
      injectionHostSelectors: multilineToArray(card.querySelector("[data-field='injectionHostSelectors']").value),
      actionBarSelectors: multilineToArray(card.querySelector("[data-field='actionBarSelectors']").value),
      controlMenuTriggerSelectors: multilineToArray(card.querySelector("[data-field='controlMenuTriggerSelectors']").value),
      copyLinkMenuItemSelectors: multilineToArray(card.querySelector("[data-field='copyLinkMenuItemSelectors']").value),
      injectMode: card.querySelector("[data-field='injectMode']").value
    });
  });

  return normalizeCollectorSettings({
    categoryOptions: categories,
    defaultCategory: defaultCategorySelect.value,
    defaultPublisher: defaultPublisherInput.value.trim(),
    pageRules
  });
}

function renderSettings(settings) {
  categoryOptionsInput.value = arrayToMultiline(settings.categoryOptions);
  populateDefaultCategoryOptions(settings.categoryOptions, settings.defaultCategory);
  defaultPublisherInput.value = settings.defaultPublisher;
  renderRuleGroups(settings);
}

async function loadSettings() {
  const data = await chrome.storage.local.get([COLLECTOR_SETTINGS_KEY]);
  const settings = normalizeCollectorSettings(data[COLLECTOR_SETTINGS_KEY] || DEFAULT_COLLECTOR_SETTINGS);
  renderSettings(settings);
}

categoryOptionsInput.addEventListener("input", () => {
  const categories = multilineToArray(categoryOptionsInput.value);
  populateDefaultCategoryOptions(categories.length ? categories : DEFAULT_COLLECTOR_SETTINGS.categoryOptions, defaultCategorySelect.value);
});

saveButton.addEventListener("click", async () => {
  const settings = readSettingsFromForm();
  await chrome.storage.local.set({ [COLLECTOR_SETTINGS_KEY]: settings });
  renderSettings(settings);
  setStatus("Settings saved.");
});

resetButton.addEventListener("click", async () => {
  const settings = normalizeCollectorSettings(DEFAULT_COLLECTOR_SETTINGS);
  await chrome.storage.local.set({ [COLLECTOR_SETTINGS_KEY]: settings });
  renderSettings(settings);
  setStatus("Defaults restored.");
});

loadSettings().catch((error) => {
  console.error("[GasGx Collector] Failed to load options", error);
  setStatus(`Failed to load settings: ${error.message}`);
});
