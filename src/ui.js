(function initUi(root) {
  "use strict";

  const namespace = root.ChatBulkDelete;

  class ExtensionUi {
    constructor(handlers) {
      this.handlers = handlers;
      this.mode = false;
      this.busy = false;
      this.panel = null;
      this.count = null;
      this.status = null;
      this.deleteButton = null;
    }

    mount() {
      if (document.getElementById("cbd-panel")) {
        return;
      }

      const panel = document.createElement("aside");
      const version = typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.getManifest
        ? chrome.runtime.getManifest().version
        : "dev";
      panel.id = "cbd-panel";
      panel.setAttribute("aria-label", "ChatGPT bulk delete controls");
      panel.innerHTML = `
        <button class="cbd-primary" data-cbd-action="toggle">Select chats</button>
        <div class="cbd-controls" hidden>
          <div class="cbd-heading"><strong>Bulk delete <small>v${version}</small></strong><span data-cbd-count>0 selected</span></div>
          <div class="cbd-actions">
            <button data-cbd-action="all">Select loaded</button>
            <button data-cbd-action="clear">Clear</button>
          </div>
          <button class="cbd-danger" data-cbd-action="delete" disabled>Delete selected</button>
          <button data-cbd-action="exit">Exit selection</button>
          <p class="cbd-status" data-cbd-status aria-live="polite"></p>
        </div>`;

      panel.addEventListener("click", (event) => {
        const button = event.target.closest("button[data-cbd-action]");
        if (!button || this.busy) {
          return;
        }

        const action = button.dataset.cbdAction;
        if (action === "toggle") this.handlers.onToggle(true);
        if (action === "exit") this.handlers.onToggle(false);
        if (action === "all") this.handlers.onSelectAll();
        if (action === "clear") this.handlers.onClear();
        if (action === "delete") this.handlers.onDelete();
      });

      document.body.appendChild(panel);
      this.panel = panel;
      this.count = panel.querySelector("[data-cbd-count]");
      this.status = panel.querySelector("[data-cbd-status]");
      this.deleteButton = panel.querySelector('[data-cbd-action="delete"]');
    }

    setMode(enabled) {
      this.mode = enabled;
      this.panel.querySelector('[data-cbd-action="toggle"]').hidden = enabled;
      this.panel.querySelector(".cbd-controls").hidden = !enabled;
      if (enabled) {
        this.setStatus("Choose chats from the sidebar.");
      }
    }

    setSelection(items) {
      const size = items.length;
      this.count.textContent = `${size} selected`;
      this.deleteButton.disabled = this.busy || size === 0;
    }

    setBusy(busy) {
      this.busy = busy;
      this.panel.querySelectorAll("button").forEach((button) => {
        button.disabled = busy;
      });
    }

    setStatus(message, kind = "") {
      this.status.textContent = message;
      this.status.dataset.kind = kind;
    }

    showProgress({ current, total, item, stage }) {
      this.setStatus(`${current} of ${total} · ${stage}: ${item.title}`);
    }

    showResult(result) {
      if (result.error) {
        const completed = result.deleted + result.skipped;
        const detail = result.skipped
          ? ` ${result.skipped} selected chat${result.skipped === 1 ? " was" : "s were"} already absent.`
          : "";
        this.setStatus(
          `Stopped after ${completed} of ${result.total}. Deleted ${result.deleted}.${detail} ${result.error.message}`,
          "error"
        );
      } else if (result.skipped) {
        this.setStatus(
          `Finished. Deleted ${result.deleted}; ${result.skipped} selected chat${result.skipped === 1 ? " was" : "s were"} already absent.`,
          "success"
        );
      } else {
        this.setStatus(`Deleted ${result.deleted} chat${result.deleted === 1 ? "" : "s"}.`, "success");
      }
    }

    confirmDeletion(items) {
      return new Promise((resolve) => {
        const overlay = document.createElement("div");
        overlay.className = "cbd-modal-backdrop";
        const names = items.slice(0, 8).map((item) => `<li></li>`).join("");
        overlay.innerHTML = `
          <section class="cbd-modal" role="dialog" aria-modal="true" aria-labelledby="cbd-confirm-title">
            <h2 id="cbd-confirm-title">Permanently delete ${items.length} chat${items.length === 1 ? "" : "s"}?</h2>
            <p>ChatGPT deletions cannot be undone. The extension will use ChatGPT's own menu and confirmation, one chat at a time.</p>
            <ul>${names}</ul>
            ${items.length > 8 ? `<p>…and ${items.length - 8} more.</p>` : ""}
            <label>Type <strong>DELETE</strong> to continue
              <input data-cbd-confirm-input autocomplete="off" spellcheck="false">
            </label>
            <div class="cbd-modal-actions">
              <button data-cbd-cancel>Cancel</button>
              <button class="cbd-danger" data-cbd-confirm disabled>Delete ${items.length}</button>
            </div>
          </section>`;

        overlay.querySelectorAll("li").forEach((li, index) => {
          li.textContent = items[index].title;
        });

        const input = overlay.querySelector("[data-cbd-confirm-input]");
        const confirm = overlay.querySelector("[data-cbd-confirm]");
        const finish = (answer) => {
          overlay.remove();
          resolve(answer);
        };

        input.addEventListener("input", () => {
          confirm.disabled = input.value !== "DELETE";
        });
        input.addEventListener("keydown", (event) => {
          if (event.key === "Enter" && !confirm.disabled) finish(true);
          if (event.key === "Escape") finish(false);
        });
        overlay.querySelector("[data-cbd-cancel]").addEventListener("click", () => finish(false));
        confirm.addEventListener("click", () => finish(true));
        overlay.addEventListener("click", (event) => {
          if (event.target === overlay) finish(false);
        });

        document.body.appendChild(overlay);
        input.focus();
      });
    }
  }

  namespace.ExtensionUi = ExtensionUi;
})(globalThis);
