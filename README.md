# Lemma

A structure-first LaTeX assistant for Overleaf, aimed at physics and quantum-information papers. Lemma reads the document open in Overleaf and:

1. shows the paper's structure as **roles** (motivation, methods, results, …) against a standard or custom structure;
2. flags structural problems, LaTeX bugs and notation inconsistencies, each with a plain-language reason;
3. offers mechanical quick-fixes that you **preview as a diff** and apply with a click; one Overleaf undo reverses each fix;
4. teaches as it goes: every item links to a short learning card that cites real sources and says whether it is a rule or a style choice.

**Lemma never writes your paper.** It inserts empty skeletons (with questions for you) and mechanical edits only, and a guard in the code rejects anything else ([ADR-0003](docs/adr/0003-no-content-generation.md)).

**Your document stays on your computer.** No telemetry. The only network requests go to an AI model server you connect yourself; with a remote one (OpenRouter), your paper is sent only if you allow it ([ADR-0008](docs/adr/0008-ai-backends.md)).

## Features

| Tab          | What it does                                                                                                                                                                                                                                                                                                              |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Checks**   | Diagnostics for the open file: _Go to_, _Fix_ (diff preview → Apply), _Why?_, _Learn more_, and _Intentional_ to dismiss for this document. "Fix all" for repeated issues. Items in other project files are listed separately.                                                                                            |
| **Outline**  | The paper's parts and the roles each fills, with how Lemma decided (heading, guess, you, on-device AI). Reassign roles; in Template mode, a checklist of what the profile expects with "Add skeleton".                                                                                                                    |
| **Notation** | Your own conventions at a glance: symbols you introduce ("where $H$ is…"), acronyms and their expansions, macros you define, ket/trace/adjoint styles, packages.                                                                                                                                                          |
| **Learn**    | 22 learning cards (paper structure, abstracts, `\eqref`, ties, `$$`, floats, siunitx, bra-ket packages, trace, † vs \*, acronyms, DOIs, compile errors…), searchable, each with sources. **Ask Lemma** is a chat for LaTeX and writing questions: it finds the matching notes and, with on-device AI on, answers briefly. |
| **Log**      | Reads the compile log Overleaf already shows (or a pasted one) and explains each error in plain language with a likely cause.                                                                                                                                                                                             |
| **Settings** | Structure mode, profile, where settings live (this browser or a `% lemma:` comment in the document), per-rule switches, custom profiles, project files (zip import), and the opt-in on-device AI.                                                                                                                         |

**Write mode** shows only errors and warnings; **Learn mode** also shows learning notes and expands every explanation.

### Structure modes

- **Adaptive** (default): your outline is the structure. Only gaps every paper must fill are flagged (somewhere for results, a bibliography); differences from templates are learning notes. A Letter without headings or a theory paper with custom section names gets no structure warnings.
- **Template**: compare against a profile (Physics article for REVTeX / arXiv quant-ph, PRL-style Letter, PRX Quantum, _Quantum_, review article, thesis chapter) or your own.
- **Freeform**: no structure checks; LaTeX, notation and citation checks still run.

Profiles are data (`src/core/profiles/builtin/*.json`). Fork one in Settings and add, remove, rename, reorder, merge and mark parts required or optional.

### Checks (29 rules)

- **Structure:** missing parts (by role), empty sections, sections whose wording suggests another role, order vs. profile, abstract length and paragraphs, citations or undefined acronyms in the abstract, missing roadmap, appendix and main text consistency.
- **LaTeX hygiene:** undefined, duplicate and unreferenced labels; `\ref` for equations (→ `\eqref`); missing `~` before `\cite`/`\ref`; `$$…$$` (→ `\[…\]`); floats without caption or label; `\label` before `\caption` (moved for you); units typed by hand (→ `\qty`).
- **Quantum-information notation:** mixed ket styles (rewritten to the majority), inconsistent or italic trace, `^*` and `^\dagger` on the same symbol, acronyms used before definition, never defined or defined twice, symbols in equations never introduced in the text.
- **Citations:** entries without DOI or arXiv ID, old arXiv-only entries that may be published, citation keys missing from the bibliography.

### Multi-file projects

