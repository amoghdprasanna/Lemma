import { describe, expect, it } from 'vitest';
import { RULES } from '../rules/registry';
import { ROLE_INFO } from '../structure/roles';
import { CARDS, cardSummary, findCard, parseCard } from './cards';

describe('learning cards', () => {
  it('loads every card with an id, title, status and at least one real source', () => {
    expect(CARDS.length).toBeGreaterThanOrEqual(20);
    for (const c of CARDS) {
      expect(c.id).toMatch(/^[a-z-]+$/);
      expect(c.title.length).toBeGreaterThan(3);
      expect(c.sources.length).toBeGreaterThan(0);
      for (const s of c.sources) expect(s.url).toMatch(/^https:\/\//);
      expect(c.body.length).toBeGreaterThan(100);
    }
  });

  it('has unique ids', () => {
    expect(new Set(CARDS.map((c) => c.id)).size).toBe(CARDS.length);
  });

  it('covers every rule and role', () => {
    const ids = [
      ...RULES.map((r) => r.cardId),
      ...Object.values(ROLE_INFO).map((r) => r.cardId),
      'compile-errors',
      'structure-modes',
    ];
    for (const id of ids) expect(findCard(id), id).toBeDefined();
  });

  it('labels conventions that are not hard rules as style choices', () => {
    for (const id of ['abstract', 'section-order', 'ket-notation', 'siunitx-units']) {
      expect(findCard(id)?.status).toBe('style-choice');
    }
  });

  it('parses frontmatter and summarises', () => {
    const c = parseCard(
      '---\nid: x\ntitle: "A \\"t\\""\nstatus: rule\nsources:\n  - title: "S"\n    url: https://e.org\n---\n\nFirst para\ncontinues.\n\nSecond.',
    );
    expect(c).toMatchObject({
      id: 'x',
      title: 'A "t"',
      status: 'rule',
      sources: [{ title: 'S', url: 'https://e.org' }],
    });
    expect(cardSummary(c)).toBe('First para continues.');
    expect(() => parseCard('no frontmatter')).toThrow();
  });
});
