(function initExtension(root) {
  "use strict";

  const namespace = root.ChatBulkDelete;
  if (!namespace || document.getElementById("cbd-panel")) {
    return;
  }

  let selection;
  let ui;
  const batchStore = new namespace.PendingBatchStore();

  const runner = new namespace.BulkDeleteRunner({
    onDeleted: (item) => selection.remove(item.id),
    onProgress: (progress) => ui.showProgress(progress),
    batchStore
  });

  async function finishRun(items, options = {}) {
    ui.setBusy(true);
    const result = await runner.run(items, options);
    ui.setBusy(false);
    ui.setSelection(selection.items());
    ui.showResult(result);
  }

  async function resumePendingBatch() {
    let pending;
    try {
      pending = await batchStore.get();
    } catch (error) {
      ui.setStatus(`Could not check an interrupted batch. ${error.message}`, "error");
      return;
    }

    if (!pending || !pending.remaining.length) {
      return;
    }

    selection.setMode(true);
    ui.setMode(true);
    ui.setVisible(true);
    ui.setBusy(true);
    ui.setStatus("ChatGPT refreshed. Restoring the confirmed deletion batch…");

    try {
      // Wait for the refreshed ChatGPT sidebar to hydrate before deciding that
      // a conversation is absent. Otherwise an empty loading DOM looks exactly
      // like a completed deletion.
      await namespace.dom.waitFor(
        () => namespace.dom.conversationLinks().length > 0,
        namespace.config.timeouts.deletion,
        "the refreshed ChatGPT sidebar to load"
      );

      selection.restore(pending.remaining);

      if (pending.phase === "confirming") {
        const current = pending.remaining.find((item) => item.id === pending.currentId);
        if (!current) {
          throw new Error("The interrupted deletion state was incomplete.");
        }

        ui.setStatus(`Verifying the previous deletion: ${current.title}`);
        await namespace.dom.waitFor(
          () => !namespace.dom.findConversationLink(current.id),
          namespace.config.timeouts.deletion,
          `ChatGPT to finish removing “${current.title}” after refresh`
        );

        await batchStore.markCompleted(current.id);
        selection.remove(current.id);
        pending = await batchStore.get();
      }

      if (!pending || !pending.remaining.length) {
        ui.setBusy(false);
        ui.showResult({ deleted: 0, skipped: 1, total: 1, error: null });
        return;
      }

      selection.restore(pending.remaining);
      await finishRun(pending.remaining, { resume: true });
    } catch (error) {
      try {
        await batchStore.clear();
      } catch (_clearError) {
        // The original verification error is more useful to the user.
      }
      ui.setBusy(false);
      ui.setSelection(selection.items());
      ui.setStatus(`Stopped while restoring the batch. ${error.message}`, "error");
    }
  }

  selection = new namespace.SelectionController((items) => {
    if (!ui) {
      return;
    }

    ui.setSelection(items);
    if (!ui.busy) {
      ui.setStatus(
        items.length
          ? `${items.length} chat${items.length === 1 ? "" : "s"} selected.`
          : "Choose chats from the sidebar."
      );
    }
  });
  ui = new namespace.ExtensionUi({
    onToggle: (enabled) => {
      selection.setMode(enabled);
      ui.setMode(enabled);
      ui.setSelection(selection.items());
      if (!enabled) {
        ui.setVisible(false);
      }
    },
    onSelectAll: () => selection.selectAllLoaded(),
    onClear: () => selection.clear(),
    onDelete: async () => {
      const items = selection.items();
      if (!items.length || !(await ui.confirmDeletion(items))) {
        return;
      }

      await finishRun(items);
    }
  });

  ui.mount();
  selection.start();
  if (typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.onMessage) {
    chrome.runtime.onMessage.addListener((message) => {
      if (!message || message.channel !== "cbd-ui" || message.action !== "toggle") {
        return;
      }

      if (ui.visible) {
        selection.setMode(false);
        ui.setMode(false);
        ui.setVisible(false);
      } else {
        ui.setVisible(true);
        ui.setStatus("Select chats to begin.");
      }
    });
  }
  resumePendingBatch();
})(globalThis);
