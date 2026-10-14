# ADR-0003: No content generation

- **Status:** Accepted
- **Date:** 2026-10-13

## Context

Lemma's user is learning to write physics papers. Their text is their own unpublished research. A tool that drafts prose would undermine authorship and defeat the learning goal, and a single "helpful" shortcut tends to grow into a writing assistant. The boundary has to be enforced in code, not only in documentation.

## Decision

Lemma never produces research prose. It may insert **skeletons** (structure with curated TODO comments) and make **mechanical** edits. Enforcement:

1. **Types.** `TextEdit` has a discriminated `kind`:
   - `mechanical`: deterministic rewrites such as `\ref{eq:x}` → `\eqref{eq:x}` or adding `~` before `\cite`.
   - `skeleton`: sectioning commands and environments with comments taken from a curated template table, e.g. `\section{Discussion}` + `% TODO: what do your results mean?`.
   - `settings`: the `% lemma: …` magic comment.

   There is no free-text kind.

2. **Guard.** `src/core/fixes/guard.ts` validates every edit before it can be previewed. After removing LaTeX commands, braces, whitespace, `~`, labels and allow-listed template comments, nothing may remain except text copied from the existing document (e.g. a label name). Anything else throws, and the fix is dropped and logged as a bug.
3. **No path from the LLM to edits.** `LlmPort` returns `RoleSuggestion` and `Explanation` types, which have no conversion to `TextEdit`. ESLint forbids `src/core/fixes/**` from importing the LLM port or adapter.
4. **Tests.** Every registered fix runs through the guard on every fixture. Property-based tests feed random prose and random LaTeX through the guard and expect rejection or a pass-through.
5. **No auto-apply.** Every edit is shown as a diff and applied only by an explicit click. Applying it creates exactly one undo step in Overleaf (ADR-0002).

## Alternatives considered

- **A policy in the README only:** unenforceable, and it erodes one feature at a time.
- **Allowing generation behind a setting:** contradicts the product goal and moves an ethical decision into a settings toggle.

## Consequences

- Features such as "suggest an abstract" or "rephrase this" are permanently out of scope.
- TODO prompts in skeletons are curated questions written by maintainers, never answers.
- The guard will occasionally reject a legitimate mechanical fix. The fix is then corrected; the guard is not loosened.
