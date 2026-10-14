---
id: float-caption-label
title: 'Captions and labels in figures and tables'
status: rule
sources:
  - title: 'T. Oetiker et al., The Not So Short Introduction to LaTeX (CTAN)'
    url: https://ctan.org/pkg/lshort-english
  - title: 'Overleaf Learn: Cross referencing sections, equations and floats'
    url: https://www.overleaf.com/learn/latex/Cross_referencing_sections%2C_equations_and_floats
---

Inside `figure` and `table` environments:

1. Every float needs a `\caption`: it tells readers what they are looking at, and it is what gets numbered.
2. Put `\label` **after** `\caption`. The label refers to the most recent numbered item; before the caption, that is the enclosing section, so `\ref` prints the section number instead of the figure number.

```latex
\begin{figure}
  \includegraphics[width=\columnwidth]{threshold}
  \caption{Logical error rate against physical error rate.}
  \label{fig:threshold}
\end{figure}
```
