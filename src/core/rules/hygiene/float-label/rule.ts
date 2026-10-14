import type { Rule } from '../../types';

const rule: Rule = {
  id: 'hygiene/float-label',
  category: 'hygiene',
  severity: 'info',
  title: 'Figure or table without a label',
  cardId: 'float-caption-label',
  check({ model }) {
    return model.floats
      .filter((f) => f.captionSpan !== null && f.labelSpans.length === 0)
      .map((f) => ({
        message: `This ${f.kind} has no \\label, so the text cannot refer to it by number.`,
        span: f.captionSpan ?? f.span,
      }));
  },
};

export default rule;
