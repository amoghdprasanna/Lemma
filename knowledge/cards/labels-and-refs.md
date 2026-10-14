---
id: labels-and-refs
title: 'Labels and cross-references'
status: rule
sources:
  - title: 'T. Oetiker et al., The Not So Short Introduction to LaTeX (CTAN)'
    url: https://ctan.org/pkg/lshort-english
  - title: 'Overleaf Learn: Cross referencing sections, equations and floats'
    url: https://www.overleaf.com/learn/latex/Cross_referencing_sections%2C_equations_and_floats
---

`\label{key}` attaches a name to the last numbered thing (section, equation, figure); `\ref{key}` prints its number. LaTeX resolves references on the next compile.

- A `\ref` to a **missing label** prints **??** in the PDF. Usually it is a typo, or the label is in a file that is not included.
- A label **defined twice** makes references ambiguous ("multiply defined" warning).
- A figure or table that is **never referenced** is a sign the text does not discuss it. Readers expect every figure to be mentioned where it matters.

Unreferenced equation and section labels are harmless. Some authors number and label every equation, a practice Mermin argues for.

Use a consistent key scheme (`sec:`, `eq:`, `fig:`, `tab:`, `app:`) so keys are easy to search.
