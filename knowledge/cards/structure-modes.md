---
id: structure-modes
title: 'How Lemma checks structure'
status: reference
sources:
  - title: 'G. M. Whitesides, "Whitesides'' Group: Writing a Paper", Advanced Materials 16, 1375 (2004)'
    url: https://doi.org/10.1002/adma.200400767
---

Lemma has three structure modes, chosen per document:

- **Adaptive** (default): your outline _is_ the structure. Lemma only flags gaps every paper has to fill (somewhere for results, a bibliography) and shows template differences as learning notes.
- **Template**: Lemma compares your paper with a profile (physics article, PRL Letter, PRX Quantum, Quantum, review, thesis chapter) and lists required parts that are missing.
- **Freeform**: no structure checks; LaTeX, notation and citation checks still run.

You can fork any profile into a custom one, rename, reorder, merge and mark its parts required or optional, and reassign which role each of your sections fills.

Lemma never writes your paper. Fixes are mechanical edits or empty skeletons with questions, always previewed and undoable.
