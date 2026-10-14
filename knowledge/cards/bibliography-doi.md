---
id: bibliography-doi
title: 'DOIs, arXiv IDs and the bibliography'
status: style-choice
sources:
  - title: 'DOI Foundation: What is a DOI?'
    url: https://www.doi.org/the-identifier/what-is-a-doi/
  - title: 'arXiv help: Adding a journal reference and DOI'
    url: https://info.arxiv.org/help/jref.html
  - title: "REVTeX 4.2 (CTAN) and its Author's Guide"
    url: https://ctan.org/pkg/revtex
---

A **DOI** is a persistent identifier: the link keeps working even if the publisher's website changes. Including `doi = {...}` in your BibTeX entries lets bibliography styles such as REVTeX's `apsrev4-2` link each reference.

For preprints, include the **arXiv identifier** (`eprint = {2401.01234}`, `archivePrefix = {arXiv}`).

Preprints are often published later. arXiv lets authors add a journal reference and DOI to the abstract page; when one exists, cite the published version (you can keep the arXiv ID too). Lemma flags older arXiv-only entries but makes no network lookups, so you check the arXiv page yourself.

Keys cited with `\cite` must match entries in your `.bib` file exactly, or the citation prints as [?].
