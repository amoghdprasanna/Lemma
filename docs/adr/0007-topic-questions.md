# ADR-0007: Topic questions in the Learn tab

- **Status:** Accepted (extends the scope in ADR-0004)
- **Date:** 2026-10-14

## Context

ADR-0004 limits the on-device model to three tasks, all tied to something Lemma found in the paper. Users also want to ask a general question, such as "when should I use `\eqref`?" or "what goes in a PRL abstract?". The curated learning cards already answer most of these, but only if the user finds the right card.

Two risks come with a free-text box. First, it invites "write my abstract" (ADR-0003). Second, a small on-device model answering physics questions is often wrong, and ADR-0004 says the model never judges physics.

## Decision

Add a fourth AI task: **answering a typed question about LaTeX usage or how papers are written**, grounded in the curated cards.

1. **Notes first.** `relatedCards()` (`src/core/knowledge/search.ts`) picks up to three cards by keyword overlap. They are always shown, so the box works with the model off.
2. **Drafting requests never reach the model.** `isDraftingRequest()` refuses questions that ask Lemma to write, rewrite, polish or summarise paper text. Questions asking _how_ something is usually written are allowed.
3. **Physics is off-topic.** The prompt asks for `{ onTopic, answer }` (JSON Schema `responseConstraint`). The model must set `onTopic: false` for physics, judging results, or drafting. The UI then says Lemma covers LaTeX and writing, not the physics.
4. **Filtered like every answer.** `parseTopicAnswer()` drops drafted prose (shared rules with `filterExplanation`), sectioning commands, `\begin{abstract}`/`\begin{document}` and `\maketitle`. Unlike diagnostic explanations, it allows usage examples such as `\label{eq:x}` or `\begin{equation}`, because explaining a command means naming it.
5. **Small prompts.** At most 300 characters of question and 700 per note. Nothing from the user's document is sent.
6. **Shown as text, never as an edit.** The answer is plain text with a note that on-device AI can be wrong and the cards are the checked source. As in ADR-0003, there is no path from the answer to a `TextEdit`.

## Alternatives considered

- **Any topic, physics included:** a model of this size gets physics wrong often enough to mislead a learner, and the answers would be easy to paste into the paper.
- **Search only, no model:** kept as the fallback, but a short answer tied to the user's wording is more useful when the model is available.
- **Let the model decide about drafting requests:** a prompt alone is not enforcement (ADR-0003). The pre-check is deterministic and tested.

## Consequences

- The drafting pre-check is a heuristic. It will sometimes refuse a fair question ("can you help fix my paper's compile error?"). The refusal message suggests rephrasing, and the Log tab covers compile errors.
- `onTopic` relies on the model's judgement. A physics answer that slips through still has to pass the drafting filter and is shown with the "can be wrong" note.
- New cards improve both the search and the grounded answers.
