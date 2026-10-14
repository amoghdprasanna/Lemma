---
id: eqref
title: "Why \\eqref for equations"
status: rule
sources:
  - title: "User's Guide for the amsmath Package (CTAN)"
    url: https://ctan.org/pkg/amsmath
  - title: 'cleveref package documentation (CTAN)'
    url: https://ctan.org/pkg/cleveref
  - title: 'N. D. Mermin, "What''s wrong with these equations?", Physics Today 42 (10), 9 (1989)'
    url: https://doi.org/10.1063/1.2811173
---

With `amsmath`, `\eqref{eq:x}` prints the equation number in parentheses, "(3)", matching how the number appears next to the equation. Writing `(\ref{eq:x})` by hand gives the same look but is easy to forget, so equation references end up inconsistent.

```latex
By Eq.~\eqref{eq:energy}, the gap closes.
```

`\eqref` also typesets the number upright even in italic text.

**Alternative.** The `cleveref` package's `\cref` adds the word too ("Eq. (3)"), so the reference style is set once for the whole paper.
