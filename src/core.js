(function initCore(root, factory) {
  const api = factory();

  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }

  root.ChatBulkDelete = root.ChatBulkDelete || {};
  root.ChatBulkDelete.core = api;
})(typeof globalThis !== "undefined" ? globalThis : window, function createCore() {
  "use strict";

  function parseConversationHref(href, baseUrl = "https://chatgpt.com") {
    if (!href || typeof href !== "string") {
      return null;
    }

    let url;
    try {
      url = new URL(href, baseUrl);
    } catch (_error) {
      return null;
    }

    if (url.hostname !== "chatgpt.com" && url.hostname !== "www.chatgpt.com") {
      return null;
    }

    const match = url.pathname.match(/\/c\/([a-z0-9-]{8,})(?:\/|$)/i);
    if (!match) {
      return null;
    }

    return {
      id: match[1],
      href: url.href,
      pathname: url.pathname
    };
  }

  function normalizeText(value) {
    return String(value || "").replace(/\s+/g, " ").trim();
  }

  function conversationTitle(anchor) {
    if (!anchor) {
      return "Untitled chat";
    }

    const title = normalizeText(
      anchor.getAttribute && (anchor.getAttribute("aria-label") || anchor.getAttribute("title"))
    ) || normalizeText(anchor.textContent);

    return title || "Untitled chat";
  }

  function exactText(element, expected) {
    return normalizeText(element && element.textContent).toLocaleLowerCase() ===
      normalizeText(expected).toLocaleLowerCase();
  }

  function exactTextAny(element, expectedValues) {
    return Array.isArray(expectedValues) &&
      expectedValues.some((expected) => exactText(element, expected));
  }

  return {
    conversationTitle,
    exactText,
    exactTextAny,
    normalizeText,
    parseConversationHref
  };
});
