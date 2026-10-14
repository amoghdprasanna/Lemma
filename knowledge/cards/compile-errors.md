---
id: compile-errors
title: 'Reading LaTeX compile errors'
status: reference
sources:
  - title: 'Overleaf Learn: Errors'
    url: https://www.overleaf.com/learn/latex/Errors
  - title: 'T. Oetiker et al., The Not So Short Introduction to LaTeX (CTAN)'
    url: https://ctan.org/pkg/lshort-english
---

LaTeX logs are long, but a few habits help:

1. **Fix the first error first.** Later errors are often consequences of it.
2. **Look at the line number** (`l.42`) and the text shown after it: LaTeX stopped just after the problem.
3. **Warnings about references** ("Reference … undefined") often disappear after one more compile.
4. **Overfull/underfull boxes** are typesetting hints, not errors; fix them last, if at all.

Lemma translates common messages into plain language with a likely cause. For the full list, see Overleaf's error guides.
