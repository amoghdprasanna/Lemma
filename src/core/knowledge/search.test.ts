import { describe, expect, it } from 'vitest';
import { relatedCards, terms } from './search';

describe('relatedCards', () => {
  it('normalises LaTeX commands and drops filler words', () => {
    expect(terms('When should I use \\eqref?')).toEqual(['eqref']);
  });

  it('finds the note a question is about', () => {
    expect(relatedCards('When should I use \\eqref?')[0]?.id).toBe('eqref');
    expect(relatedCards('What goes in an abstract?').map((c) => c.id)).toContain('abstract');
  });

  it('returns at most `limit` cards, and none for unrelated text', () => {
    expect(relatedCards('paper section equation figure', undefined, 2).length).toBeLessThanOrEqual(
      2,
    );
    expect(relatedCards('zzzz qqqq')).toEqual([]);
    expect(relatedCards('   ')).toEqual([]);
  });
});
