import type { Rule } from '../../types';
import { arxivId } from '../missing-doi/rule';

/** Flag only: Lemma makes no network lookups. */
const rule: Rule = {
  id: 'citations/arxiv-published',
  category: 'citations',
  severity: 'info',
  title: 'arXiv preprint that may be published',
  cardId: 'bibliography-doi',
  check({ model, now }) {
    return model.bibEntries
      .filter((e) => {
        const id = arxivId(e);
        if (id === null || e.fields.doi) return false;
        if (e.fields.journal && !/arxiv/i.test(e.fields.journal)) return false;
        const year = Number.parseInt(e.fields.year ?? '', 10);
        return Number.isFinite(year) && year <= now.getUTCFullYear() - 1;
      })
      .map((e) => ({
        message: `"${e.key}" cites arXiv:${arxivId(e) ?? ''} from ${e.fields.year ?? ''}. Preprints this old are often published by now; check its arXiv page for a journal reference and cite the published version if there is one.`,
        span: { start: e.span.start, end: e.span.start + e.type.length + 1 + e.key.length + 1 },
        key: e.key,
      }));
  },
};

export default rule;
