import { SKELETON_TEMPLATES } from '../../../fixes/skeleton';
import type { Finding, Rule } from '../../types';

const rule: Rule = {
  id: 'structure/empty-section',
  category: 'structure',
  severity: 'warning',
  title: 'Empty section',
  cardId: 'paper-roles',
  check({ model, structure }) {
    const findings: Finding[] = [];
    for (const s of model.sections) {
      const next = model.sections[s.index + 1];
      if (next && next.level > s.level) continue; // has subsections
      const body = model.masked
        .slice(s.bodySpan.start, s.bodySpan.end)
        .replace(/\\label\s*\{[^}]*\}/g, '')
        .trim();
      if (body !== '') continue;
      const unit = structure.find((u) => u.sectionIndex === s.index);
      const template = unit?.roles.map((r) => SKELETON_TEMPLATES[r]).find((t) => t !== undefined);
      findings.push({
        message: `"${s.title}" has no content yet.`,
        span: s.headingSpan,
        ...(template
          ? {
              fixes: [
                {
                  title: 'Add a TODO prompt for this section',
                  edits: [
                    {
                      kind: 'skeleton' as const,
                      start: s.headingSpan.end,
                      end: s.headingSpan.end,
                      insert: `\n% ${template.prompt}`,
                    },
                  ],
                },
              ],
            }
          : {}),
      });
    }
    return findings;
  },
};

export default rule;
