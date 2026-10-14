import type { Rule } from '../../types';

const rule: Rule = {
  id: 'hygiene/float-caption',
  category: 'hygiene',
  severity: 'warning',
  title: 'Figure or table without a caption',
  cardId: 'float-caption-label',
  check({ model }) {
    return model.floats
      .filter((f) => f.captionSpan === null)
      .map((f) => ({
        message: `This ${f.kind} has no \\caption. Captions tell readers what they are looking at, and \\label needs one to get a number.`,
        span: {
          start: f.span.start,
          end: Math.min(f.span.end, f.span.start + `\\begin{${f.kind}}`.length),
        },
      }));
  },
};

export default rule;
