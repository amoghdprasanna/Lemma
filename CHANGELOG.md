# Changelog

All notable changes to this project are documented here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project uses [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added

- **Reading Overleaf** (Phase 1): MAIN-world page hook using Overleaf's `UNSTABLE_editor:extensions` event and `overleaf.unstable.store` (file name, view fallback), an isolated-world bridge, and a panel-side `EditorPort` over a runtime port, with schema validation at every hop and a clear "can't read the editor" state. A textarea adapter proves the seam is real.
- **Analysis core**: unified-latex document model, role inference, data-driven profiles (physics article, PRL Letter, PRX Quantum, Quantum, review, thesis chapter), Adaptive/Template/Freeform modes, and a rule engine with 29 rules across structure, LaTeX hygiene, quantum-information notation and citations. Runs in a Web Worker.
- **Fixes** (Phase 2): mechanical and skeleton fixes only, enforced by a content guard; diff preview; one-step undo in Overleaf; "fix all" per rule; stale-edit protection.
- **Compile-log translator** for the log Overleaf displays or a pasted log.
- **Learning layer** (Phase 3): 22 sourced learning cards marked rule / style choice / reference, Write and Learn modes, notation sheet, outline with role reassignment, custom profile editor (add, remove, rename, reorder, merge, required/optional), per-document settings in a `% lemma:` comment or in browser storage, dismissals remembered per project.
- **On-device AI** (Phase 4): optional Gemini Nano explanations, role suggestions and log rewording behind `LlmPort`, with an output filter, availability states, explicit opt-in download, snippet-only prompts and a per-prompt cache.
- **Multi-file projects** (Phase 5): files cached as you open them, local zip import, flattened analysis with source maps, per-file results, partial-view indicator.
- ADR-0005 (multi-file projects) and ADR-0006 (LaTeX parsing).
- Acceptance fixtures: a clean REVTeX quant-ph paper (zero diagnostics), a Letter without headings and a custom-named theory paper (no structure warnings in Adaptive mode); Playwright tests against a mock Overleaf page running real CodeMirror 6.

### Changed

- Permissions: added `storage` and host access to `https://*.overleaf.com/*`.

### Phase 0

- Project setup: WXT, React, strict TypeScript, ESLint with architecture boundaries, Prettier, Vitest, Playwright, and GitHub Actions CI.
- Side panel that is enabled only on Overleaf project pages.
- Pixel mascot (a blocky builder in a hard hat) as the toolbar icon. Its face follows the tab: asleep and greyed off Overleaf, a wake-up blink on an Overleaf project, happy while the side panel is open. In the panel its eyes follow the pointer, it blinks, and it hops when clicked (no hop with reduced motion).
- Versioned, validated message protocol between extension contexts.
- ADR-0001 to ADR-0004: build tooling, Overleaf editor access, no content generation, on-device-only AI.
