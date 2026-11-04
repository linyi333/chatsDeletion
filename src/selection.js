(function initSelection(root) {
  "use strict";

  const namespace = root.ChatBulkDelete;
  const { core, dom } = namespace;

  class SelectionController {
    constructor(onChange) {
      this.onChange = onChange;
      this.selected = new Map();
      this.mode = false;
      this.scanTimer = null;
      this.observer = new MutationObserver(() => this.scheduleScan());
    }

    start() {
      this.observer.observe(document.body, { childList: true, subtree: true });
      this.scan();
    }

    setMode(enabled) {
      this.mode = Boolean(enabled);
      document.documentElement.classList.toggle("cbd-selection-mode", this.mode);
      if (!this.mode) {
        this.clear();
      }
      this.scan();
    }

    scheduleScan() {
      root.clearTimeout(this.scanTimer);
      this.scanTimer = root.setTimeout(() => this.scan(), 80);
    }

    scan() {
      const loadedIds = new Set();

      for (const anchor of dom.conversationLinks()) {
        const ref = core.parseConversationHref(anchor.href);
        const row = dom.findConversationRow(anchor);
        if (!ref || !row) {
          continue;
        }

        loadedIds.add(ref.id);

        row.classList.add("cbd-conversation-row");
        row.dataset.cbdConversationId = ref.id;

        let checkbox = row.querySelector(`.cbd-chat-checkbox[data-cbd-id="${ref.id}"]`);
        if (!checkbox) {
          checkbox = this.createCheckbox(ref.id, core.conversationTitle(anchor));
          row.insertBefore(checkbox, row.firstChild);
        }

        const input = checkbox.querySelector("input");
        input.checked = this.selected.has(ref.id);
        row.classList.toggle("cbd-row-selected", input.checked);
      }

      // ChatGPT frequently replaces sidebar rows after a deletion or route
      // change. Never retain an item that is no longer in the loaded sidebar:
      // a stale first item would otherwise block all later deletion attempts.
      let changed = false;
      for (const id of this.selected.keys()) {
        if (!loadedIds.has(id)) {
          this.selected.delete(id);
          changed = true;
        }
      }

      if (changed) {
        this.notify();
      }
    }

    createCheckbox(id, title) {
      const label = document.createElement("label");
      label.className = "cbd-chat-checkbox";
      label.dataset.cbdId = id;
      label.title = `Select ${title}`;

      const input = document.createElement("input");
      input.type = "checkbox";
      input.setAttribute("aria-label", `Select chat: ${title}`);
      input.addEventListener("change", (event) => {
        event.stopPropagation();
        const anchor = dom.findConversationLink(id);
        if (!anchor) {
          input.checked = false;
          return;
        }

        if (input.checked) {
          this.selected.set(id, {
            id,
            href: anchor.href,
            title: core.conversationTitle(anchor)
          });
        } else {
          this.selected.delete(id);
        }

        const row = dom.findConversationRow(anchor);
        if (row) {
          row.classList.toggle("cbd-row-selected", input.checked);
        }
        this.notify();
      });

      // ChatGPT attaches pointer/click handlers to the whole conversation row.
      // Own the complete checkbox hit area so a click cannot open the chat or
      // be swallowed by the row before the checkbox state changes.
      const stopRowInteraction = (event) => event.stopPropagation();
      label.addEventListener("pointerdown", stopRowInteraction);
      label.addEventListener("mousedown", stopRowInteraction);
      label.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        input.checked = !input.checked;
        input.dispatchEvent(new Event("change"));
      });

      const mark = document.createElement("span");
      mark.setAttribute("aria-hidden", "true");
      label.append(input, mark);
      return label;
    }

    selectAllLoaded() {
      for (const anchor of dom.conversationLinks()) {
        const ref = core.parseConversationHref(anchor.href);
        if (!ref || !dom.isVisible(anchor)) {
          continue;
        }
        this.selected.set(ref.id, {
          id: ref.id,
          href: anchor.href,
          title: core.conversationTitle(anchor)
        });
      }
      this.scan();
      this.notify();
    }

    restore(items) {
      this.selected.clear();
      for (const item of items) {
        this.selected.set(item.id, item);
      }
      this.scan();
      this.notify();
    }

    clear() {
      this.selected.clear();
      document.querySelectorAll(".cbd-chat-checkbox input").forEach((input) => {
        input.checked = false;
      });
      document.querySelectorAll(".cbd-row-selected").forEach((row) => {
        row.classList.remove("cbd-row-selected");
      });
      this.notify();
    }

    remove(id) {
      if (this.selected.delete(id)) {
        this.notify();
      }
    }

    items() {
      return Array.from(this.selected.values());
    }

    notify() {
      if (this.onChange) {
        this.onChange(this.items());
      }
    }
  }

  namespace.SelectionController = SelectionController;
})(globalThis);
