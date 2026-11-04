(function initDom(root) {
  "use strict";

  const namespace = root.ChatBulkDelete;
  const { core, config } = namespace;

  function isVisible(element) {
    if (!element || !element.isConnected) {
      return false;
    }

    const style = root.getComputedStyle(element);
    if (style.display === "none" || style.visibility === "hidden") {
      return false;
    }

    return element.getClientRects().length > 0;
  }

  function waitFor(predicate, timeoutMs, description) {
    const startedAt = Date.now();

    return new Promise((resolve, reject) => {
      const check = () => {
        let value;
        try {
          value = predicate();
        } catch (error) {
          reject(error);
          return;
        }

        if (value) {
          resolve(value);
          return;
        }

        if (Date.now() - startedAt >= timeoutMs) {
          reject(new Error(`Timed out waiting for ${description}.`));
          return;
        }

        root.setTimeout(check, config.timeouts.poll);
      };

      check();
    });
  }

  function waitForOptional(predicate, timeoutMs) {
    const startedAt = Date.now();

    return new Promise((resolve, reject) => {
      const check = () => {
        let value;
        try {
          value = predicate();
        } catch (error) {
          reject(error);
          return;
        }

        if (value) {
          resolve(value);
          return;
        }

        if (Date.now() - startedAt >= timeoutMs) {
          resolve(null);
          return;
        }

        root.setTimeout(check, config.timeouts.poll);
      };

      check();
    });
  }

  function conversationLinks(scope = document) {
    return Array.from(scope.querySelectorAll(config.selectors.conversationLink))
      .filter((anchor) => core.parseConversationHref(anchor.href));
  }

  function findConversationLink(id) {
    return conversationLinks().find((anchor) => {
      const parsed = core.parseConversationHref(anchor.href);
      return parsed && parsed.id === id;
    }) || null;
  }

  function findActionButton(row) {
    if (!row) {
      return null;
    }

    return Array.from(row.querySelectorAll(config.selectors.actionButton))
      .find((button) => !button.disabled) || null;
  }

  function currentConversationId() {
    const parsed = core.parseConversationHref(root.location.href);
    return parsed ? parsed.id : null;
  }

  function findConversationRow(anchor) {
    if (!anchor) {
      return null;
    }

    let candidate = anchor.parentElement;
    let fallback = candidate;

    for (let depth = 0; candidate && depth < 7; depth += 1) {
      if (candidate.matches("nav, aside, body, html")) {
        break;
      }

      const links = conversationLinks(candidate);
      if (links.length === 1) {
        fallback = candidate;
        if (findActionButton(candidate)) {
          return candidate;
        }
      }

      candidate = candidate.parentElement;
    }

    return fallback;
  }

  function visibleExactMatch(scope, selector, text) {
    return Array.from(scope.querySelectorAll(selector))
      .find((element) => isVisible(element) && core.exactText(element, text)) || null;
  }

  function exactTextDescendant(scope, text) {
    return Array.from(scope.querySelectorAll("*"))
      .find((element) => isVisible(element) && core.exactText(element, text)) || null;
  }

  function activateControl(element) {
    if (!element) {
      return;
    }

    const mouse = { bubbles: true, cancelable: true, composed: true, button: 0 };
    const pointer = {
      ...mouse,
      pointerId: 1,
      pointerType: "mouse",
      isPrimary: true
    };

    // Current ChatGPT popup triggers respond to pointer events; HTMLElement.click()
    // alone does not always open them. Dispatch the same ordered event family a
    // normal primary-button interaction produces.
    element.dispatchEvent(new PointerEvent("pointerdown", pointer));
    element.dispatchEvent(new MouseEvent("mousedown", mouse));
    element.dispatchEvent(new PointerEvent("pointerup", pointer));
    element.dispatchEvent(new MouseEvent("mouseup", mouse));
    element.dispatchEvent(new MouseEvent("click", mouse));
  }

  function revealConversationRow(row) {
    if (!row) {
      return;
    }

    const mouse = { bubbles: true, cancelable: true, composed: true };
    const pointer = {
      ...mouse,
      pointerId: 1,
      pointerType: "mouse",
      isPrimary: true
    };

    // ChatGPT may mount or enable the actions button only after the row is
    // hovered. React's delegated enter/hover handling observes these bubbling
    // events, matching the preparation a real mouse interaction provides.
    row.dispatchEvent(new PointerEvent("pointerover", pointer));
    row.dispatchEvent(new MouseEvent("mouseover", mouse));
    row.dispatchEvent(new PointerEvent("pointermove", pointer));
    row.dispatchEvent(new MouseEvent("mousemove", mouse));
  }

  function delay(milliseconds) {
    return new Promise((resolve) => root.setTimeout(resolve, milliseconds));
  }

  function findDeleteMenuItem() {
    const menus = Array.from(document.querySelectorAll(config.selectors.openMenu)).filter(isVisible);
    for (const menu of menus) {
      const item = visibleExactMatch(menu, config.selectors.menuAction, config.labels.delete) ||
        exactTextDescendant(menu, config.labels.delete);
      if (item) {
        return item;
      }
    }
    return null;
  }

  function findDeleteDialog() {
    const dialogs = Array.from(document.querySelectorAll(config.selectors.dialog)).filter(isVisible);
    return dialogs.find((dialog) =>
      core.normalizeText(dialog.textContent).toLocaleLowerCase().includes("delete")
    ) || null;
  }

  function findDialogDeleteButton(dialog) {
    return Array.from(dialog.querySelectorAll(config.selectors.dialogButton))
      .find((element) =>
        isVisible(element) && core.exactTextAny(element, config.labels.dialogDelete)
      ) || null;
  }

  namespace.dom = {
    activateControl,
    conversationLinks,
    currentConversationId,
    delay,
    findActionButton,
    findConversationLink,
    findConversationRow,
    findDeleteDialog,
    findDeleteMenuItem,
    findDialogDeleteButton,
    isVisible,
    revealConversationRow,
    waitFor,
    waitForOptional
  };
})(globalThis);
