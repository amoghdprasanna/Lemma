import { profilePosition } from '../../../structure/infer';
import type { Finding, Rule } from '../../types';

/** Template mode only: ordering preferences are informational, never errors. */
const rule: Rule = {
  id: 'structure/section-order',
  category: 'structure',
  severity: 'info',
  title: 'Order differs from profile',
  cardId: 'section-order',
  check({ settings, profile, structure, model }) {
    if (settings.mode !== 'template') return [];
    const findings: Finding[] = [];
    let max = -1;
    let maxLabel = '';
    for (const u of structure) {
      if (u.depth !== 0 || u.inAppendix) continue;
      const pos = profilePosition(profile, u.roles);
      if (pos === -1) continue;
      if (pos < max) {
        findings.push({
          message: `In the ${profile.name} profile, "${profile.sections[pos]?.title ?? u.label}" usually comes before "${maxLabel}". Reordering is optional.`,
          span:
            u.sectionIndex !== null
              ? (model.sections[u.sectionIndex]?.headingSpan ?? u.span)
              : u.span,
        });
      } else {
        max = pos;
        maxLabel = profile.sections[pos]?.title ?? u.label;
      }
    }
    return findings;
  },
};

export default rule;
