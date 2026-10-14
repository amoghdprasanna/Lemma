import { contains } from '../../../model/text';
import { findAcronyms, KNOWN_ACRONYMS, usesAcronymPackage } from '../../../notation/acronyms';
import type { Finding, Rule } from '../../types';

/** Acronyms in the main text (outside the abstract, which is its own scope). */
const rule: Rule = {
  id: 'notation/acronym-definition',
  category: 'notation',
  severity: 'warning',
  title: 'Acronym not spelled out at first use',
  cardId: 'acronyms',
  check({ model, lines }) {
    if (usesAcronymPackage(model)) return [];
    const abs = model.abstract?.contentSpan;
    const inBody = (s: { start: number; end: number }) => !abs || !contains(abs, s);
    const findings: Finding[] = [];
    for (const a of findAcronyms(model)) {
      const uses = a.uses.filter(inBody);
      const defs = a.definitions.filter((d) => inBody(d.span));
      const first = uses[0];
      if (!first) continue;
      const expansion = KNOWN_ACRONYMS[a.acronym] ?? a.definitions[0]?.expansion;
      const firstDef = defs[0];
      if (firstDef) {
        if (firstDef.span.start <= first.start) continue;
        findings.push({
          message: `"${a.acronym}" is used before it is spelled out on line ${String(lines.locate(firstDef.span.start).line)}. Move the definition to the first use.`,
          span: first,
          key: a.acronym,
        });
      } else if (a.definitions.length > 0) {
        findings.push({
          message: `"${a.acronym}" is spelled out only in the abstract. Define it again at its first use in the main text.`,
          span: first,
          key: a.acronym,
        });
      } else if (expansion !== undefined) {
        findings.push({
          message: `"${a.acronym}" is never spelled out. At its first use, write it in full, e.g. "${expansion} (${a.acronym})".`,
          span: first,
          severity: a.acronym === 'CNOT' || a.acronym === 'GHZ' ? 'info' : 'warning',
          key: a.acronym,
        });
      }
    }
    return findings;
  },
};

export default rule;