Overleaf shows one file at a time. Lemma remembers each file you open (until the browser closes) and can import the project zip ("Download as source") locally. The main file is analysed with its `\input`s, and results are mapped back to their files. Until every file is known, a **Partial view** note says which are missing ([ADR-0005](docs/adr/0005-multi-file-projects.md)).

### AI explanations (optional)

With a language model, Lemma can explain a check in terms of your own snippet, suggest roles for sections with ambiguous headings, reword compile errors, and answer questions about LaTeX or paper writing from the Learn tab ([ADR-0007](docs/adr/0007-topic-questions.md)). It doesn't answer physics questions. It never writes paper content: whatever the model, every answer is filtered and falls back to the curated card. **English only.** Everything else works without AI.

Pick the model in **Settings → AI explanations** ([ADR-0008](docs/adr/0008-ai-backends.md)):

| Backend                        | Runs where                                      | Needs                                                                                                   |
| ------------------------------ | ----------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| **Model server** (recommended) | Ollama, LM Studio or llama.cpp on your computer | About 4–8 GB RAM for a 3–8B model; 8 GB laptops work                                                    |
| **Chrome built-in** (default)  | Gemini Nano inside Chrome                       | Chrome's minimum: 22 GB free disk, and a GPU with more than 4 GB VRAM or 16 GB RAM with 4+ cores        |
| **OpenRouter**                 | Hosted models, under your own API key           | A key from openrouter.ai. Only Ask Lemma questions are sent unless you tick "Send snippets of my paper" |

Lemma can't reach any server until you press **Connect**, which asks Chrome for permission to reach that one address.

#### Ollama

```sh
ollama pull qwen3:4b
```

Ollama refuses browser extensions unless you allow them, once:

- **macOS:** `launchctl setenv OLLAMA_ORIGINS "chrome-extension://*"`, then quit and reopen Ollama.
- **Linux (systemd):** `sudo systemctl edit ollama.service`, add `Environment="OLLAMA_ORIGINS=chrome-extension://*"` under `[Service]`, then `sudo systemctl restart ollama`.
- **Windows:** set the user environment variable `OLLAMA_ORIGINS` to `chrome-extension://*`, then restart Ollama.

In Lemma: Settings → AI explanations → **A model server** → Ollama → model `qwen3:4b` → **Connect**.

#### LM Studio

Download a model, start the server in the Developer tab (port 1234), then choose LM Studio in Lemma and **Connect**.

#### llama.cpp

```sh
llama-server -hf Qwen/Qwen3-4B-GGUF:Q4_K_M --port 8080
```

Choose llama.cpp server in Lemma; the model field can stay empty, since the server has one model.

Any small instruction-tuned model that follows a JSON schema works. Larger models give better answers if your machine can run them.

## Install (development build)

