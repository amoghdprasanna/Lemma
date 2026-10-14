import { contains } from '../../../model/text';
import { findAcronyms, KNOWN_ACRONYMS, usesAcronymPackage } from '../../../notation/acronyms';
import type { Finding, Rule } from '../../types';

const rule: Rule = {
  id: 'structure/abstract-acronym',
  category: 'structure',
  severity: 'warning',
  title: 'Undefined acronym in the abstract',
  cardId: 'acronyms',
  check({ model }) {
    const abs = model.abstract;
    if (!abs || usesAcronymPackage(model)) return [];
    const findings: Finding[] = [];
    for (const a of findAcronyms(model)) {
      const uses = a.uses.filter((u) => contains(abs.contentSpan, u));
      const first = uses[0];
      if (!first) continue;
      const defs = a.definitions.filter((d) => contains(abs.contentSpan, d.span));
      const known = a.acronym in KNOWN_ACRONYMS;
      const definedSomewhere = a.definitions.length > 0;
      if (!known && !definedSomewhere) continue;
      const firstDef = defs[0];
      if (firstDef && firstDef.span.start <= first.start) continue;
      const expansion = KNOWN_ACRONYMS[a.acronym] ?? a.definitions[0]?.expansion;
      findings.push({
        message: `"${a.acronym}" is used in the abstract without being spelled out there${expansion ? ` (e.g. ${expansion} (${a.acronym}))` : ''}. The abstract is read on its own, so define acronyms in it as well as in the main text.`,
        span: first,
        key: a.acronym,
      });
    }
    return findings;
  },
};

export default rule;
