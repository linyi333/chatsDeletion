"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const core = require("../src/core.js");

test("parses a normal ChatGPT conversation URL", () => {
  assert.deepEqual(
    core.parseConversationHref("https://chatgpt.com/c/12345678-abcd-4abc-9abc-1234567890ab"),
    {
      id: "12345678-abcd-4abc-9abc-1234567890ab",
      href: "https://chatgpt.com/c/12345678-abcd-4abc-9abc-1234567890ab",
      pathname: "/c/12345678-abcd-4abc-9abc-1234567890ab"
    }
  );
});

test("parses a project conversation URL", () => {
  const parsed = core.parseConversationHref(
    "/g/g-p-project-id/c/12345678-abcd-4abc-9abc-1234567890ab"
  );
  assert.equal(parsed.id, "12345678-abcd-4abc-9abc-1234567890ab");
});

test("rejects non-conversation and non-ChatGPT URLs", () => {
  assert.equal(core.parseConversationHref("https://chatgpt.com/"), null);
  assert.equal(core.parseConversationHref("https://example.com/c/12345678-abcd"), null);
  assert.equal(core.parseConversationHref("javascript:alert(1)"), null);
});

test("normalizes whitespace and matches exact visible labels", () => {
  assert.equal(core.normalizeText("  Delete\n  chat "), "Delete chat");
  assert.equal(core.exactText({ textContent: " Delete " }, "delete"), true);
  assert.equal(core.exactText({ textContent: "Delete all" }, "delete"), false);
  assert.equal(
    core.exactTextAny({ textContent: "Delete chat" }, ["Delete chat", "Delete"]),
    true
  );
  assert.equal(
    core.exactTextAny({ textContent: "Delete all chats" }, ["Delete chat", "Delete"]),
    false
  );
});

test("extracts a useful conversation title", () => {
  const anchor = {
    getAttribute(name) {
      return name === "aria-label" ? "  Example   chat " : "";
    },
    textContent: "Fallback"
  };
  assert.equal(core.conversationTitle(anchor), "Example chat");
});
