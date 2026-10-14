import { proseOf } from '../../../model/text';
import { ROLE_INFO, type Role } from '../../../structure/roles';
import type { Finding, Rule } from '../../types';

const SIGNALS: Partial<Record<Role, RegExp>> = {
  results:
    /\bwe (?:find|found|observe|observed|obtain|obtained|show|demonstrate)\b|\bour results\b|\bas shown in\b/g,
  methods:
    /\bwe (?:consider|define|use|introduce|construct|propose|describe|model|assume)\b|\bconsider (?:a|an|the)\b/g,
  interpretation:
    /\b(?:this suggests|these results suggest|implies that|indicates that|we interpret|in contrast to|compared (?:to|with)|consistent with|limitations?)\b/g,
};

/** Learn-level heuristic: a section's wording points to a different role than the one it has. */
const rule: Rule = {
  id: 'structure/role-content-mismatch',
  category: 'structure',
  severity: 'learn',
  title: 'Section reads like a different role',
  cardId: 'paper-roles',
  check({ model, structure }) {
    const findings: Finding[] = [];
    for (const u of structure) {
      if (u.kind !== 'section' || u.depth !== 0 || u.source === 'override' || u.words < 80)
        continue;
      const assigned = u.roles.filter((r) => r in SIGNALS);
      if (assigned.length === 0) continue;
      const text = proseOf(model, u.span).toLowerCase();
      const score = (r: Role) => text.match(SIGNALS[r] ?? /$^/g)?.length ?? 0;
      if (assigned.some((r) => score(r) > 0)) continue;
      const other = (Object.keys(SIGNALS) as Role[])
        .filter((r) => !assigned.includes(r))
        .map((r) => [r, score(r)] as const)
        .sort((a, b) => b[1] - a[1])[0];
      if (!other || other[1] < 3) continue;
      findings.push({
        message: `"${u.label}" is labelled ${assigned.map((r) => ROLE_INFO[r].label).join(' / ')}, but its wording reads more like ${ROLE_INFO[other[0]].label}. That can be fine; if this section mainly does that job, reassign its role in the Outline.`,
        span: model.sections[u.sectionIndex ?? 0]?.headingSpan ?? u.span,
      });
    }
    return findings;
  },
};

export default rule;
