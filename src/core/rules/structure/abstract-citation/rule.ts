import { contains } from '../../../model/text';
import { mechanical } from '../../../fixes/text-edit';
import type { Finding, Rule } from '../../types';

const rule: Rule = {
  id: 'structure/abstract-citation',
  category: 'structure',
  severity: 'warning',
  title: 'Citation in the abstract',
  cardId: 'abstract',
  check({ model }) {
    const abs = model.abstract;
    if (!abs) return [];
    return model.cites
      .filter((c) => contains(abs.contentSpan, c.span))
      .map((c): Finding => {
        // Remove the citation together with the space or tie in front of it.
        const before =
          /[ \t~]*$/.exec(model.text.slice(abs.contentSpan.start, c.span.start))?.[0] ?? '';
        return {
          message:
            'The abstract cites a reference. Abstracts are read on their own (in databases and on arXiv), so they should not depend on citations.',
          span: c.span,
          fixes: [
            {
              title: 'Remove the citation from the abstract',
              edits: [mechanical(c.span.start - before.length, c.span.end, '')],
            },
          ],
        };
      });
  },
};

export default rule;
