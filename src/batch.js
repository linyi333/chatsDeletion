(function initBatchStore(root) {
  "use strict";

  const namespace = root.ChatBulkDelete;

  class PendingBatchStore {
    constructor() {
      this.localHarnessState = null;
    }

    request(action, details = {}) {
      if (root.location.protocol === "file:") {
        if (action === "get") return Promise.resolve(this.localHarnessState);
        if (action === "start") {
          this.localHarnessState = {
            version: 1,
            phase: "ready",
            currentId: null,
            remaining: details.items
          };
          return Promise.resolve(this.localHarnessState);
        }
        if (action === "confirming" && this.localHarnessState) {
          this.localHarnessState.phase = "confirming";
          this.localHarnessState.currentId = details.id;
          return Promise.resolve(this.localHarnessState);
        }
        if (action === "completed" && this.localHarnessState) {
          this.localHarnessState.remaining = this.localHarnessState.remaining
            .filter((item) => item.id !== details.id);
          this.localHarnessState.phase = "ready";
          this.localHarnessState.currentId = null;
          if (!this.localHarnessState.remaining.length) this.localHarnessState = null;
          return Promise.resolve(this.localHarnessState);
        }
        if (action === "clear") {
          this.localHarnessState = null;
          return Promise.resolve(null);
        }
      }

      return new Promise((resolve, reject) => {
        chrome.runtime.sendMessage(
          { channel: "cbd-batch", action, ...details },
          (response) => {
            if (chrome.runtime.lastError) {
              reject(new Error(chrome.runtime.lastError.message));
              return;
            }
            if (!response || !response.ok) {
              reject(new Error(response && response.error
                ? response.error
                : "The extension could not preserve the confirmed batch."));
              return;
            }
            resolve(response.state || null);
          }
        );
      });
    }

    get() {
      return this.request("get");
    }

    start(items) {
      return this.request("start", { items });
    }

    markConfirming(id) {
      return this.request("confirming", { id });
    }

    markCompleted(id) {
      return this.request("completed", { id });
    }

    clear() {
      return this.request("clear");
    }
  }

  namespace.PendingBatchStore = PendingBatchStore;
})(globalThis);
