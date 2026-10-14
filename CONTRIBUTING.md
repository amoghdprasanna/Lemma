# Contributing

## Ground rules

- Read the ADRs in `docs/adr/` first. Two decisions are non-negotiable: Lemma never generates research content (ADR-0003), and nothing leaves the browser (ADR-0004).
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

## Adding a rule (from Phase 1)

A rule is one directory, discovered automatically by the registry:

```
src/core/rules/<category>/<rule-id>/
  rule.ts        # exports a Rule: id, category, severity, check(), optional fix(), cardId
  rule.test.ts   # runs check() on both fixtures; snapshot-tests fix() diffs
  pass.tex       # a minimal document the rule must NOT flag
  fail.tex       # a minimal document the rule MUST flag
```

- `check(model, context)` is a pure function returning `Diagnostic[]`.
- `fix()` returns `TextEdit[]` of kind `mechanical` or `skeleton` only. The fix guard rejects anything else (ADR-0003).
- Every rule points to a learning card. Prefer `learn` or `info` severity for heuristics and style choices; reserve `error` for things that break compilation or references.
- Add the rule's pass fixture to the "clean paper" regression test if it should never fire there.

## Adding a learning card (from Phase 3)

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
- If a convention is common but not mandated, mark it `status: style-choice` and say so in the text.
