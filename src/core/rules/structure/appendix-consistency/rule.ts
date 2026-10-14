import { proseMask } from '../../../notation/prose-mask';
import type { Finding, Rule } from '../../types';

const MENTION =
  /\b(?:Appendix|Appendices|appendix|appendices|Supplemental Material|Supplementary Material)\b/;

const rule: Rule = {
  id: 'structure/appendix-consistency',
  category: 'structure',
  severity: 'warning',
  title: 'Appendix and main text disagree',
  cardId: 'appendices',
  check({ model, project, structure }) {
    if (model.kind !== 'tex' || !model.isMain || project.partial) return [];
    const findings: Finding[] = [];
    const prose = proseMask(model);
    const mainEnd = model.appendixStart ?? model.bodySpan.end;
    const mainText = prose.slice(model.bodySpan.start, mainEnd);
    const appendixLabels = new Set(model.labels.filter((l) => l.inAppendix).map((l) => l.key));
    const hasAppendix =
      model.appendixStart !== null || structure.some((u) => u.roles.includes('supplementary'));

    const mention = MENTION.exec(mainText);
    if (!hasAppendix && mention) {
      const start = model.bodySpan.start + mention.index;
      findings.push({
        message: `The main text mentions "${mention[0]}", but the document has no appendix (no \\appendix). If the material lives in a separate supplemental file, this is fine.`,
        span: { start, end: start + mention[0].length },
      });
    }

    if (model.appendixStart !== null && model.sections.some((s) => s.inAppendix)) {
      const referenced = model.refs.some(
        (r) => !r.inAppendix && r.keys.some((k) => appendixLabels.has(k)),
      );
      if (!referenced && !mention) {
        findings.push({
          message:
            'Nothing in the main text points to the appendices. Readers only find them if the main text says when to look (e.g. "see Appendix A").',
          span: { start: model.appendixStart, end: model.appendixStart + '\\appendix'.length },
          severity: 'info',
        });
      }
    }
    return findings;
  },
};

export default rule;
