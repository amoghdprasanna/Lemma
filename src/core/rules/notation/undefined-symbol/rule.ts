import { symbolsIn } from '../../../notation/math';
import type { Finding, Rule } from '../../types';

/** Letters conventionally used without introduction. */
const EXEMPT = new Set(['d', 'e', 'i', '\\pi']);
const MAX_FINDINGS = 5;

const rule: Rule = {
  id: 'notation/undefined-symbol',
  category: 'notation',
  severity: 'learn',
  title: 'Symbol never introduced in the text',
  cardId: 'define-symbols',
  check({ model }) {
    const inline = new Set<string>();
    for (const m of model.math) {
      if (!m.display)
        for (const s of symbolsIn(model.masked.slice(m.contentSpan.start, m.contentSpan.end)))
          inline.add(s);
    }
    const findings: Finding[] = [];
    const reported = new Set<string>();
    for (const m of model.math) {
      if (!m.display) continue;
      for (const s of symbolsIn(model.masked.slice(m.contentSpan.start, m.contentSpan.end))) {
        if (inline.has(s) || EXEMPT.has(s) || reported.has(s)) continue;
        reported.add(s);
        findings.push({
          message: `${s} appears in a displayed equation but never in the running text. Readers expect each symbol to be introduced, e.g. "where ${s} is …".`,
          span: { start: m.span.start, end: Math.min(m.span.end, m.span.start + 2) },
          key: s,
        });
        if (findings.length >= MAX_FINDINGS) return findings;
      }
    }
    return findings;
  },
};

export default rule;
