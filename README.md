# Lemma

A structure-first LaTeX assistant for Overleaf, aimed at physics and quantum-information papers. Lemma reads the document open in Overleaf and:

1. shows the paper's structure against the roles a paper needs (motivation, methods, results, …);
2. flags structural problems, LaTeX bugs and notation inconsistencies, each with a plain-language reason;
3. offers mechanical quick-fixes that you preview as a diff and apply with a click (Overleaf's undo reverses them);
4. links every suggestion to a short, sourced explanation of the convention behind it.

**Lemma never writes your paper.** It inserts empty skeletons and mechanical edits only ([ADR-0003](docs/adr/0003-no-content-generation.md)).

**Your document never leaves your browser.** No telemetry, no cloud AI, no network requests ([ADR-0004](docs/adr/0004-on-device-only-ai.md)).

> Status: **Phase 0 (foundations).** The side panel opens on Overleaf project pages but does not read the document yet.

## Install (development build)

Requirements: Node 22+ (24 recommended, see `.nvmrc`), Chrome 116+.

```sh
npm install
npm run build
```

Then in Chrome open `chrome://extensions`, enable **Developer mode**, click **Load unpacked**, and pick `.output/chrome-mv3`. Pin Lemma from the puzzle-piece menu so its mascot sits next to the address bar (extensions can't pin themselves). Open an Overleaf project: the mascot wakes up, and clicking it opens the side panel.

For live reloading during development, `npm run dev` launches a Chrome instance with the extension loaded.

## Scripts

| Command                 | What it does                                     |
| ----------------------- | ------------------------------------------------ |
| `npm run dev`           | Dev build with reload                            |
| `npm run build`         | Production build to `.output/chrome-mv3`         |
| `npm run check`         | Typecheck, lint, format check, unit tests        |
| `npm run test:coverage` | Unit tests with coverage thresholds              |
| `npm run test:e2e`      | Playwright tests against the build (build first) |

First time running e2e tests: `npx playwright install chromium`.

## Architecture

Hexagonal (ports and adapters) with a pure functional core. Everything in `src/core` is side-effect-free and tested without a browser; ESLint enforces the boundaries.

```
 Overleaf tab                                    Side panel (extension page)
┌──────────────────────────────┐                ┌────────────────────────────────────┐
│ MAIN world: CodeMirror 6 hook│                │ React UI: outline, diagnostics,    │
│ (UNSTABLE_editor:extensions) │                │ diff preview, cards, notation sheet│
└──────────────┬───────────────┘                └───────────────┬────────────────────┘
   postMessage │ (versioned, validated)              runtime Port│        ▲
┌──────────────▼───────────────┐                ┌───────────────▼────────┴───────────┐
│ ISOLATED content script      │◀──────────────▶│ Web Worker (pure core):            │
│ = Overleaf EditorPort adapter│                │ parse → DocumentModel → rules →    │
└──────────────────────────────┘                │ Diagnostic[] → fixes → TextEdit[]  │
                                                └────────────────────────────────────┘
                                                  LlmPort → Gemini Nano (Phase 4, optional)
```

| Path               | Contents                                                           |
| ------------------ | ------------------------------------------------------------------ |
| `entrypoints/`     | Thin WXT shell: background, content scripts, side panel            |
| `src/core/`        | Pure: document model, roles, profiles, rules, fixes (from Phase 1) |
| `src/ports/`       | `EditorPort`, `LlmPort`, `StoragePort` interfaces                  |
| `src/adapters/`    | Overleaf, generic CodeMirror/textarea, storage, Gemini Nano        |
| `src/messaging/`   | Typed, versioned cross-context message protocol                    |
| `src/ui/`          | React side panel                                                   |
| `knowledge/cards/` | Learning cards (Markdown, each citing a real source)               |
| `tests/e2e/`       | Playwright tests; never run against live Overleaf                  |
| `docs/adr/`        | Architecture Decision Records                                      |

## Permissions

`sidePanel` only. The content script runs on `https://*.overleaf.com/project/*`. There are no host permissions beyond that and no `tabs` permission.

## Limitations

- Overleaf shows one file at a time. Until Phase 5, multi-file projects (`\input`, `\include`, separate `.bib`) are analysed one file at a time, with a "partial view" indicator.
- Lemma reads Overleaf's editor through an API Overleaf marks as unsupported. If Overleaf changes it, the panel shows "Can't read the Overleaf editor" until Lemma is updated.
- Optional AI explanations (Phase 4) use Chrome's on-device Gemini Nano. They are **English only** and need Chrome's hardware minimum: 22 GB free disk, plus a GPU with more than 4 GB VRAM or 16 GB RAM with 4+ CPU cores. Everything else works without them.

## License

[MIT](LICENSE) © 2026 Amogh D. Prasanna
