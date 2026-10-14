---
id: ket-notation
title: 'Bra-ket notation packages'
status: style-choice
sources:
  - title: 'physics package documentation (CTAN)'
    url: https://ctan.org/pkg/physics
  - title: 'braket package documentation (CTAN)'
    url: https://ctan.org/pkg/braket
  - title: 'M. A. Nielsen and I. L. Chuang, Quantum Computation and Quantum Information, Chapter 2 (Cambridge University Press, 2010)'
    url: https://doi.org/10.1017/CBO9780511976667
---

Dirac notation can be typed by hand (`|\psi\rangle`, `\langle\phi|\psi\rangle`) or with macros:

| package   | ket          | bra          | inner product         |
| --------- | ------------ | ------------ | --------------------- |
| `physics` | `\ket{\psi}` | `\bra{\phi}` | `\braket{\phi}{\psi}` |
| `braket`  | `\ket{\psi}` | `\bra{\phi}` | `\braket{\phi\|\psi}` |

Macros keep spacing and bracket sizes consistent and make the source easier to read. Both packages are widely used in quantum-information papers; `physics` also defines `\tr`, `\Tr`, `\dyad` and more.

**Style choice.** Which style you use is up to you. Mixing styles in one paper is what looks careless, and that is what Lemma flags.
