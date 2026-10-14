import { mechanical } from '../../../fixes/text-edit';
import type { Finding, Rule } from '../../types';
import type { Span } from '../../../model/types';

const TIED = /([A-Za-z0-9.)\]])([ \t]+|[ \t]*\n[ \t]*)$/;
/** After a full stop, only abbreviations ("Ref.", "Fig.") call for a tie; otherwise a new sentence starts. */
const ABBREVIATION =
  /\b(?:Refs?|Figs?|Secs?|Eqs?|Apps?|Tabs?|Chs?|Thms?|Lems?|Defs?|Props?|Cors?|al|cf|e\.g|i\.e|Ref|No|Nos)\.$/;

const rule: Rule = {
  id: 'hygiene/nbsp-before-ref',
  category: 'hygiene',
  severity: 'warning',
  title: 'Missing ~ before \\cite or \\ref',
  cardId: 'nonbreaking-space',
  check({ model }) {
    const targets: { span: Span; what: string }[] = [
      ...model.refs
        .filter((r) => r.command !== 'pageref')
        .map((r) => ({ span: r.span, what: `\\${r.command}` })),
      ...model.cites
        .filter((c) => c.command !== 'nocite')
        .map((c) => ({ span: c.span, what: `\\${c.command}` })),
    ];
    const findings: Finding[] = [];
    for (const t of targets) {
      const before = model.masked.slice(Math.max(0, t.span.start - 40), t.span.start);
      const m = TIED.exec(before);
      const ws = m?.[2];
      if (ws === undefined) continue;
      if (m?.[1] === '.' && !ABBREVIATION.test(before.slice(0, before.length - ws.length)))
        continue;
      const start = t.span.start - ws.length;
      findings.push({
        message: `Use a non-breaking space (~) before ${t.what} so the number never starts a new line on its own.`,
        span: t.span,
        fixes: [
          { title: 'Replace the space with ~', edits: [mechanical(start, t.span.start, '~')] },
        ],
      });
    }
    return findings;
  },
};

export default rule;
