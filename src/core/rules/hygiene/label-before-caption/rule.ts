import { mechanical } from '../../../fixes/text-edit';
import type { Finding, Rule } from '../../types';

const rule: Rule = {
  id: 'hygiene/label-before-caption',
  category: 'hygiene',
  severity: 'warning',
  title: '\\label before \\caption',
  cardId: 'float-caption-label',
  check({ model }) {
    const findings: Finding[] = [];
    for (const f of model.floats) {
      const caption = f.captionSpan;
      if (!caption) continue;
      for (const l of f.labelSpans) {
        if (l.start >= caption.start) continue;
        const label = model.text.slice(l.start, l.end);
        // Take the whitespace after the label with it, so no blank line is left behind.
        const trailing = /^[ \t]*\n?[ \t]*/.exec(model.text.slice(l.end, caption.start))?.[0] ?? '';
        findings.push({
          message: `${label} comes before \\caption, so it refers to the surrounding section, not this ${f.kind}. Move it after the caption.`,
          span: l,
          fixes: [
            {
              title: 'Move the label after the caption',
              edits: [
                mechanical(l.start, l.end + trailing.length, ''),
                mechanical(caption.end, caption.end, label),
              ],
            },
          ],
        });
      }
    }
    return findings;
  },
};

export default rule;
