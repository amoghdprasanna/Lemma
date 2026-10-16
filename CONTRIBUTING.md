# Contributing

## Ground rules

- Read the ADRs in `docs/adr/` first. Two decisions are non-negotiable: Lemma never generates research content (ADR-0003), and the paper never leaves the computer unless the user picks a remote model and allows it (ADR-0004, ADR-0008). Only `src/adapters/llm/openai-compatible.ts` may make network requests.
- `src/core` stays pure: no DOM, no `chrome.*`, no network, no framework imports. ESLint enforces this; don't silence it.
- Every non-obvious decision gets an ADR (`docs/adr/template.md`).
- Never commit real, unpublished papers. Fixtures are synthetic. Put local test papers in `tests/private/`, which is git-ignored.

## Workflow

```sh
npm install
npm run check        # typecheck + lint + format + unit tests
npm run build && npm run test:e2e
```

Commits follow [Conventional Commits](https://www.conventionalcommits.org/) (`feat:`, `fix:`, `docs:`, `refactor:`, `test:`, `chore:`). Versions follow SemVer, and user-visible changes go in `CHANGELOG.md` under _Unreleased_.

## Adding a rule

A rule is one directory, discovered automatically by the registry (`src/core/rules/registry.ts`):

```
src/core/rules/<category>/<rule-name>/
  rule.ts         # default-exports a Rule; its id must be "<category>/<rule-name>"
  rule.test.ts    # three lines: describeRule(rule, import.meta.dirname)
  pass*.tex|bib   # documents the rule must NOT flag (one or more)
  fail*.tex|bib   # documents the rule MUST flag; messages and fix diffs are snapshot-tested
  context.bib     # optional: supplied as the project's bibliography
```

- `check(ctx)` is pure: it receives the `DocumentModel`, settings, profile, inferred structure and project context, and returns `Finding[]` (message, span, optional severity override, optional `fixes`).
- Fixes are `TextEdit`s of kind `mechanical` (rearrange or re-mark existing text) or `skeleton` (curated headings and TODO questions from `src/core/fixes/skeleton.ts`). The guard rejects anything else, and `describeRule` fails if it does (ADR-0003).
- Fixtures can set their own mode with a first line like `% lemma: mode=template, profile=builtin/physics-article`.
- Every rule points to a learning card. Prefer `learn` or `info` for heuristics and style choices; reserve `error` for things that break compilation or references.
- The clean-paper acceptance test (`src/core/acceptance.test.ts`) must stay at zero diagnostics.

## Adding a profile

Add a JSON file to `src/core/profiles/builtin/` (validated by `schema.ts` at startup and in tests). Each part lists its roles, whether it is required, extra heading aliases, and a one-line purpose. Order is the preferred (never enforced) order. Journal length limits you cannot verify go in `lengthNote` as "check the journal's guide", not as numbers.

## Adding a learning card

Cards live in `knowledge/cards/<card-id>.md` with frontmatter:

```yaml
---
id: why-eqref
title: Why \eqref for equations
status: rule # or: style-choice
sources:
  - title: amsmath user's guide, §3.11
    url: https://ctan.org/pkg/amsmath
---
```

- Keep cards short: what to do, why, and a minimal example.
- Every card cites a real, checkable source (APS/REVTeX author guide, _Quantum_ guidelines, package documentation, standard textbooks). Never invent guidance.
- If a convention is common but not mandated, mark it `status: style-choice` and say so in the text. Use `reference` for how-to material.
- `src/core/knowledge/cards.test.ts` checks that every rule and role points to an existing card with at least one source.

## Overleaf changes

Everything Overleaf-specific is in `src/adapters/overleaf/selectors.ts` and `project-url.ts`, with the Overleaf source location each name was verified against. If Overleaf changes, update those, mirror the change in the mock page (`tests/e2e/mock-overleaf/main.ts`), and note it in ADR-0002.
