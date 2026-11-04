"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

function loadRunner(overrides = {}) {
  globalThis.ChatBulkDelete = {
    config: overrides.config || { timeouts: {} },
    dom: overrides.dom || {}
  };
  const path = require.resolve("../src/deletion.js");
  delete require.cache[path];
  require(path);
  return globalThis.ChatBulkDelete.BulkDeleteRunner;
}

test("runs deletions sequentially and reports completion", async () => {
  const BulkDeleteRunner = loadRunner();
  const calls = [];
  const completed = [];
  const runner = new BulkDeleteRunner({
    onDeleted: (item) => completed.push(item.id)
  });

  runner.deleteOne = async (item) => {
    calls.push(`start:${item.id}`);
    await Promise.resolve();
    calls.push(`end:${item.id}`);
  };

  const result = await runner.run([{ id: "a" }, { id: "b" }]);
  assert.deepEqual(calls, ["start:a", "end:a", "start:b", "end:b"]);
  assert.deepEqual(completed, ["a", "b"]);
  assert.deepEqual(result, { deleted: 2, skipped: 0, total: 2, error: null });
});

test("stops on the first failure and does not attempt later chats", async () => {
  const BulkDeleteRunner = loadRunner();
  const calls = [];
  const runner = new BulkDeleteRunner({});

  runner.deleteOne = async (item) => {
    calls.push(item.id);
    if (item.id === "b") {
      throw new Error("simulated failure");
    }
  };

  const result = await runner.run([{ id: "a" }, { id: "b" }, { id: "c" }]);
  assert.deepEqual(calls, ["a", "b"]);
  assert.equal(result.deleted, 1);
  assert.equal(result.skipped, 0);
  assert.equal(result.total, 3);
  assert.match(result.error.message, /simulated failure/);
});

test("skips a chat that is already absent and continues with later chats", async () => {
  const BulkDeleteRunner = loadRunner();
  const calls = [];
  const completed = [];
  const runner = new BulkDeleteRunner({
    onDeleted: (item) => completed.push(item.id)
  });

  runner.deleteOne = async (item) => {
    calls.push(item.id);
    return item.id === "stale" ? "absent" : "deleted";
  };

  const result = await runner.run([
    { id: "stale", title: "Already gone" },
    { id: "current", title: "Current selection" }
  ]);

  assert.deepEqual(calls, ["stale", "current"]);
  assert.deepEqual(completed, ["stale", "current"]);
  assert.deepEqual(result, { deleted: 1, skipped: 1, total: 2, error: null });
});

test("waits for ChatGPT's confirmation UI to close before completing an item", async () => {
  const anchor = { id: "anchor" };
  const row = { scrollIntoView() {} };
  const actionButton = { id: "actions" };
  const menuItem = { id: "menu-delete" };
  const dialog = { id: "dialog" };
  const confirmButton = { disabled: false, click() {} };
  const waits = [];
  let stage = "idle";

  const dom = {
    findDeleteMenuItem: () => stage === "menu" ? menuItem : null,
    findDeleteDialog: () => stage === "dialog" ? dialog : null,
    findConversationLink: () => stage === "removed" || stage === "settled" ? null : anchor,
    findConversationRow: () => row,
    findActionButton: () => actionButton,
    findDialogDeleteButton: () => confirmButton,
    revealConversationRow() {},
    delay: async () => {},
    activateControl: (control) => {
      stage = control === actionButton ? "menu" : "dialog";
    },
    waitForOptional: async (predicate) => predicate(),
    waitFor: async (predicate, _timeout, description) => {
      waits.push(description);
      if (description.includes("Delete menu item")) return menuItem;
      if (description.includes("delete confirmation")) return dialog;
      if (description.includes("remove")) {
        stage = "removed";
        return true;
      }
      if (description.includes("to close")) {
        stage = "settled";
        assert.equal(predicate(), true);
        return true;
      }
      throw new Error(`Unexpected wait: ${description}`);
    }
  };

  const BulkDeleteRunner = loadRunner({
    dom,
    config: {
      timeouts: {
        deletion: 1,
        settle: 1,
        reveal: 0,
        readiness: 1000,
        menuAttempt: 1,
        dialogAttempt: 1,
        retry: 0
      }
    }
  });
  const runner = new BulkDeleteRunner({});

  const outcome = await runner.deleteOne({ id: "a", title: "Disposable chat" });

  assert.equal(outcome, "deleted");
  assert.equal(waits.length, 2);
  assert.match(waits[1], /to close/);
});

test("retries a swallowed menu trigger until a fresh Delete menu opens", async () => {
  const anchor = { id: "anchor" };
  const row = { scrollIntoView() {} };
  const actionButton = { id: "actions" };
  const menuItem = { id: "menu-delete" };
  const dialog = { id: "dialog" };
  let stage = "idle";
  let menuAttempts = 0;

  const dom = {
    findDeleteMenuItem: () => stage === "menu" ? menuItem : null,
    findDeleteDialog: () => stage === "dialog" ? dialog : null,
    findConversationLink: () => anchor,
    findConversationRow: () => row,
    findActionButton: () => actionButton,
    revealConversationRow() {},
    delay: async () => {},
    activateControl: (control) => {
      if (control === actionButton) {
        menuAttempts += 1;
        stage = menuAttempts >= 2 ? "menu" : "idle";
      } else if (control === menuItem) {
        stage = "dialog";
      }
    },
    waitForOptional: async (predicate) => predicate()
  };

  const BulkDeleteRunner = loadRunner({
    dom,
    config: {
      timeouts: {
        reveal: 0,
        readiness: 1000,
        menuAttempt: 1,
        dialogAttempt: 1,
        retry: 0
      }
    }
  });
  const runner = new BulkDeleteRunner({});

  const result = await runner.openDeleteDialog(
    { id: "a", title: "Disposable chat" },
    () => {}
  );

  assert.equal(result, dialog);
  assert.equal(menuAttempts, 2);
});

test("deletes the currently open conversation last", async () => {
  const BulkDeleteRunner = loadRunner({
    dom: {
      currentConversationId: () => "active",
      delay: async () => {}
    },
    config: { timeouts: {} }
  });
  const order = [];
  const runner = new BulkDeleteRunner({});
  runner.deleteOne = async (item) => {
    order.push(item.id);
    return "deleted";
  };

  const result = await runner.run([
    { id: "active", title: "Open chat" },
    { id: "other-1", title: "Other one" },
    { id: "other-2", title: "Other two" }
  ]);

  assert.deepEqual(order, ["other-1", "other-2", "active"]);
  assert.equal(result.deleted, 3);
});
