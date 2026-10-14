import { mechanical } from '../../../fixes/text-edit';
import type { Rule } from '../../types';

const rule: Rule = {
  id: 'hygiene/display-dollars',
  category: 'hygiene',
  severity: 'warning',
  title: '$$…$$ display math',
  cardId: 'display-math',
  check({ model }) {
    return model.math
      .filter((m) => m.delimiter === '$$')
      .map((m) => ({
        message:
          '$$…$$ is plain-TeX syntax and gives inconsistent spacing in LaTeX. Use \\[…\\], or an equation environment if you want a number.',
        span: { start: m.span.start, end: m.span.start + 2 },
        fixes: [
          {
            title: 'Replace $$…$$ with \\[…\\]',
            edits: [
              mechanical(m.span.start, m.span.start + 2, '\\['),
              mechanical(m.span.end - 2, m.span.end, '\\]'),
            ],
          },
        ],
      }));
  },
};

export default rule;
