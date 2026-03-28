(() => {
  function isXOrTwitterHost(hostname = "") {
    const host = String(hostname || "").toLowerCase();
    return host === "x.com"
      || host === "www.x.com"
      || host === "twitter.com"
      || host === "www.twitter.com"
      || host === "mobile.twitter.com";
  }

  function normalizeStatusUrl(rawHref = "") {
    try {
      const parsed = new URL(String(rawHref || ""), location.origin);
      if (!isXOrTwitterHost(parsed.hostname)) return "";
      const direct = parsed.pathname.match(/^\/[^/]+\/status\/(\d+)/i);
      const web = parsed.pathname.match(/^\/i\/web\/status\/(\d+)/i);
      const statusId = direct?.[1] || web?.[1] || "";
      if (!statusId) return "";
      return `https://x.com/i/web/status/${statusId}`;
    } catch (_) {
      return "";
    }
  }

  function toNodes(path = []) {
    const out = [];
    for (const node of (path || [])) {
      if (node instanceof Element) out.push(node);
    }
    return out;
  }

  function findStatusFromElement(element) {
    if (!(element instanceof Element)) return "";
    const directAnchor = element.closest("a[href*='/status/'],a[href*='/i/web/status/']");
    const directUrl = normalizeStatusUrl(directAnchor?.getAttribute("href") || "");
    if (directUrl) return directUrl;

    const article = element.closest("article");
    if (article) {
      const anchors = article.querySelectorAll("a[href*='/status/'],a[href*='/i/web/status/']");
      for (const anchor of anchors) {
        const url = normalizeStatusUrl(anchor.getAttribute("href") || "");
        if (url) return url;
      }
    }
    return "";
  }

  function findStatusFromEvent(event) {
    const path = toNodes(event.composedPath?.() || []);
    for (const node of path) {
      const url = findStatusFromElement(node);
      if (url) return url;
    }
    return "";
  }

  async function reportStatusUrl(statusUrl) {
    if (!statusUrl) return;
    try {
      await chrome.runtime.sendMessage({
        type: "SET_LAST_X_STATUS_URL",
        statusUrl,
        pageUrl: location.href
      });
    } catch (_) {
      // noop
    }
  }

  document.addEventListener("contextmenu", (event) => {
    const statusUrl = findStatusFromEvent(event);
    reportStatusUrl(statusUrl);
  }, true);
})();
