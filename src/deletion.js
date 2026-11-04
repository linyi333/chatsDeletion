(function initDeletion(root) {
  "use strict";

  const namespace = root.ChatBulkDelete;
  const { config, dom } = namespace;

  class BulkDeleteRunner {
    constructor({ onDeleted, onProgress, batchStore }) {
      this.onDeleted = onDeleted;
      this.onProgress = onProgress;
      this.batchStore = batchStore || null;
      this.running = false;
    }

    async run(items, { resume = false } = {}) {
      if (this.running) {
        throw new Error("A deletion run is already in progress.");
      }

      this.running = true;
      let deleted = 0;
      let skipped = 0;
      const activeId = dom.currentConversationId ? dom.currentConversationId() : null;
      const queue = [...items].sort((left, right) =>
        Number(left.id === activeId) - Number(right.id === activeId)
      );

      try {
        if (this.batchStore && !resume) {
          await this.batchStore.start(queue);
        }

        for (let index = 0; index < queue.length; index += 1) {
          const item = queue[index];
          const progress = (stage) => this.report({
            current: index + 1,
            total: queue.length,
            item,
            deleted,
            skipped,
            stage
          });

          progress("Preparing conversation");
          const outcome = await this.deleteOne(item, progress);

          if (outcome === "absent") {
            skipped += 1;
            if (this.batchStore) {
              await this.batchStore.markCompleted(item.id);
            }
            if (this.onDeleted) {
              this.onDeleted(item);
            }
            continue;
          }

          deleted += 1;
          if (this.batchStore) {
            await this.batchStore.markCompleted(item.id);
          }
          if (this.onDeleted) {
            this.onDeleted(item);
          }
        }

        if (this.batchStore) {
          await this.batchStore.clear();
        }
        return { deleted, skipped, total: items.length, error: null };
      } catch (error) {
        if (this.batchStore) {
          try {
            await this.batchStore.clear();
          } catch (_clearError) {
            // Preserve the original deletion failure in the UI.
          }
        }
        return { deleted, skipped, total: items.length, error };
      } finally {
        this.running = false;
      }
    }

    async deleteOne(item, reportStage = () => {}) {
      if (dom.findDeleteMenuItem() || dom.findDeleteDialog()) {
        throw new Error("Close any open ChatGPT menu or dialog before starting deletion.");
      }

      const dialog = await this.openDeleteDialog(item, reportStage);
      if (!dialog) {
        return "absent";
      }

      const confirmButton = dom.findDialogDeleteButton(dialog);
      if (!confirmButton || confirmButton.disabled) {
        throw new Error(`ChatGPT's confirmation was not safe to use for “${item.title}”.`);
      }

      reportStage("Confirming in ChatGPT");
      if (this.batchStore) {
        await this.batchStore.markConfirming(item.id);
      }
      confirmButton.click();
      reportStage("Waiting for ChatGPT to finish");
      await dom.waitFor(
        () => !dom.findConversationLink(item.id),
        config.timeouts.deletion,
        `ChatGPT to remove “${item.title}” from the sidebar`
      );

      // ChatGPT can remove the sidebar row before its confirmation dialog has
      // finished closing. Starting the next item during that transition makes
      // the stale dialog intercept the next menu interaction, so wait for all
      // destructive UI from this item to be gone before continuing.
      await dom.waitFor(
        () => !dom.findDeleteDialog() && !dom.findDeleteMenuItem(),
        config.timeouts.settle,
        `ChatGPT's confirmation for “${item.title}” to close`
      );

      return "deleted";
    }

    async openDeleteDialog(item, reportStage) {
      const deadline = Date.now() + config.timeouts.readiness;
      let attempt = 0;

      while (Date.now() <= deadline) {
        const existingDialog = dom.findDeleteDialog();
        if (existingDialog) {
          return existingDialog;
        }

        let deleteMenuItem = dom.findDeleteMenuItem();
        if (!deleteMenuItem) {
          const anchor = dom.findConversationLink(item.id);
          if (!anchor) {
            // No destructive action is needed when the selected row is already
            // absent. This also clears stale selection state safely.
            return null;
          }

          const row = dom.findConversationRow(anchor);
          if (!row) {
            await dom.delay(config.timeouts.retry);
            continue;
          }

          row.scrollIntoView({ block: "nearest" });
          dom.revealConversationRow(row);
          await dom.delay(config.timeouts.reveal);

          const actionButton = dom.findActionButton(row);
          if (!actionButton) {
            await dom.delay(config.timeouts.retry);
            continue;
          }

          attempt += 1;
          reportStage(attempt === 1
            ? "Opening ChatGPT menu"
            : `Retrying ChatGPT menu (${attempt})`);
          dom.activateControl(actionButton);
          deleteMenuItem = await dom.waitForOptional(
            () => dom.findDeleteMenuItem(),
            config.timeouts.menuAttempt
          );

          if (!deleteMenuItem) {
            await dom.delay(config.timeouts.retry);
            continue;
          }
        }

        reportStage("Choosing Delete");
        dom.activateControl(deleteMenuItem);
        reportStage("Waiting for ChatGPT confirmation");

        const dialog = await dom.waitForOptional(
          () => dom.findDeleteDialog(),
          config.timeouts.dialogAttempt
        );
        if (dialog) {
          return dialog;
        }

        // Opening the menu and choosing Delete are non-destructive because
        // ChatGPT still requires its own confirmation. They can be retried when
        // React ignores an interaction while synchronizing the previous delete.
        await dom.delay(config.timeouts.retry);
      }

      throw new Error(
        `ChatGPT did not become ready to open a new delete confirmation for “${item.title}”.`
      );
    }

    report(progress) {
      if (this.onProgress) {
        this.onProgress(progress);
      }
    }
  }

  namespace.BulkDeleteRunner = BulkDeleteRunner;
})(globalThis);
