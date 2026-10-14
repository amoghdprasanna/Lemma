import type { Finding, Rule } from '../../types';

/**
 * Figures and tables should be mentioned in the text; unreferenced equation
 * labels are only a learning note (numbering every display is a valid style);
 * section labels are exempt (labelling every section is common and harmless).
 */
const rule: Rule = {
  id: 'hygiene/unused-label',
  category: 'hygiene',
  severity: 'info',
  title: 'Label never referenced',
  cardId: 'labels-and-refs',
  check({ model, project }) {
    // Other files may reference it; only judge when the whole project is known.
    if (project.partial) return [];
    const referenced = new Set([...model.refs.flatMap((r) => r.keys), ...project.externalRefs]);
    const findings: Finding[] = [];
    for (const l of model.labels) {
      if (referenced.has(l.key) || l.kind === 'section') continue;
      findings.push(
        l.kind === 'figure' || l.kind === 'table'
          ? {
              message: `This ${l.kind} (\\label{${l.key}}) is never referred to in the text. Readers expect every ${l.kind} to be mentioned where it is relevant.`,
              span: l.span,
              key: l.key,
            }
          : {
              message: `\\label{${l.key}} is never referenced. That is fine if you number every equation; otherwise the label is unnecessary.`,
              span: l.span,
              severity: 'learn',
              key: l.key,
            },
      );
    }
    return findings;
  },
};

export default rule;
