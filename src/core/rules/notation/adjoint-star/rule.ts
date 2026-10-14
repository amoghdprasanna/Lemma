import { findAdjoints } from '../../../notation/math';
import type { Finding, Rule } from '../../types';

const rule: Rule = {
  id: 'notation/adjoint-star',
  category: 'notation',
  severity: 'learn',
  title: '^* and ^\\dagger on the same symbol',
  cardId: 'dagger-vs-star',
  check({ model }) {
    const occ = findAdjoints(model);
    const daggered = new Set(occ.filter((o) => o.mark === 'dagger').map((o) => o.base));
    const findings: Finding[] = [];
    const reported = new Set<string>();
    for (const o of occ) {
      if (o.mark !== 'star' || !daggered.has(o.base) || reported.has(o.base)) continue;
      reported.add(o.base);
      findings.push({
        message: `${o.base} appears with both ^\\dagger and ^*. In quantum information, A^\\dagger is the adjoint (conjugate transpose) and z^* the complex conjugate. If you mean the adjoint here, write ^\\dagger.`,
        span: o.span,
        key: o.base,
      });
    }
    return findings;
  },
};

export default rule;
