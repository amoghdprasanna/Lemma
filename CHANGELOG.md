# Changelog

All notable changes to this project are documented here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project uses [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added

- **AI model servers** ([ADR-0008](docs/adr/0008-ai-backends.md)): Settings now chooses the model. Options are Chrome's built-in model (as before), a server on your computer (Ollama, LM Studio or llama.cpp, which runs on 8 GB laptops where Chrome's model doesn't), OpenRouter with your own key, or off. One OpenAI-compatible adapter uses the same prompts, schemas and drafting filter as before. Lemma asks Chrome for permission to reach the server only when you press Connect, and the CSP allows only localhost and openrouter.ai. A remote model gets Ask Lemma questions only, unless you allow paper snippets too, and OpenRouter requests exclude providers that store prompts. The status bar names the model in use. Connection problems say what to fix, including Ollama's `OLLAMA_ORIGINS` setting.
- **Reading Overleaf** (Phase 1): MAIN-world page hook using Overleaf's `UNSTABLE_editor:extensions` event and `overleaf.unstable.store` (file name, view fallback), an isolated-world bridge, and a panel-side `EditorPort` over a runtime port, with schema validation at every hop and a clear "can't read the editor" state. A textarea adapter proves the seam is real.
- **Analysis core**: unified-latex document model, role inference, data-driven profiles (physics article, PRL Letter, PRX Quantum, Quantum, review, thesis chapter), Adaptive/Template/Freeform modes, and a rule engine with 29 rules across structure, LaTeX hygiene, quantum-information notation and citations. Runs in a Web Worker.
- **Fixes** (Phase 2): mechanical and skeleton fixes only, enforced by a content guard; diff preview; one-step undo in Overleaf; "fix all" per rule; stale-edit protection.
- **Compile-log translator** for the log Overleaf displays or a pasted log.
- **Learning layer** (Phase 3): 22 sourced learning cards marked rule / style choice / reference, Write and Learn modes, notation sheet, outline with role reassignment, custom profile editor (add, remove, rename, reorder, merge, required/optional), per-document settings in a `% lemma:` comment or in browser storage, dismissals remembered per project.
- **On-device AI** (Phase 4): optional Gemini Nano explanations, role suggestions and log rewording behind `LlmPort`, with an output filter, availability states, explicit opt-in download, snippet-only prompts and a per-prompt cache.
- **Multi-file projects** (Phase 5): files cached as you open them, local zip import, flattened analysis with source maps, per-file results, partial-view indicator.
- **Ask** box in the Learn tab: a question about LaTeX or paper writing finds the matching notes and, with on-device AI on, gets a short answer grounded in them. Requests to write paper text are refused before the model sees them, and physics questions are marked off-topic (ADR-0007).
- **Editor-style panel**: VS Code–like layout with icon tabs (icons only when the panel is narrow), a Problems-style Checks list (one row per item, quick fixes always visible, details on expand), a status bar with checking state, counts and AI state, and light/dark Modern colour tokens.
- **Ask Lemma chat** in the Learn tab: a thread with suggested questions and a composer pinned at the bottom; the notes library sits beside it.
- **Oswald and Weenie** replace the pixel builder: a flat 2D blue octopus in a bowler hat as the mascot and toolbar icon, with his dachshund Weenie beside him in the panel. Oswald breathes and wiggles his tentacles, follows the pointer and leans toward it, winks and tips his hat on hover, hops when clicked (a somersault on three quick clicks), sways while Lemma thinks and hops when it's done. Weenie wags, sniffs while Lemma thinks, and barks when clicked. The toolbar icon thinks while the panel works. Reduced motion respected.
- **Readability**: 15 px base text; every tab shows its label under its icon.
- **Friendlier look**: Lexend (bundled locally) for easier reading; a palette from Oswald's world (sky-paper light theme, deep-sea dark theme, Weenie's tan for learning); pill-shaped active tab; a clear "Show tips" switch instead of the Write/Learn toggle; Checks opens with a plain-language heading ("6 things to look at"), filter chips for errors, warnings and tips, rounded grouped lists, and a happy Oswald when all is clear.
- ADR-0005 (multi-file projects) and ADR-0006 (LaTeX parsing).
- ADR-0007 (topic questions).
- Acceptance fixtures: a clean REVTeX quant-ph paper (zero diagnostics), a Letter without headings and a custom-named theory paper (no structure warnings in Adaptive mode); Playwright tests against a mock Overleaf page running real CodeMirror 6.

### Fixed

- **Ask Lemma and "Explain for my text" saw only part of each note**: the note's first paragraph was sent twice and the rest cut off at 700 characters. Each matching card is now sent whole, once.
- **On-device answers vanished without a reason**: when the model was not running, the prompt was too long, the answer was garbled or the filter hid it, Lemma only said "No on-device answer this time". It now says which.
- **Writing advice was filtered out**: answers to "what goes in an abstract?" that quoted a phrase such as "we show that" were dropped as drafted text. Ask answers may now quote short phrases; quoted sentences are still dropped.
- **Idle CPU**: the mascots' breathing, tentacle wiggle and tail wag looped forever, costing up to a quarter of a CPU core while the panel sat open on a long paper. They now play a few cycles and rest (hovering the mascots starts them again), and the mascot's repaints are contained. Idle use on a 170 KB paper fell from about 25% to 2% of a core.
- **On-device AI after reopening the panel**: the status bar said "AI on" but answers fell back to the notes until AI was turned on again. The model session now reopens on the first question when the model is already downloaded; opening the panel alone still never loads the model.

### Changed

- Learning card titles in single quotes no longer show the quotes.

- The toolbar mascot no longer falls asleep on an Overleaf project when the page loads something inside it (PDF preview, recompile).

- Permissions: added `storage` and host access to `https://*.overleaf.com/*`.

### Phase 0

- Project setup: WXT, React, strict TypeScript, ESLint with architecture boundaries, Prettier, Vitest, Playwright, and GitHub Actions CI.
- Side panel that is enabled only on Overleaf project pages.
- Pixel mascot (a blocky builder in a hard hat) as the toolbar icon. Its face follows the tab: asleep and greyed off Overleaf, a wake-up blink on an Overleaf project, happy while the side panel is open. In the panel its eyes follow the pointer, it blinks, and it hops when clicked (no hop with reduced motion).
- Versioned, validated message protocol between extension contexts.
- ADR-0001 to ADR-0004: build tooling, Overleaf editor access, no content generation, on-device-only AI.
