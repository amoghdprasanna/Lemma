---
id: dagger-vs-star
title: 'Adjoint (†) versus complex conjugate (*)'
status: rule
sources:
  - title: 'M. A. Nielsen and I. L. Chuang, Quantum Computation and Quantum Information, Chapter 2 (Cambridge University Press, 2010)'
    url: https://doi.org/10.1017/CBO9780511976667
---

In quantum-information notation (Nielsen & Chuang, Chapter 2):

- $z^_$ is the **complex conjugate** of a number $z$; for a matrix, $A^_$ conjugates each entry.
- $A^T$ is the **transpose**.
- $A^\dagger = (A^T)^*$ is the **Hermitian conjugate (adjoint)**.

So $U^\dagger U = I$ expresses unitarity, while $U^* U$ is usually a different matrix. Mathematicians often write $A^*$ for the adjoint, which is why the two get mixed up. If you mean the adjoint, write `^\dagger` consistently.
