import { CARDS, type Card } from './cards';

/**
 * Finds the learning cards that best match a free-text question, so a topic
 * question is answered from curated notes (and still gets the notes when the
 * on-device model is off). Plain keyword overlap: the card set is small.
 */
const STOPWORDS = new Set(
  'about after also and are can could does for from have how into its should that the their them then there these this use used using what when where which while who why will with would your you'.split(
    ' ',
  ),
);

/** Lower-cased search terms; `\eqref` and `eqref` are the same term. */
export function terms(text: string): string[] {
  const words = text.toLowerCase().match(/[a-z][a-z0-9-]*/g) ?? [];
  return [...new Set(words.filter((w) => w.length >= 3 && !STOPWORDS.has(w)))];
}

/** Cards that share terms with the question, best first. Title hits count triple. */
export function relatedCards(question: string, cards: readonly Card[] = CARDS, limit = 3): Card[] {
  const wanted = terms(question);
  if (wanted.length === 0) return [];
  return cards
    .map((card) => {
      const title = new Set(terms(`${card.id} ${card.title}`));
      const body = new Set(terms(card.body));
      const score = wanted.reduce(
        (sum, t) => sum + (title.has(t) ? 3 : 0) + (body.has(t) ? 1 : 0),
        0,
      );
      return { card, score };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score || a.card.title.localeCompare(b.card.title))
    .slice(0, limit)
    .map((x) => x.card);
}
