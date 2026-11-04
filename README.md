# ChatGPT Bulk Delete

A small, dependency-free Chrome Manifest V3 extension that adds conversation
multi-selection to the ChatGPT web sidebar. It deletes the confirmed selection
sequentially through ChatGPT's visible actions menu and confirmation dialog.

Current version: **0.1.9**

> Deletion is permanent. Test with disposable conversations before using the
> extension on anything important.

## Tested scope

This project currently has a deliberately narrow support boundary:

- **Browser:** Google Chrome desktop, loaded as an unpacked Manifest V3
  extension.
- **Website:** ChatGPT web at `https://chatgpt.com/`.
- **Language:** the English destructive controls **Delete** and **Delete chat**.
- **Workflow:** conversations already loaded in ChatGPT's visible sidebar.

It has **not** been tested or claimed to work with:

- Firefox, Safari, Edge, Brave, or other Chromium-based browsers;
- the ChatGPT desktop or mobile applications;
- Claude, Gemini, Grok, Copilot, or any other chat product;
- non-English ChatGPT deletion controls; or
- conversations that have not been loaded into the sidebar.

The current automated suite contains 14 local tests. The basic multi-select,
typed batch confirmation, per-conversation ChatGPT confirmation, sequential
deletion, and current **Delete chat** label have also been exercised manually in
Chrome. Browser and ChatGPT UI updates require retesting because this extension
depends on the visible page structure.

## Why this approach

ChatGPT currently provides a visible per-conversation flow:

1. open the conversation's actions menu;
2. choose **Delete**; and
3. confirm **Delete chat**.

This extension repeats that complete interaction for each selected conversation.
It does not call undocumented private APIs, copy credentials, remove DOM nodes
as a substitute for server deletion, or send conversation data to another
service.

The tradeoff is that ChatGPT can change its DOM or labels without notice. The
extension is designed to stop rather than guess when the expected flow changes.
See [DESIGN.md](DESIGN.md) for the state machine and safety invariants.

## Features

- Checkboxes aligned with ChatGPT conversation rows.
- A toolbar-launched control panel that stays hidden until requested.
- Individual selection and **Select loaded**.
- Review list plus an exact typed `DELETE` confirmation.
- One-at-a-time deletion; never parallel deletion.
- Exact matching for ChatGPT's **Delete** menu item and **Delete chat** dialog
  button, with support for the earlier exact **Delete** button label.
- Fresh row and actions-button discovery for every conversation.
- Verified menu/dialog readiness instead of relying on a fixed delay.
- Safe retries for non-destructive menu-opening steps.
- At-most-once clicking of each final destructive confirmation.
- The currently open conversation is processed last.
- Recovery of an already-confirmed batch if ChatGPT refreshes the page.
- Progress stages and stop-on-uncertainty errors.

## Install locally

1. Download or clone this repository.
2. Open `chrome://extensions` in Chrome.
3. Enable **Developer mode**.
4. Select **Load unpacked** and choose this repository folder.
5. Open or refresh `https://chatgpt.com/`.
6. Pin **ChatGPT Bulk Delete** from Chrome's Extensions menu if you want its
   button to remain visible in the toolbar.

Select the extension's toolbar button to show or hide the control panel. The
panel displays its version beside **Bulk delete**; confirm that it shows
**v0.1.9** after updating the extension.

## Use

1. Make sure the conversations you want are loaded in the ChatGPT sidebar.
2. Select **ChatGPT Bulk Delete** in Chrome's extension toolbar.
3. Select **Select chats** in the extension panel.
4. Choose individual conversations or select all currently loaded rows.
5. Select **Delete selected**.
6. Review the titles, type `DELETE`, and confirm the batch.
7. Keep the tab open while the extension processes the conversations.

The panel is hidden by default. Select the toolbar button again to hide it, or
use **Exit selection** to clear the selection and close the panel. A confirmed
batch that survives a ChatGPT refresh reopens the panel so progress and errors
remain visible.

The extension automatically handles ChatGPT's separate confirmation for every
conversation. Do not manually click ChatGPT's confirmation while a batch is
running.

