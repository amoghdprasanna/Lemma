import type { Finding, Rule } from '../../types';

const rule: Rule = {
  id: 'hygiene/duplicate-label',
  category: 'hygiene',
  severity: 'error',
  title: 'Label defined twice',
  cardId: 'labels-and-refs',
  check({ model, project }) {
    const seen = new Set<string>(project.externalLabels);
    const findings: Finding[] = [];
    for (const l of model.labels) {
      if (seen.has(l.key)) {
        findings.push({
          message: `\\label{${l.key}} is defined more than once, so references to it are ambiguous ("multiply defined" warning).`,
          span: l.span,
          key: l.key,
        });
      }
      seen.add(l.key);
    }
    return findings;
  },
};

export default rule;
