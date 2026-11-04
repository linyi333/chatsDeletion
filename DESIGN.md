# Design

## Goals

- Add multi-selection to the ChatGPT web sidebar.
- Delete only conversations the user explicitly selected and confirmed.
- Use ChatGPT's visible actions menu and confirmation dialog rather than
  undocumented private endpoints.
- Process one conversation at a time and stop when the outcome is uncertain.
- Keep the implementation dependency-free and easy to adapt when ChatGPT's UI
  changes.

## Non-goals

- Fetching conversations that ChatGPT has not loaded in the sidebar.
- Bypassing ChatGPT's per-conversation confirmation.
- Calling or reverse-engineering ChatGPT's private deletion APIs.
- Deleting conversations concurrently.

## Modules

| Module | Responsibility |
| --- | --- |
| `src/core.js` | Pure URL and text helpers. |
| `src/config.js` | Centralized selectors, labels, and timeouts. |
| `src/dom.js` | ChatGPT-specific DOM discovery and interaction. |
| `src/selection.js` | Checkbox injection and selected-item state. |
| `src/ui.js` | Floating controls, typed confirmation, and progress. |
| `src/deletion.js` | Sequential deletion state machine. |
| `src/batch.js` | Content-script interface to temporary batch state. |
| `src/background.js` | Tab-scoped batch persistence across page refreshes. |
| `src/main.js` | Composition and interrupted-batch recovery. |

## Deletion state machine

For every selected conversation:

1. Re-find the conversation by the stable ID in its `/c/<id>` link.
2. Re-find and reveal that row; never reuse a DOM element from a prior item.
3. Open the row's actions menu and verify an exact **Delete** item appeared.
4. Choose **Delete** and verify a visible ChatGPT delete dialog appeared.
5. Require an exact **Delete chat** or legacy **Delete** confirmation button.
6. Persist `phase: confirming` for the current conversation ID.
7. Click the final confirmation exactly once.
8. Wait until that conversation link and ChatGPT's destructive UI disappear.
9. Mark the ID complete, then start a fresh cycle for the next item.

Opening a menu and choosing its Delete item are non-destructive because
ChatGPT still requires its own confirmation. Those steps may retry for up to 30
seconds when ChatGPT is still synchronizing. The final confirmation is never
retried because its result may be ambiguous.

The currently open conversation is processed last so navigation away from it
cannot interrupt earlier items.

## Refresh recovery

ChatGPT can refresh or reinitialize the page after a confirmed deletion. A page
refresh destroys the content script and its in-memory loop, so the extension
stores only the already-confirmed queue in `chrome.storage.session`, keyed by
tab ID.

Before the final confirmation click, the service worker records the current ID
as `confirming`. After a refresh, the new content script:

1. waits for the sidebar to hydrate;
2. checks whether the confirming ID is absent;
3. never repeats the uncertain final confirmation;
4. removes the completed ID from the queue; and
5. begins a new visible-UI cycle for the next ID.

Pending state expires after five minutes and is cleared on completion, handled
failure, or tab close. The queue never leaves the browser.

## Safety invariants

- The user must type `DELETE` before a batch starts.
- Only exact destructive labels are accepted.
- The menu action is scoped to the selected conversation's row.
- Confirmations are sequential and clicked at most once per ID.
- An ambiguous destructive result stops the batch.
- No direct network requests or private ChatGPT endpoints are used.
- Only the `storage` extension permission is requested.

## Known fragility

ChatGPT does not expose a public selective bulk-delete API. This adapter depends
on the current DOM, English labels, and visible interaction flow. Selector or
label changes should fail closed, be reproduced in the fake harness, and receive
a regression test before the adapter is updated.
