"use strict";

const BATCH_PREFIX = "cbd-pending-batch:";
const BATCH_TTL_MS = 5 * 60 * 1000;

function storageKey(tabId) {
  return `${BATCH_PREFIX}${tabId}`;
}

function validItem(item) {
  return item &&
    typeof item.id === "string" &&
    typeof item.title === "string" &&
    typeof item.href === "string";
}

function validState(state) {
  return state &&
    state.version === 1 &&
    Number.isFinite(state.createdAt) &&
    Date.now() - state.createdAt <= BATCH_TTL_MS &&
    Array.isArray(state.remaining) &&
    state.remaining.every(validItem) &&
    (state.phase === "ready" || state.phase === "confirming");
}

async function readState(key) {
  const stored = await chrome.storage.session.get(key);
  const state = stored[key];
  if (!validState(state)) {
    await chrome.storage.session.remove(key);
    return null;
  }
  return state;
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const tabId = sender.tab && sender.tab.id;
  if (!Number.isInteger(tabId) || !message || message.channel !== "cbd-batch") {
    return false;
  }

  const key = storageKey(tabId);
  const handle = async () => {
    if (message.action === "get") {
      return readState(key);
    }

    if (message.action === "start") {
      const items = Array.isArray(message.items) ? message.items.filter(validItem) : [];
      if (!items.length) {
        await chrome.storage.session.remove(key);
        return null;
      }

      const now = Date.now();
      const state = {
        version: 1,
        createdAt: now,
        updatedAt: now,
        phase: "ready",
        currentId: null,
        remaining: items
      };
      await chrome.storage.session.set({ [key]: state });
      return state;
    }

    if (message.action === "confirming") {
      const state = await readState(key);
      if (!state || !state.remaining.some((item) => item.id === message.id)) {
        return null;
      }
      state.phase = "confirming";
      state.currentId = message.id;
      state.updatedAt = Date.now();
      await chrome.storage.session.set({ [key]: state });
      return state;
    }

    if (message.action === "completed") {
      const state = await readState(key);
      if (!state) {
        return null;
      }
      state.remaining = state.remaining.filter((item) => item.id !== message.id);
      state.phase = "ready";
      state.currentId = null;
      state.updatedAt = Date.now();
      if (!state.remaining.length) {
        await chrome.storage.session.remove(key);
        return null;
      }
      await chrome.storage.session.set({ [key]: state });
      return state;
    }

    if (message.action === "clear") {
      await chrome.storage.session.remove(key);
      return null;
    }

    throw new Error("Unknown batch action.");
  };

  handle().then(
    (state) => sendResponse({ ok: true, state }),
    (error) => sendResponse({ ok: false, error: error.message })
  );
  return true;
});

chrome.tabs.onRemoved.addListener((tabId) => {
  chrome.storage.session.remove(storageKey(tabId));
});
