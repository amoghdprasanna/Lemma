# ADR-0006: LaTeX parsing

- **Status:** Accepted
- **Date:** 2026-10-13

## Context

Rules need reliable positions for sections, labels, references, citations, environments, math and comments, in documents that are often mid-edit and therefore not always valid LaTeX. The core must stay pure and portable (it runs in a Web Worker and in Node tests), so it cannot use Overleaf's own in-page syntax tree.

Verified on 2026-10-13: `@unified-latex/unified-latex-util-parse@1.8.4` (MIT) parses LaTeX into an AST whose nodes carry `position.{start,end}.{offset,line,column}`. Macro nodes span only the macro name; arguments of unknown macros are not attached, and its README warns that redefined control sequences and complex TeX macros are out of scope.

## Decision

- Use **unified-latex** for tokenisation: comments, `\verb`/verbatim, inline and display math (with their delimiters), environments (with content spans) and macro positions.
- Read macro arguments with Lemma's own small **argument reader** (`src/core/model/scan.ts`), driven by an xparse-like signature table (`s` star, `o` optional, `m` mandatory) for the macros Lemma cares about. It works on comment-masked text, so braces in comments never confuse it.
- Build a **DocumentModel** (`src/core/model/build.ts`) once per analysis: sections with nesting and spans, labels with their kind (equation, figure, section…), references, citations, floats, abstract, bibliography, `\input`s, macro definitions, and a comment-masked copy of the text that keeps offsets stable for regex-based rules.
- If parsing throws, the model records `parseError`, keeps whatever it collected, and the panel says the file could not be fully parsed. Analysis never crashes the panel.

## Alternatives considered

- **Regular expressions only.** Fast, but comments, verbatim and nested braces make them unreliable for anything structural.
- **tree-sitter-latex (WASM).** Robust, but adds a WASM payload and loader to an extension that otherwise ships no binary code.
- **Overleaf's Lezer syntax tree** (exported as `syntaxTree` through the extension event). Only available on Overleaf's page, in the MAIN world; it would tie the core to Overleaf and break the "pure core" rule.

## Consequences

- Measured: about 9 ms for a typical 6 KB paper and about 125 ms for a 54 KB paper (Node, on the development machine), all in the analysis worker; the main thread only renders results.
- New macros need a signature entry before their arguments are read; unknown macros are still recorded by name and position.
- unified-latex is pinned and upgraded deliberately; the model tests and the clean-paper acceptance fixture guard behaviour.
