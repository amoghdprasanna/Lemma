import { describe, expect, it } from 'vitest';
import {
  analyzeProject,
  findMainFile,
  flatten,
  mapSpan,
  resolveInput,
  type ProjectFile,
} from './project';

const MAIN = String.raw`\documentclass{article}
\usepackage{amsmath}
\begin{document}
\input{sections/intro}
\include{results}
\input{missing}
\bibliography{refs}
\end{document}
`;
const INTRO = String.raw`\section{Introduction}
See Sec.~\ref{sec:results} and Eq.~(\ref{eq:a}).
`;
const RESULTS = String.raw`\section{Results}\label{sec:results}
\begin{equation} x = 1 \label{eq:a} \end{equation}
We find this~\cite{known,unknown}.
`;
const BIB = '@article{known, title={K}, doi={10.1/k}}\n';

const files: ProjectFile[] = [
  { path: 'main.tex', text: MAIN },
  { path: 'sections/intro.tex', text: INTRO },
  { path: 'results.tex', text: RESULTS },
  { path: 'refs.bib', text: BIB },
];

describe('project', () => {
  it('resolves inputs relative to root, the including file, or by unique name', () => {
    const known = ['main.tex', 'sections/intro.tex', 'sections/a/b.tex'];
    expect(resolveInput('sections/intro', 'main.tex', known)).toBe('sections/intro.tex');
    expect(resolveInput('a/b', 'sections/intro.tex', known)).toBe('sections/a/b.tex');
    expect(resolveInput('intro.tex', 'main.tex', known)).toBe('sections/intro.tex');
    expect(resolveInput('nope', 'main.tex', known)).toBeNull();
  });

  it('finds the main file and flattens with a source map', () => {
    expect(findMainFile(files)).toBe('main.tex');
    const flat = flatten(files, 'main.tex');
    expect(flat.included).toEqual(['main.tex', 'sections/intro.tex', 'results.tex']);
    expect(flat.missing).toEqual(['missing']);
    expect(flat.text).toContain('\\section{Introduction}');
    expect(flat.text).not.toContain('\\input{sections/intro}');
    const at = flat.text.indexOf('\\label{sec:results}');
    expect(mapSpan(flat.segments, { start: at, end: at + 6 })).toEqual({
      path: 'results.tex',
      span: { start: RESULTS.indexOf('\\label'), end: RESULTS.indexOf('\\label') + 6 },
    });
  });

  it('analyses the whole paper and maps results and fixes back to the open file', () => {
    const r = analyzeProject(files, 'sections/intro.tex', {});
    expect(r.scope).toBe('project');
    // The \ref to sec:results resolves across files: no undefined-ref here.
    expect(r.diagnostics.filter((d) => d.ruleId === 'hygiene/undefined-ref')).toEqual([]);
    const eqref = r.diagnostics.find((d) => d.ruleId === 'hygiene/eqref');
    expect(eqref?.line).toBe(2);
    const edit = eqref?.fixes[0]?.edits[0];
    expect(edit && INTRO.slice(edit.start, edit.end)).toBe('(\\ref{eq:a})');
    // Problems in other files are reported per file.
    const other = r.otherFiles.find((f) => f.path === 'results.tex');
    expect(other?.diagnostics.map((d) => d.ruleId)).toContain('citations/undefined-cite');
    expect(r.missingFiles).toEqual(['missing']);
    expect(r.partial).toBe(true);
    expect(r.structure.filter((u) => u.kind === 'section').map((u) => u.label)).toEqual([
      'Introduction',
      'Results',
    ]);
    expect(r.unitFiles).toContain('results.tex');
  });

  it('falls back to single-file analysis for files no main file includes', () => {
    const r = analyzeProject(
      [{ path: 'notes.tex', text: '\\section{Notes}\nText.' }],
      'notes.tex',
      {},
    );
    expect(r.scope).toBe('file');
    expect(r.partialReasons.length).toBeGreaterThan(0);
  });

  it('analyses an open .bib file on its own', () => {
    const r = analyzeProject(files, 'refs.bib', {});
    expect(r.kind).toBe('bib');
    expect(r.scope).toBe('file');
  });
});
