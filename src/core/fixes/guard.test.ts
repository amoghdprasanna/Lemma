import { describe, expect, it } from 'vitest';
import { checkFix, proseTokens } from './guard';
import { ABSTRACT_PROMPT, sectionSkeleton } from './skeleton';
import { applyEdits, normalizeEdits, type Fix, type TextEdit } from './text-edit';

const TEXT = String.raw`\documentclass{article}
\begin{document}
See Eq.~(\ref{eq:a}) and Ref. \cite{x}.
$$ y $$
\end{document}
`;

const fix = (...edits: TextEdit[]): Fix => ({ title: 't', edits });
const at = (s: string) => TEXT.indexOf(s);

describe('content guard (ADR-0003)', () => {
  it('accepts mechanical rewrites that only re-mark existing tokens', () => {
    const s = at('(\\ref{eq:a})');
    expect(
      checkFix(fix({ kind: 'mechanical', start: s, end: s + 12, insert: '\\eqref{eq:a}' }), TEXT),
    ).toEqual({ ok: true });
    const sp = at(' \\cite');
    expect(
      checkFix(fix({ kind: 'mechanical', start: sp, end: sp + 1, insert: '~' }), TEXT),
    ).toEqual({ ok: true });
  });

  it('accepts a move split across two edits', () => {
    const s = at('Ref.');
    const move = fix(
      { kind: 'mechanical', start: s, end: s + 4, insert: '' },
      { kind: 'mechanical', start: at('$$ y'), end: at('$$ y'), insert: 'Ref.' },
    );
    expect(checkFix(move, TEXT)).toEqual({ ok: true });
  });

  it.each([
    ['new words', { kind: 'mechanical' as const, start: 0, end: 0, insert: 'We prove a theorem.' }],
    ['a comment', { kind: 'mechanical' as const, start: 0, end: 0, insert: '% note' }],
    [
      'an uncurated skeleton comment',
      { kind: 'skeleton' as const, start: 0, end: 0, insert: '% TODO: our main result is that…' },
    ],
    [
      'an uncurated heading',
      { kind: 'skeleton' as const, start: 0, end: 0, insert: '\\section{Our amazing results}' },
    ],
    ['a skeleton that replaces text', { kind: 'skeleton' as const, start: 0, end: 10, insert: '' }],
    ['arbitrary settings', { kind: 'settings' as const, start: 0, end: 0, insert: 'hello' }],
    [
      'malformed settings',
      { kind: 'settings' as const, start: 0, end: 0, insert: '% lemma: mode=chaos' },
    ],
    ['out-of-range edits', { kind: 'mechanical' as const, start: 0, end: 10_000, insert: '' }],
  ])('rejects %s', (_label, edit) => {
    expect(checkFix(fix(edit), TEXT).ok).toBe(false);
  });

  it('rejects empty and overlapping fixes', () => {
    expect(checkFix(fix(), TEXT).ok).toBe(false);
    expect(
      checkFix(
        fix(
          { kind: 'mechanical', start: 0, end: 5, insert: '' },
          { kind: 'mechanical', start: 3, end: 8, insert: '' },
        ),
        TEXT,
      ).ok,
    ).toBe(false);
  });

  it('accepts curated skeletons and valid settings', () => {
    const edit = sectionSkeleton('results', at('\\end{document}'), false);
    if (!edit) throw new Error('no skeleton');
    expect(checkFix(fix(edit), TEXT)).toEqual({ ok: true });
    expect(
      checkFix(
        fix({
          kind: 'skeleton',
          start: 0,
          end: 0,
          insert: `\\begin{abstract}\n% ${ABSTRACT_PROMPT}\n\\end{abstract}\n`,
        }),
        TEXT,
      ),
    ).toEqual({ ok: true });
    expect(
      checkFix(
        fix({
          kind: 'settings',
          start: 0,
          end: 0,
          insert: '% lemma: mode=template, profile=builtin/review\n',
        }),
        TEXT,
      ),
    ).toEqual({ ok: true });
  });

  it('never lets random prose through as a mechanical or skeleton edit', () => {
    // Deterministic pseudo-random sentences from a physics vocabulary.
    const words = [
      'we',
      'show',
      'that',
      'the',
      'threshold',
      'qubit',
      'code',
      'error',
      'rate',
      'improves',
      'bound',
      'theorem',
      'surface',
      'noise',
      'decoder',
    ];
    let seed = 7;
    const rand = () => (seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31;
    for (let i = 0; i < 300; i++) {
      const n = 3 + Math.floor(rand() * 12);
      const sentence =
        Array.from({ length: n }, () => words[Math.floor(rand() * words.length)]).join(' ') + '.';
      for (const kind of ['mechanical', 'skeleton'] as const) {
        expect(checkFix(fix({ kind, start: 0, end: 0, insert: sentence }), TEXT).ok).toBe(false);
        expect(checkFix(fix({ kind, start: 0, end: 0, insert: `% ${sentence}` }), TEXT).ok).toBe(
          false,
        );
      }
    }
  });

  it('tokenises without TeX commands and ignores case', () => {
    expect(proseTokens('\\qty{5}{\\giga\\hertz} Tr')).toEqual(['5', 'tr']);
  });
});

describe('text edits', () => {
  it('applies edits back to front and rejects overlaps or bad ranges', () => {
    expect(
      applyEdits('abcdef', [
        { kind: 'mechanical', start: 4, end: 6, insert: 'X' },
        { kind: 'mechanical', start: 0, end: 1, insert: 'Y' },
      ]),
    ).toBe('YbcdX');
    expect(() =>
      applyEdits('abc', [
        { kind: 'mechanical', start: 0, end: 2, insert: '' },
        { kind: 'mechanical', start: 1, end: 3, insert: '' },
      ]),
    ).toThrow('Overlapping');
    expect(() => applyEdits('abc', [{ kind: 'mechanical', start: 2, end: 9, insert: '' }])).toThrow(
      'out of range',
    );
    expect(normalizeEdits([])).toEqual([]);
  });
});
