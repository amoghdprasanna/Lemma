# ADR-0002: Overleaf editor access

- **Status:** Accepted (implementation in Phase 1)
- **Date:** 2026-10-13

## Context

Overleaf's source editor is CodeMirror 6. CodeMirror renders only the visible viewport, so reading `.cm-content` from the DOM gives partial text. Edits must go through CodeMirror so they land in Overleaf's history and Overleaf's own undo reverses them.

Verified in the Overleaf source (`overleaf/overleaf` at commit `e039ad2`, 2026-09-17), file `services/web/frontend/js/features/source-editor/extensions/third-party-extensions.ts`:

- When the editor is created, Overleaf dispatches `window` `CustomEvent('UNSTABLE_editor:extensions', { detail: { CodeMirror, CodeMirrorVim, extensions } })`. Listeners push CodeMirror extensions into `extensions`, which Overleaf wraps in a `Compartment`.
- Dispatching `editor:extension-loaded` on `window` makes Overleaf fire the event again and reconfigure the compartment. Late injection therefore works.
- `detail.CodeMirror` (from `extensions/bundle.ts`) exports `ChangeSet, Decoration, EditorSelection, EditorView, Prec, StateEffect, StateField, ViewPlugin, WidgetType, hoverTooltip, keymap, syntaxTree, undo, redo, invertedEffects, isolateHistory`. Maintainers added the history exports on request in July 2025 (overleaf/overleaf#1380).
- Overleaf also dispatches `doc:after-opened` (`{ isNewDoc, docId }`), `doc:changed`, `doc:saved`, `project:metadata` and listens for `editor:gotoOffset`.
- The API's own help text says: "This API is **unsupported** and subject to change without warning."

Overleaf's page CSP (`script-src 'nonce-…' 'strict-dynamic'`, checked 2026-10-13) rules out injecting a `<script>` tag.

## Decision

1. A manifest content script in the **MAIN world** at `document_start` listens for `UNSTABLE_editor:extensions` and pushes a `ViewPlugin`. The plugin captures the live `EditorView` and reports document changes. If the editor already exists, the script dispatches `editor:extension-loaded` to make Overleaf fire the event again.
2. **Reads:** the full text is sent on attach and after typing pauses (debounced about 500 ms). Later this can become change deltas.
3. **Edits:** applied with `view.dispatch({ changes, annotations: isolateHistory.of('full'), userEvent: 'input.lemma' })`. One fix is one undo step in Overleaf. Each edit carries the document version it was computed against, and the MAIN script rejects stale edits.
4. **Protocol:** the MAIN and isolated worlds talk over `window.postMessage` using the versioned schema in `src/messaging/protocol.ts` (`{ ns: 'lemma', v, type, payload }`). Both sides validate every message and drop anything that fails. The MAIN world shares a JavaScript realm with the page, so it is treated as untrusted. It receives edits to apply and nothing else: no settings, no storage, no extension APIs.
5. **Resilience:** event names, selectors and URL patterns live in `src/adapters/overleaf/`. If no `EditorView` is captured within a few seconds of `doc:after-opened`, the adapter reports `unavailable` with a reason code, and the panel says "Can't read the Overleaf editor" instead of failing silently.
6. A generic CodeMirror 6 / `<textarea>` adapter implements the same `EditorPort`. The e2e mock page uses it and also fires the same `UNSTABLE_editor:extensions` contract.

## Alternatives considered

- **DOM scraping:** sees only the viewport, and edits would bypass CodeMirror's history.
- **The `.cm-content` element's internal `cmView` back-reference:** undocumented CodeMirror internals. Kept only as a diagnostic probe.
- **Overleaf Git bridge or API:** needs credentials and network requests, which violates ADR-0004.
- **`injectScript()` from the isolated world:** blocked by Overleaf's CSP.

## Consequences

- We depend on an API Overleaf calls unsupported. This is mitigated by isolating it in one adapter, detecting breakage, keeping an e2e mock that mirrors the contract, and Overleaf's record of responding to extension authors.
- Verified and implemented in Phase 1: the open file's name and id come from `window.overleaf.unstable.store` (`editor.open_doc_name`, `editor.open_doc_id`, watchable), which also exposes `editor.view` as a fallback when the extension event was missed. The raw compile log is read from `pre.log-entry-content-raw` once the user opens Overleaf's logs pane (`features/pdf-preview/components/pdf-log-entry-raw-content.tsx`); it is never fetched.
- Not yet verified on live Overleaf: Visual Editor mode (expected to be the same CodeMirror instance).
- All Overleaf names live in `src/adapters/overleaf/selectors.ts`; the e2e suite runs against a mock page (`tests/e2e/mock-overleaf/`) that implements the same contract with real CodeMirror 6.
