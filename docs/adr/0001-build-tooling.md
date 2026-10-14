# ADR-0001: Build tooling

- **Status:** Accepted
- **Date:** 2026-10-13

## Context

Lemma is a Manifest V3 Chrome extension with a side panel, an isolated-world content script, a MAIN-world content script (Phase 1), a background service worker, and later a Web Worker for parsing. We want TypeScript in strict mode, React for the panel, fast unit tests on a pure core, browser tests against a mock page, and reproducible CI.

Verified on 2026-10-13:

- `wxt@0.21.4` (npm, published 2026-08-11). It is pre-1.0, MIT-licensed and actively maintained. It supports a `sidepanel` entrypoint (generates `side_panel.default_path`), MAIN-world content scripts (`world: 'MAIN'`) and a Vitest plugin (`wxt/testing/vitest-plugin`).
- WXT's docs recommend `injectScript()` (a `<script src="chrome-extension://…">` tag) over `world: 'MAIN'`. Overleaf serves `script-src 'nonce-…' 'strict-dynamic'`, which blocks a script tag without the nonce. A manifest-registered MAIN-world script is not subject to the page CSP.
- `typescript-eslint@8.71` supports TypeScript `>=4.8.4 <6.1.0`, so TypeScript 7 cannot be used yet.

## Decision

- **WXT** with Vite 8, **React 19** via `@wxt-dev/module-react`, and **TypeScript 6.0** in `strict` mode with `noUncheckedIndexedAccess` and `exactOptionalPropertyTypes`.
- WXT auto-imports are **off** (`imports: false`): every dependency is an explicit import, so layering is visible and lintable.
- MAIN-world code is a manifest content script with `world: 'MAIN'`, not `injectScript()`. Chrome is the only target.
- **Vitest** for unit tests, **Playwright** for end-to-end tests that load the built extension into Chromium. Tests never touch live Overleaf: they intercept Overleaf URLs and serve stub pages.
- **npm** with a committed lockfile and exact versions. **ESLint** (flat config, `strictTypeChecked`) and **Prettier**.
- Layering is enforced by ESLint, not by convention:
  - Everywhere in `src/` and `entrypoints/`: `fetch`, `XMLHttpRequest`, `WebSocket`, `EventSource`, `WebTransport` and `navigator.sendBeacon` are banned.
  - `src/core/**` may not use `window`, `document`, `navigator`, `location`, storage APIs, `chrome`, `browser` or `LanguageModel`, and may not import adapters, UI, entrypoints, WXT or React.
  - `src/core/fixes/**` additionally may not import the LLM port (ADR-0003).

## Alternatives considered

- **Vite + CRXJS:** a thinner abstraction, but its maintenance status was not verified and it offers no test helpers.
- **Plain Vite with a hand-written manifest:** more glue to maintain and no dev reload for extension pages.
- **Plasmo:** heavier and more opinionated; we do not need its messaging or storage abstractions.
- **pnpm:** fine, but not installed on the primary dev machine; npm avoids a global install.

## Permissions

`sidePanel`, `storage`, and the host permission `https://*.overleaf.com/*`, which the side panel needs to read which Overleaf project a tab shows. Nothing else. (Added during Phases 1–5; Phase 0 had only `sidePanel`.)

## Consequences

- WXT is pre-1.0, so versions are pinned exactly and upgraded deliberately with the e2e suite as a gate.
- File-based entrypoints keep the shell thin; the manifest and its permissions live in one file (`wxt.config.ts`).
- The strict extension-page CSP is applied to production builds only, because `wxt dev` needs to reach its local dev server. The e2e suite runs against the production build.
