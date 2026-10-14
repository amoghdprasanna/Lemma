import type { Finding, Rule } from '../../types';

const rule: Rule = {
  id: 'citations/undefined-cite',
  category: 'citations',
  severity: 'warning',
  title: 'Citation key not in the bibliography',
  cardId: 'bibliography-doi',
  check({ model, project }) {
    const bibitems = model.macros
      .filter((m) => m.name === 'bibitem')
      .map((m) => m.args[1]?.text.trim() ?? '');
    let known: Set<string>;
    if (model.bibliography?.kind === 'thebibliography') known = new Set(bibitems);
    else if (project.bibEntries !== null) known = new Set(project.bibEntries.map((e) => e.key));
    else return []; // the .bib file has not been read yet
    const findings: Finding[] = [];
    for (const c of model.cites) {
      for (const key of c.keys) {
        if (known.has(key) || key === '*') continue;
        findings.push({
          message: `\\${c.command}{${key}}: no bibliography entry has the key "${key}", so it will print as [?]. Check the spelling against your .bib file.`,
          span: c.span,
          key,
        });
      }
    }
    return findings;
  },
};

export default rule;
