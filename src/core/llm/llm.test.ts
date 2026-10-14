import { describe, expect, it } from 'vitest';
import { filterExplanation, parseRoleSuggestion } from './filter';
import { clip, explainPrompt, rolePrompt, ROLE_SCHEMA, SYSTEM_PROMPT } from './prompts';

describe('LLM prompts', () => {
  it('forbids writing paper content', () => {
    expect(SYSTEM_PROMPT).toMatch(/Never write, rewrite/);
    expect(SYSTEM_PROMPT).toMatch(/Never judge whether the physics is correct/);
  });

  it('only sends a clipped snippet, never the whole paper', () => {
    const huge = 'word '.repeat(10_000);
    const p = explainPrompt({ title: 't', card: 'c', message: 'm', snippet: huge });
    expect(p.length).toBeLessThan(2500);
    expect(clip('a  b\n c')).toBe('a b c');
  });

  it('constrains role labels to known roles', () => {
    expect(ROLE_SCHEMA.properties.roles.items.enum).toContain('results');
    expect(rolePrompt({ heading: 'Encoding scheme', excerpt: 'We encode…' })).toContain(
      'Encoding scheme',
    );
  });
});

describe('filterExplanation', () => {
  it('accepts a short explanation, plain or as JSON', () => {
    expect(
      filterExplanation(
        'Your figure label comes before the caption, so \\ref prints the section number.',
      ),
    ).toMatchObject({ ok: true });
    expect(
      filterExplanation('{"explanation":"Use \\\\eqref so equation numbers get parentheses."}'),
    ).toEqual({
      ok: true,
      text: 'Use \\eqref so equation numbers get parentheses.',
    });
  });

  it.each([
    ['Here is a revised abstract: We study…'],
    ['You could write: "Quantum error correction (QEC) is…"'],
    ['In this paper, we show that the threshold increases.'],
    ['\\section{Results} Our results…'],
    ['```latex\n\\eqref{x}\n```'],
    ['x'.repeat(1000)],
    ['One. Two. Three. Four. Five. Six. Seven.'],
    ['{"wrong": 1}'],
    [''],
  ])('rejects %s', (text) => {
    expect(filterExplanation(text).ok).toBe(false);
  });
});

describe('parseRoleSuggestion', () => {
  it('accepts valid roles only', () => {
    expect(parseRoleSuggestion('{"roles":["methods","results"],"confidence":0.8}')).toEqual({
      roles: ['methods', 'results'],
      confidence: 0.8,
    });
    expect(parseRoleSuggestion('{"roles":["methods","dessert"],"confidence":0.8}')).toBeNull();
    expect(parseRoleSuggestion('{"roles":[]}')).toBeNull();
    expect(parseRoleSuggestion('not json')).toBeNull();
  });
});
