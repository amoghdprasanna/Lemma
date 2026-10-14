/**
 * Learning cards: short Markdown notes in /knowledge/cards, each citing real
 * sources. `status` says whether a convention is a rule, a style choice, or
 * reference material, so Lemma never presents taste as law.
 */
export type CardStatus = 'rule' | 'style-choice' | 'reference';

export interface Card {
  id: string;
  title: string;
  status: CardStatus;
  sources: { title: string; url: string }[];
  body: string;
}

const raw = import.meta.glob<string>('/knowledge/cards/*.md', {
  query: '?raw',
  import: 'default',
  eager: true,
});

function unquote(v: string): string {
  const t = v.trim();
  if (t.startsWith('"')) return JSON.parse(t) as string;
  // YAML single quotes: '' is an escaped quote, nothing else is special.
  if (t.startsWith("'") && t.endsWith("'") && t.length >= 2)
    return t.slice(1, -1).replace(/''/g, "'");
  return t;
}

/** Parses the small YAML subset the cards use (scalars and a list of title/url pairs). */
export function parseCard(text: string): Card {
  const m = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/.exec(text);
  if (!m) throw new Error('Card is missing frontmatter');
  const fields: Record<string, string> = {};
  const sources: { title: string; url: string }[] = [];
  for (const line of (m[1] ?? '').split('\n')) {
    const item = /^\s+- title:\s*(.*)$/.exec(line);
    const url = /^\s+url:\s*(.*)$/.exec(line);
    const field = /^(\w+):\s*(.*)$/.exec(line);
    if (item) sources.push({ title: unquote(item[1] ?? ''), url: '' });
    else if (url) {
      const last = sources[sources.length - 1];
      if (last) last.url = (url[1] ?? '').trim();
    } else if (field && field[1] !== 'sources') fields[field[1] ?? ''] = unquote(field[2] ?? '');
  }
  const status = fields.status;
  if (status !== 'rule' && status !== 'style-choice' && status !== 'reference') {
    throw new Error(`Card ${fields.id ?? '?'} has invalid status "${status ?? ''}"`);
  }
  return {
    id: fields.id ?? '',
    title: fields.title ?? '',
    status,
    sources,
    body: (m[2] ?? '').trim(),
  };
}

export const CARDS: readonly Card[] = Object.values(raw)
  .map(parseCard)
  .sort((a, b) => a.title.localeCompare(b.title));

export function findCard(id: string): Card | undefined {
  return CARDS.find((c) => c.id === id);
}

/** First paragraph of a card, for compact display. */
export function cardSummary(card: Card): string {
  return (
    card.body
      .split(/\n\s*\n/)[0]
      ?.replace(/\s+/g, ' ')
      .trim() ?? ''
  );
}
