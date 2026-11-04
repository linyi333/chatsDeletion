(function initConfig(root) {
  "use strict";

  root.ChatBulkDelete = root.ChatBulkDelete || {};
  root.ChatBulkDelete.config = Object.freeze({
    selectors: {
      conversationLink: 'a[href*="/c/"]',
      actionButton: [
        'button[aria-label="Chat actions"]',
        'button[aria-label="Open conversation options"]',
        'button[aria-label*="conversation"][aria-haspopup="menu"]',
        'button[aria-label*="chat"][aria-haspopup="menu"]'
      ].join(","),
      openMenu: [
        '[role="menu"]',
        '[data-radix-menu-content]',
        '[data-radix-popper-content-wrapper]',
        '[data-headlessui-state~="open"][role="menu"]'
      ].join(","),
      menuAction: '[role="menuitem"], button, [role="button"], [tabindex]',
      dialog: '[role="dialog"]',
      dialogButton: 'button, [role="button"]'
    },
    labels: {
      delete: "Delete",
      dialogDelete: ["Delete chat", "Delete"]
    },
    timeouts: {
      menu: 4000,
      dialog: 5000,
      deletion: 30000,
      settle: 30000,
      reveal: 120,
      readiness: 30000,
      menuAttempt: 1200,
      dialogAttempt: 1500,
      retry: 350,
      poll: 100
    }
  });
})(globalThis);
