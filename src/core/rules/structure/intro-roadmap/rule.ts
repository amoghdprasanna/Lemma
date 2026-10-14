import type { Rule } from '../../types';

const ROADMAP =
  /\\(?:[cC]ref|ref|autoref|nameref)\s*\{\s*(?:sec|app|ch|s)[:.-]|\bSecs?\.\s*~?\s*\\ref|\bSections?\s*~?\s*\\ref|\b(?:the )?(?:rest|remainder) of (?:this|the) (?:paper|article|manuscript|work)\b|\b(?:organi[sz]ed|structured) as follows\b|\bin Sec(?:tion)?\.?\s|\bthis (?:paper|article|manuscript) is (?:organi[sz]ed|structured)\b/i;

/** Learn-level: an introduction usually ends with a roadmap of the paper. */
const rule: Rule = {
  id: 'structure/intro-roadmap',
  category: 'structure',
  severity: 'learn',
  title: 'No roadmap in the introduction',
  cardId: 'introduction-roadmap',
  check({ model, structure }) {
    const top = structure.filter((u) => u.kind === 'section' && u.depth === 0 && !u.inAppendix);
    if (top.length < 3) return [];
    const intro = top.find((u) => u.roles.includes('motivation'));
    if (!intro || intro.words < 50) return [];
    if (ROADMAP.test(model.masked.slice(intro.span.start, intro.span.end))) return [];
    return [
      {
        message: `"${intro.label}" has no roadmap paragraph. Readers of longer papers find a short "Section II describes…, Section III…" guide useful.`,
        span: model.sections[intro.sectionIndex ?? 0]?.headingSpan ?? intro.span,
      },
    ];
  },
};

export default rule;
