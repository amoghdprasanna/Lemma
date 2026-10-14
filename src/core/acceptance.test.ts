import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { TEST_NOW } from '@/tests/helpers/describe-rule';
import { analyze } from './analysis';
import { buildModel } from './model/build';
import { RULES } from './rules/registry';
import type { DocSettings } from './settings/types';

const papers = path.resolve(import.meta.dirname, '../../tests/papers');
const read = (f: string) => readFileSync(path.join(papers, f), 'utf8');
const bib = buildModel(read('references.bib'), 'references.bib').bibEntries;

function run(file: string, settings: Partial<DocSettings> = {}) {
  return analyze({
    text: read(file),
    fileName: file,
    storedSettings: settings,
    now: TEST_NOW,
    project: { bibEntries: bib },
  });
}

const show = (r: ReturnType<typeof run>) =>
  r.diagnostics.map((d) => `${String(d.line)} ${d.ruleId} [${d.severity}]: ${d.message}`);

describe('MVP acceptance', () => {
  it('registers every rule', () => {
    expect(RULES.length).toBeGreaterThanOrEqual(28);
  });

  it.each(['adaptive', 'template'] as const)(
    'reports nothing on the clean REVTeX paper (%s mode)',
    (mode) => {
      const r = run('clean-revtex.tex', { mode });
      expect(show(r)).toEqual([]);
      expect(r.rejectedFixes).toEqual([]);
      expect(r.ruleErrors).toEqual([]);
    },
  );

  it('builds the expected outline for the clean paper', () => {
    const r = run('clean-revtex.tex');
    expect(
      r.structure.filter((u) => u.depth === 0).map((u) => [u.label, u.roles.join('+')]),
    ).toEqual([
      ['Title: Threshold behaviour of a planar stabilizer code under biased noise', 'front-matter'],
      ['Abstract', 'summary'],
      ['Introduction', 'motivation'],
      ['Preliminaries', 'prior-work+notation'],
      ['Noise model and decoder', 'methods'],
      ['Results', 'results'],
      ['Discussion', 'interpretation'],
      ['Conclusion', 'outlook'],
      ['Acknowledgments', 'acknowledgments'],
      ['Data availability', 'availability'],
      ['Decoding graph', 'supplementary'],
      ['References', 'references'],
    ]);
  });

  it('reports nothing on the clean bibliography', () => {
    const r = analyze({ text: read('references.bib'), fileName: 'references.bib', now: TEST_NOW });
    expect(show(r)).toEqual([]);
  });

  it.each(['letter-no-headings.tex', 'custom-theory.tex'])(
    'raises no structure warnings for %s in Adaptive mode',
    (file) => {
      const r = run(file, { mode: 'adaptive' });
      const structural = r.diagnostics.filter(
        (d) => d.category === 'structure' && (d.severity === 'warning' || d.severity === 'error'),
      );
      expect(structural.map((d) => d.message)).toEqual([]);
    },
  );

  it('runs no structure rules in Freeform mode', () => {
    const r = analyze({
      text: '\\documentclass{article}\\begin{document}\\section{A}\\end{document}',
      fileName: 'x.tex',
      storedSettings: { mode: 'freeform' },
    });
    expect(r.diagnostics.filter((d) => d.category === 'structure')).toEqual([]);
  });

  it('gives every diagnostic an explanation card', () => {
    const r = run('clean-revtex.tex', { mode: 'template' });
    for (const rule of RULES) expect(rule.cardId).toMatch(/^[a-z-]+$/);
    expect(r.diagnostics.every((d) => d.cardId.length > 0)).toBe(true);
  });
});
