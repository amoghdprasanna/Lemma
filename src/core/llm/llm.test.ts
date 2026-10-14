import { describe, expect, it } from 'vitest';
import { filterExplanation, parseRoleSuggestion, parseTopicAnswer } from './filter';
import {
  clip,
  explainPrompt,
  isDraftingRequest,
  rolePrompt,
  ROLE_SCHEMA,
  SYSTEM_PROMPT,
  topicPrompt,
} from './prompts';

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

describe('topic questions', () => {
  it.each([
    'Write my abstract',
    'Can you rewrite this paragraph so it flows better?',
    'please draft an introduction about surface codes',
    'Improve the caption of figure 2',
    'How should I write my introduction for me?',
  ])('treats "%s" as a request for paper text', (q) => {
    expect(isDraftingRequest(q)).toBe(true);
  });

  it.each([
    'How should I write my introduction?',
    'What goes in a PRL abstract?',
    'When should I use \\eqref?',
    'Can you explain what siunitx does?',
    'How do I fix an undefined control sequence?',
  ])('lets "%s" through', (q) => {
    expect(isDraftingRequest(q)).toBe(false);
  });

  it('keeps the prompt small and grounded in the notes', () => {
    const p = topicPrompt({
      question: 'q'.repeat(2000),
      notes: [{ title: 'Why \\eqref', text: 'n'.repeat(5000) }],
    });
    expect(p).toContain('Why \\eqref');
    expect(p.length).toBeLessThan(2000);
    expect(topicPrompt({ question: 'x', notes: [] })).toContain('No curated note');
  });

  it('accepts an on-topic answer, including LaTeX usage examples', () => {
    expect(
      parseTopicAnswer(
        JSON.stringify({
          onTopic: true,
          answer: 'Put \\label{eq:x} inside \\begin{equation} and cite it with \\eqref{eq:x}.',
        }),
      ),
    ).toEqual({
      kind: 'answer',
      text: 'Put \\label{eq:x} inside \\begin{equation} and cite it with \\eqref{eq:x}.',
    });
  });

  it('reports off-topic questions', () => {
    expect(parseTopicAnswer('{"onTopic":false,"answer":""}')).toEqual({ kind: 'off-topic' });
  });

  it.each([
    ['drafted prose', { onTopic: true, answer: 'In this paper, we show that the code works.' }],
    ['a sectioning command', { onTopic: true, answer: '\\section{Results} The results…' }],
    ['an abstract environment', { onTopic: true, answer: '\\begin{abstract} We study…' }],
    ['a missing answer', { onTopic: true }],
  ])('drops %s', (_label, raw) => {
    expect(parseTopicAnswer(JSON.stringify(raw))).toBeNull();
  });

  it('drops malformed output', () => {
    expect(parseTopicAnswer('not json')).toBeNull();
  });
});
