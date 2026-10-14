# ADR-0004: On-device-only AI with Gemini Nano

- **Status:** Accepted (implementation in Phase 4); scope extended by [ADR-0007](0007-topic-questions.md)
- **Date:** 2026-10-13

## Context

Documents are unpublished research. Any cloud model would send them off the device. Chrome ships Gemini Nano through the Prompt API, which runs locally.

Verified on 2026-10-13 against developer.chrome.com (Prompt API, Prompt API for extensions, built-in AI "get started"):

- **Surface:** `LanguageModel.availability(options)`, `LanguageModel.create({ initialPrompts, expectedInputs, expectedOutputs, monitor, signal, temperature, topK })`, `session.prompt()` / `promptStreaming()` with `responseConstraint` and `signal`, plus `append`, `clone`, `destroy`, `contextUsage`, `contextWindow`, `measureContextUsage()`, a `contextoverflow` event and `QuotaExceededError`.
  - `LanguageModel.params()`, `temperature` and `topK` are extension-only; pass both or neither.
  - The old `aiLanguageModelOriginTrial` permission has expired; no permission is needed.
- **Availability states:** `unavailable`, `downloadable`, `downloading`, `available`. When downloadable or downloading, `create()` requires user activation.
- **Hardware:**
  - Windows 10/11, macOS 13+, Linux, or ChromeOS on Chromebook Plus.
  - At least 22 GB free on the Chrome profile volume.
  - A GPU with more than 4 GB VRAM, or a CPU with 16 GB RAM and 4+ cores.
  - An unmetered connection for the one-time download.
  - The model is evicted if free space falls below 10 GB. No mobile support.
- **Context:** no fixed number is documented. `session.contextWindow` reports it at runtime. On overflow, the oldest turns are dropped and the system prompt is kept.
- **Structured output:** `responseConstraint` accepts a JSON Schema (or a RegExp). The schema consumes context unless `omitResponseConstraintInput` is set.
- **Languages:** `en`, `ja`, `es`, `de`, `fr`.
- **Contexts:** not available in Web Workers; the docs do not say anything about extension service workers.
- **Version:** the docs show a "Chrome 138" badge for the API. Its stable status for extensions is to be re-checked on chromestatus before Phase 4.

## Decision

- The only model is Gemini Nano via the Prompt API, behind `LlmPort` (`src/ports/llm.ts`). `GeminiNanoAdapter` runs in the side panel page, which is a top-level extension document. Unit tests use a deterministic `FakeLlm`. The core never references `LanguageModel` (ESLint enforced).
- **Scope:** only three tasks:
  1. Suggesting a section's role when heading aliases are ambiguous, constrained by a JSON Schema whose `role` field is an enum of known roles.
  2. Explaining a diagnostic in terms of the user's own snippet.
  3. Rewording Overleaf compile errors.

  It is never used for physics correctness judgments.

- **States:**
  - `unavailable`: AI features are hidden, with the reason shown.
  - `downloadable`: an "Enable AI explanations" button; `create()` is called only from that click.
  - `downloading`: a progress bar driven by `downloadprogress`.
  - `available`: features enabled.
- **Budget:** prompts contain only the relevant section or snippet, checked with `measureContextUsage()` against `contextWindow`. Results are cached by snippet hash. Language is pinned to `en`.
- **Guardrails:** a system prompt forbids writing paper content. A post-filter discards outputs that look like drafted paper prose (sectioning commands, long declarative passages restating the snippet's claims, first-person research statements). Outputs never become edits (ADR-0003).
- **Degradation:** with the model off or unavailable, the curated learning-card text is shown. Every non-AI feature works without the model.
- **No egress, anywhere:**
  - Network globals are banned by ESLint.
  - The extension-page CSP sets `connect-src 'self'`.
  - The manifest requests no host permissions beyond the content-script match.
  - An e2e test asserts that the side panel makes no non-extension requests.
  - Chrome downloads the model itself; the extension never makes that request.

## Alternatives considered

- **Cloud LLM APIs:** violate the privacy requirement.
- **A bundled WebGPU/WASM model (e.g. via transformers.js):** a multi-hundred-megabyte extension and fragile performance, for a feature that is optional anyway.
- **No AI at all:** viable. The product is designed to be complete without it.

## Consequences

- AI explanations need capable hardware and work in English only; the README states both.
- The primary development machine (8 GB RAM, about 19 GB free disk) does not meet the hardware requirements, so Phase 4 development needs a different machine or more free space and RAM. `FakeLlm` covers everything else.