## Safety behavior

The final ChatGPT confirmation is clicked only after all of these checks pass:

- the selected conversation still has the expected `/c/<conversation-id>` link;
- its row-specific actions control can be found;
- an exact, visible **Delete** menu item appears;
- a visible delete dialog appears; and
- its button exactly matches **Delete chat** or the legacy **Delete** label.

After confirmation, the extension waits for both the conversation link and the
destructive dialog/menu to disappear. It then begins a fresh interaction cycle
for the next conversation.

ChatGPT may ignore menu interactions while synchronizing a previous deletion.
Opening the menu and choosing its Delete item are safe to retry because the
separate ChatGPT confirmation is still required. The extension never retries an
ambiguous final confirmation.

## Refresh recovery

Deleting a conversation can cause ChatGPT to refresh or reinitialize the page,
which destroys the current content script. Before clicking a final confirmation,
the extension records the current conversation ID and remaining confirmed queue
in Chrome's extension-isolated session storage.

After a refresh, it waits for the sidebar to load, verifies that the previously
confirmed ID is absent, and starts a new visible-UI deletion cycle for the next
ID. Pending state expires after five minutes and is cleared on completion,
handled failure, or tab close.

## Testing without real chats

The automated suite uses local fixtures only and makes no network requests:

```sh
npm test
npm run check
```

For a browser-level simulation, open
[`tests/manual-harness.html`](tests/manual-harness.html) directly in Chrome. It
loads the production scripts against three fake conversation rows. Deleting them
changes only that local file's page.

Do not use valuable conversations as test data. Completing the extension's
typed confirmation on `chatgpt.com` intentionally begins permanent deletion.

## Permissions and privacy

The extension requests only:

- access to `https://chatgpt.com/*`, so its content script can read and operate
  the visible sidebar controls; and
- Chrome's `storage` permission, used only for the short-lived, tab-scoped queue
  that allows an already-confirmed batch to survive a ChatGPT refresh.

There are no direct network requests, analytics, third-party services, or
private ChatGPT endpoint calls. The pending queue never leaves the browser.

## Limitations

- Support is currently limited to the tested Chrome desktop and ChatGPT web
  environment described above. Other browsers and chat services are out of
  scope for this version.
- Only conversations currently loaded in the sidebar can be selected. The
  extension does not fetch or scroll through older history.
- Version 0.1.9 supports the English destructive-control labels described above.
- ChatGPT DOM, label, rate-limit, or account-policy changes can stop a batch.
- Closing the tab or browser stops the batch and clears its tab-scoped state.
- The extension cannot restore a deleted conversation.
- This is an unpacked development extension, not a Chrome Web Store release.

[Official OpenAI documentation](https://learn.chatgpt.com/docs/enterprise/chatgpt-work-overview)
notes that deleting a ChatGPT Work conversation removes it from view and
schedules deletion subject to the documented retention exceptions. Files stored
separately in Library follow separate rules.

## Project status and license

This is a personal experimental project shared publicly so others can inspect
the approach, testing, changes, and known limitations. It is not an official
OpenAI product and is not affiliated with or endorsed by OpenAI.

No open-source license is currently provided. The repository is published for
transparency and personal-project reference, without a support commitment or
warranty. Users are responsible for testing with disposable conversations and
for the consequences of permanently deleting their own data.

## Project structure

```text
manifest.json         Manifest V3 entry point
src/background.js     confirmed-queue persistence across page refreshes
src/batch.js          content-script interface to temporary batch state
src/config.js         selectors, labels, and timeouts
src/core.js           pure URL and text helpers
src/deletion.js       sequential deletion state machine
src/dom.js            narrowly scoped ChatGPT DOM adapter
src/main.js           composition and refresh recovery
src/selection.js      checkbox injection and selection state
src/styles.css        isolated cbd-* styles
src/ui.js             controls, confirmation, progress, and errors
tests/                dependency-free automated tests and fake UI harness
DESIGN.md             architecture, state transitions, and safety invariants
```