Requirements: Node 22+ (24 recommended, see `.nvmrc`), Chrome 116+ (141+ for the toolbar mascot's "panel open" face).

```sh
npm install
npm run build
```

Then in Chrome open `chrome://extensions`, enable **Developer mode**, click **Load unpacked**, and pick `.output/chrome-mv3`. Pin Lemma from the puzzle-piece menu so its mascot sits next to the address bar. Open an Overleaf project: the mascot wakes up, and clicking it opens the side panel.

To read compile errors, open Overleaf's logs (next to Recompile) and choose the raw log; then press **Read log from Overleaf** in the Log tab.

## Scripts

| Command                 | What it does                                                           |
| ----------------------- | ---------------------------------------------------------------------- |
| `npm run dev`           | Dev build with reload                                                  |
| `npm run build`         | Production build to `.output/chrome-mv3`                               |
| `npm run check`         | Typecheck, lint, format check, unit tests                              |
| `npm run test:coverage` | Unit tests with coverage thresholds                                    |
| `npm run test:e2e`      | Playwright tests against the build and a mock Overleaf page            |
| `npm run icons`         | Regenerate `public/icon/*.png` from the mascot art (headless Chromium) |

First time running e2e tests: `npx playwright install chromium`.

## Architecture

Hexagonal (ports and adapters) with a pure functional core. Everything in `src/core` is side-effect-free and tested without a browser; ESLint enforces the boundaries.

```
 Overleaf tab                                     Side panel (extension page)
┌───────────────────────────────┐                ┌────────────────────────────────────┐
│ MAIN world: page hook         │                │ React UI ← PanelController         │
│ UNSTABLE_editor:extensions +  │                │   EditorPort · StoragePort ·       │
│ overleaf.unstable.store       │                │   LlmPort (Nano or server, opt.)   │
└───────────────┬───────────────┘                └──────┬───────────────────▲─────────┘
  postMessage   │ (versioned, validated)    runtime Port│                   │ results
┌───────────────▼───────────────┐                ┌──────▼───────────────────┴─────────┐
│ ISOLATED: bridge + log reader │◀──────────────▶│ Web Worker: pure core              │
└───────────────────────────────┘                │ parse → model → roles → rules →    │
                                                 │ diagnostics + guarded fixes        │
                                                 └────────────────────────────────────┘
```

| Path                    | Contents                                                                                                                                   |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `entrypoints/`          | Thin WXT shell: background, MAIN-world hook, isolated bridge, side panel                                                                   |
| `src/core/model/`       | unified-latex parsing → DocumentModel (sections, labels, refs, cites, math…)                                                               |
| `src/core/structure/`   | Roles and role inference                                                                                                                   |
| `src/core/profiles/`    | Profile schema, registry, built-in profiles (JSON)                                                                                         |
| `src/core/rules/`       | Rule engine, registry, one directory per rule with fixtures and tests                                                                      |
| `src/core/fixes/`       | Text edits, diff preview, skeleton templates, the content guard                                                                            |
| `src/core/notation/`    | Acronyms, kets, trace, adjoints, symbols                                                                                                   |
| `src/core/project/`     | Multi-file flattening with source maps                                                                                                     |
| `src/core/compile-log/` | Log parser and plain-language translations                                                                                                 |
| `src/core/llm/`         | Prompts and the output filter (pure)                                                                                                       |
| `src/core/knowledge/`   | Learning-card loader; cards live in `knowledge/cards/*.md`                                                                                 |
| `src/ports/`            | `EditorPort`, `StoragePort`, `LlmPort`                                                                                                     |
| `src/adapters/`         | Overleaf (selectors, bridge, runtime port), page hook (CodeMirror / textarea), storage, Gemini Nano + OpenAI-compatible server + fake, zip |
| `src/worker/`           | Analysis worker and client                                                                                                                 |
| `src/ui/`               | React panel and its controller                                                                                                             |
| `tests/papers/`         | Acceptance fixtures (clean REVTeX paper, Letter, custom theory paper)                                                                      |
| `tests/e2e/`            | Playwright tests and the mock Overleaf page (real CodeMirror 6)                                                                            |
| `docs/adr/`             | Architecture Decision Records                                                                                                              |

Performance: analysis runs in a worker, 500 ms after typing stops. A typical 6 KB paper takes about 9 ms; a 54 KB paper about 125 ms, off the main thread.

## Permissions

`sidePanel`, `storage`, and host access to `https://*.overleaf.com/*` only (to read which project a tab shows and to run the content scripts there). No `tabs` permission, no other sites.

## Limitations

- Lemma reads Overleaf's editor through APIs Overleaf marks as unsupported. If Overleaf changes them, the panel shows "Can't read the Overleaf editor" until Lemma is updated ([ADR-0002](docs/adr/0002-overleaf-editor-access.md)).
- Multi-file analysis only covers files you opened or imported; the Partial view note lists the rest.
- Heuristic checks (role wording, roadmap, undefined symbols) are learning notes, not verdicts. Dismiss them with _Intentional_.
- AI explanations are English only. Chrome's built-in model needs Chrome's hardware minimum; a model server needs a few GB of RAM and one-time setup.
- Answer quality depends on the model you pick. The filter keeps answers from drafting your paper whatever the model, but small models can still be wrong.

## License

[MIT](LICENSE) © 2026 Amogh D. Prasanna

## Mascot

Oswald and his dog Weenie are characters from the children's TV series _Oswald_ by Dan Yaccarino. They are used here for a personal build; Lemma is not affiliated with their rights holders. Replace the art in `src/mascot/oswald.ts` (and run `npm run icons`) before publishing the extension.
