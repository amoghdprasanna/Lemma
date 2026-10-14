import { describe, expect, it } from 'vitest';
import { parseLog } from './parse';

const CLASSIC =
  String.raw`This is pdfTeX, Version 3.141592653-2.6-1.40.26 (TeX Live 2025)
(./main.tex
LaTeX2e <2024-11-01>
! Undefined control sequence.
l.42 The state \kett
                    {\psi} is prepared.
! Missing $ inserted.
<inserted text>
                $
l.57 where x_
             1 is
LaTeX Warning: Reference ` +
  '`' +
  String.raw`eq:missing' on page 2 undefined on input line 63.

LaTeX Warning: Citation ` +
  '`' +
  String.raw`smith2020' on page 3 undefined on input line 70.

Overfull \hbox (15.2pt too wide) in paragraph at lines 80--82
LaTeX Warning: There were undefined references.
`;

describe('parseLog', () => {
  const entries = parseLog(CLASSIC);

  it('finds errors with line numbers and translations', () => {
    const errors = entries.filter((e) => e.level === 'error');
    expect(errors.map((e) => [e.line, e.file, e.translation?.title])).toEqual([
      [42, 'main.tex', 'Unknown command \\kett'],
      [57, 'main.tex', 'Math used outside math mode'],
    ]);
  });

  it('finds warnings and typesetting issues', () => {
    expect(
      entries
        .filter((e) => e.level !== 'error')
        .map((e) => [e.level, e.line, e.translation?.title]),
    ).toEqual([
      ['warning', 63, 'Undefined reference eq:missing'],
      ['warning', 70, 'Undefined citation smith2020'],
      ['typesetting', 80, 'Line 15.2 pt too wide'],
      ['warning', null, 'Some references are undefined'],
    ]);
  });

  it('understands -file-line-error output', () => {
    const [e] = parseLog('./sections/intro.tex:12: LaTeX Error: Environment algin undefined.\n');
    expect(e).toMatchObject({
      level: 'error',
      file: 'sections/intro.tex',
      line: 12,
      translation: { title: 'Unknown environment algin' },
    });
  });

  it('keeps untranslated messages', () => {
    const [e] = parseLog('! Some brand new error.\nl.3 x\n');
    expect(e?.translation).toBeNull();
    expect(e?.raw).toContain('Some brand new error.');
  });
});
