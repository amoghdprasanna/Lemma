---
id: nonbreaking-space
title: "Non-breaking spaces before \\cite and \\ref"
status: rule
sources:
  - title: 'T. Oetiker et al., The Not So Short Introduction to LaTeX (CTAN)'
    url: https://ctan.org/pkg/lshort-english
  - title: 'Overleaf Learn: Cross referencing sections, equations and floats'
    url: https://www.overleaf.com/learn/latex/Cross_referencing_sections%2C_equations_and_floats
---

A tilde `~` is a space that LaTeX will not break across lines. Put one between a word and the reference that belongs to it:

```latex
as shown in Ref.~\cite{kitaev2003} and Fig.~\ref{fig:threshold}
```

Without it, a line can end with "Fig." and the next start with "3", or a citation number can sit alone at the start of a line.

Do not use it at the start of a sentence or after an opening parenthesis; there is nothing to tie to.
