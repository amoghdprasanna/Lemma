import { describe, expect, it } from 'vitest';
import { buildModel } from './build';
import { normalizeHeading, proseOf, wordCount } from './text';

const SRC = String.raw`\documentclass[aps,pra,twocolumn]{revtex4-2}
\usepackage{amsmath,physics}
\newcommand{\ham}{H}
\DeclareMathOperator{\Tr}{Tr}
\begin{document}
\title{A Test}
\author{A}\author{B}
\begin{abstract}
We study quantum error correction (QEC) \cite{nc}.
\end{abstract}
\maketitle
\section{Introduction}\label{sec:intro}
Text~\cite{a, b} and \eqref{eq:x}. % a comment with \ref{ghost}
$$ a $$ and \[ b \] and $c$ and \( d \).
\begin{equation} E = mc^2 \label{eq:x} \end{equation}
\begin{figure}\caption{Cap}\label{fig:a}\end{figure}
\subsection*{Details}
\verb|\label{nope}| more.
\section{Results}
See Fig.~\ref{fig:a} and Ref.~\citep[p.~2]{c}.
\appendix
\section{Proof}\label{app:proof}
\bibliography{refs}
\end{document}
`;

describe('buildModel', () => {
  const m = buildModel(SRC, 'main.tex');

  it('reads the preamble', () => {
    expect(m.isMain).toBe(true);
    expect(m.documentClass).toEqual({ name: 'revtex4-2', options: ['aps', 'pra', 'twocolumn'] });
    expect(m.packages.map((p) => p.name)).toEqual(['amsmath', 'physics']);
    expect(m.macroDefinitions.map((d) => d.name)).toEqual(['ham', 'Tr']);
    expect(m.title).toBe('A Test');
    expect(m.authorCount).toBe(2);
  });

  it('builds a section outline with nesting and appendix flags', () => {
    expect(
      m.sections.map((s) => [s.title, s.level, s.starred, s.parentIndex, s.inAppendix]),
    ).toEqual([
      ['Introduction', 1, false, null, false],
      ['Details', 2, true, 0, false],
      ['Results', 1, false, null, false],
      ['Proof', 1, false, null, true],
    ]);
    expect(m.sections[0]?.labels).toEqual(['sec:intro']);
    // Section bodies stop at the bibliography.
    expect(SRC.slice(m.sections[3]?.bodySpan.end ?? 0)).toMatch(/^\\bibliography/);
  });

  it('classifies labels and ignores comments and verbatim', () => {
    expect(m.labels.map((l) => [l.key, l.kind, l.inAppendix])).toEqual([
      ['sec:intro', 'section', false],
      ['eq:x', 'equation', false],
      ['fig:a', 'figure', false],
      ['app:proof', 'section', true],
    ]);
    expect(m.refs.map((r) => [r.command, r.keys])).toEqual([
      ['eqref', ['eq:x']],
      ['ref', ['fig:a']],
    ]);
  });

  it('collects citations with optional arguments', () => {
    expect(m.cites.map((c) => [c.command, c.keys])).toEqual([
      ['cite', ['nc']],
      ['cite', ['a', 'b']],
      ['citep', ['c']],
    ]);
    const citep = m.cites[2];
    expect(citep && SRC.slice(citep.span.start, citep.span.end)).toBe(String.raw`\citep[p.~2]{c}`);
  });

  it('finds math with delimiters', () => {
    expect(m.math.map((x) => [x.delimiter, x.display])).toEqual([
      ['$$', true],
      ['\\[', true],
      ['$', false],
      ['\\(', false],
      ['equation', true],
    ]);
  });

  it('finds floats, abstract, bibliography and appendix', () => {
    expect(m.floats).toHaveLength(1);
    expect(m.floats[0]?.captionSpan).not.toBeNull();
    expect(m.abstract).not.toBeNull();
    expect(m.bibliography?.kind).toBe('bibtex');
    expect(m.appendixStart).not.toBeNull();
  });

  it('extracts prose without math, comments or citations', () => {
    const abs = m.abstract;
    if (!abs) throw new Error('no abstract');
    expect(proseOf(m, abs.contentSpan)).toBe('We study quantum error correction (QEC) .');
    expect(wordCount(proseOf(m, abs.contentSpan))).toBe(6);
  });

  it('treats a file without \\documentclass as a fragment', () => {
    const frag = buildModel('\\section{Methods}\nText.', 'methods.tex');
    expect(frag.isMain).toBe(false);
    expect(frag.sections).toHaveLength(1);
  });

  it('parses .bib files', () => {
    const bib = buildModel(
      '@article{nc, title={Quantum {Computation}}, doi = "10.1/x", year = 2010}\n@comment{x}\n@misc{p, eprint={2101.00001}, archivePrefix={arXiv}}',
      'refs.bib',
    );
    expect(bib.kind).toBe('bib');
    expect(bib.bibEntries.map((e) => [e.type, e.key, e.fields])).toEqual([
      ['article', 'nc', { title: 'Quantum {Computation}', doi: '10.1/x', year: '2010' }],
      ['misc', 'p', { eprint: '2101.00001', archiveprefix: 'arXiv' }],
    ]);
  });
});

describe('normalizeHeading', () => {
  it.each([
    ['Introduction', 'introduction'],
    ['1. Introduction', 'introduction'],
    ['II. Methods & Setup', 'methods & setup'],
    ['A new \\emph{scheme}', 'a new scheme'],
    ['Results: the $d=3$ code', 'results the d 3 code'],
  ])('%s -> %s', (input, out) => {
    expect(normalizeHeading(input)).toBe(out);
  });
});
