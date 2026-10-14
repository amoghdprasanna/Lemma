import { contains } from '../../../model/text';
import { findAcronyms, usesAcronymPackage } from '../../../notation/acronyms';
import type { Finding, Rule } from '../../types';

const rule: Rule = {
  id: 'notation/acronym-redefined',
  category: 'notation',
  severity: 'info',
  title: 'Acronym defined twice',
  cardId: 'acronyms',
  check({ model, lines }) {
    if (usesAcronymPackage(model)) return [];
    const abs = model.abstract?.contentSpan;
    const findings: Finding[] = [];
    for (const a of findAcronyms(model)) {
      const defs = a.definitions.filter((d) => !abs || !contains(abs, d.span));
      const first = defs[0];
      for (const d of defs.slice(1)) {
        findings.push({
          message: `"${a.acronym}" is spelled out again here; it was already defined on line ${String(first ? lines.locate(first.span.start).line : 0)}. Define it once, at first use.`,
          span: d.span,
          key: a.acronym,
        });
      }
    }
    return findings;
  },
};

export default rule;
