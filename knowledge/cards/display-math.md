---
id: display-math
title: 'Avoid $$…$$'
status: rule
sources:
  - title: 'M. Ensenbach and M. Trettin, l2tabu: obsolete commands and packages (CTAN)'
    url: https://ctan.org/pkg/l2tabu
  - title: "User's Guide for the amsmath Package (CTAN)"
    url: https://ctan.org/pkg/amsmath
---

`$$ ... $$` is plain-TeX syntax. In LaTeX it gives inconsistent vertical spacing and does not respect document options such as `fleqn` (left-aligned equations).

Use instead:

- `\[ ... \]` for an unnumbered display,
- `equation` for a numbered one (and `\label` it if you refer to it),
- `align` (amsmath) for several aligned lines.

Lemma can replace `$$…$$` with `\[…\]` for you.
