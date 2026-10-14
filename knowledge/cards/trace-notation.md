---
id: trace-notation
title: 'Writing the trace (and other operator names)'
status: rule
sources:
  - title: "User's Guide for the amsmath Package (CTAN)"
    url: https://ctan.org/pkg/amsmath
  - title: 'M. A. Nielsen and I. L. Chuang, Quantum Computation and Quantum Information, Chapter 2 (Cambridge University Press, 2010)'
    url: https://doi.org/10.1017/CBO9780511976667
  - title: 'physics package documentation (CTAN)'
    url: https://ctan.org/pkg/physics
---

In math mode, letters are italic variables, so `$Tr(\rho)$` reads as T times r times ρ. Operator names must be **upright**:

- `\operatorname{Tr}` (amsmath), or declare once with `\DeclareMathOperator{\Tr}{Tr}`,
- `\Tr` / `\tr` from the `physics` package,
- `\mathrm{Tr}` also works but spaces less well before parentheses.

Nielsen & Chuang write "tr"; many papers write "Tr". Either is fine (**style choice**), but use one form throughout.
