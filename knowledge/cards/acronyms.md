---
id: acronyms
title: 'Acronyms: define at first use'
status: rule
sources:
  - title: 'APS, Physical Review Style and Notation Guide'
    url: https://journals.aps.org/files/styleguide-pr.pdf
  - title: 'N. J. Higham, Handbook of Writing for the Mathematical Sciences (SIAM)'
    url: https://epubs.siam.org/doi/book/10.1137/1.9781611976106
---

Spell out an acronym the first time it appears, with the short form in parentheses, then use the short form:

> Quantum error correction (QEC) protects… QEC requires…

- Define it **in the abstract** if the abstract uses it, and **again in the main text**, since the two are read separately.
- Define it **once** in the main text; repeating the definition later is noise.
- Very standard gate and state names (CNOT, GHZ) are often left unexpanded. Check your journal's style.

Packages such as `acro` or `glossaries` can manage this automatically. When you load one, Lemma leaves acronyms to it.
