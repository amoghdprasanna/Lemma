import type { Finding, Rule } from '../../types';

const rule: Rule = {
  id: 'hygiene/undefined-ref',
  category: 'hygiene',
  severity: 'error',
  title: 'Reference to a missing label',
  cardId: 'labels-and-refs',
  check({ model, project }) {
    const defined = new Set([...model.labels.map((l) => l.key), ...project.externalLabels]);
    const findings: Finding[] = [];
    for (const r of model.refs) {
      for (const key of r.keys) {
        if (defined.has(key)) continue;
        findings.push({
          message: project.partial
            ? `\\${r.command}{${key}} points to a label not defined in this file. It may be defined in another file of the project; if not, it will print as "??".`
            : `\\${r.command}{${key}} points to a label that does not exist, so it will print as "??". Check the spelling or add \\label{${key}}.`,
          span: r.span,
          severity: project.partial ? 'warning' : 'error',
          key,
        });
      }
    }
    return findings;
  },
};

export default rule;
