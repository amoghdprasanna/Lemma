import type { BibEntry } from '../../../model/types';
import type { Rule } from '../../types';

const CHECKED_TYPES = new Set([
  'article',
  'inproceedings',
  'misc',
  'unpublished',
  'online',
  'preprint',
]);

export function arxivId(e: BibEntry): string | null {
  const f = e.fields;
  if (f.eprint && /arxiv/i.test(f.archiveprefix ?? f.eprinttype ?? 'arxiv')) return f.eprint;
  const m = /(?:arxiv[:\s]*|arxiv\.org\/abs\/)(\d{4}\.\d{4,5}|[a-z-]+\/\d{7})/i.exec(
    `${f.journal ?? ''} ${f.url ?? ''} ${f.note ?? ''} ${f.howpublished ?? ''}`,
  );
  return m?.[1] ?? null;
}

const rule: Rule = {
  id: 'citations/missing-doi',
  category: 'citations',
  severity: 'info',
  title: 'Reference without DOI or arXiv ID',
  cardId: 'bibliography-doi',
  check({ model }) {
    return model.bibEntries
      .filter((e) => CHECKED_TYPES.has(e.type) && !e.fields.doi && arxivId(e) === null)
      .map((e) => ({
        message: `"${e.key}" has neither a DOI nor an arXiv identifier, so readers (and reference managers) cannot link to it reliably.`,
        span: { start: e.span.start, end: e.span.start + e.type.length + 1 + e.key.length + 1 },
        key: e.key,
      }));
  },
};

export default rule;
