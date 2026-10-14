import { ROLES, ROLE_INFO } from '../structure/roles';

/**
 * Prompts for the on-device model. Pure, so they are unit-tested and the
 * same everywhere. The system prompt forbids writing paper content; the
 * post-filter (filter.ts) enforces it.
 */
export const SYSTEM_PROMPT = [
  'You are a LaTeX and scientific-writing tutor inside a browser extension.',
  'You explain conventions and errors to a beginner researcher in plain English.',
  'Hard rules:',
  '- Never write, rewrite, rephrase, summarise or continue the user’s paper. Do not draft sentences, abstracts, results or arguments for them.',
  '- Never judge whether the physics is correct.',
  '- Only explain the convention, error or LaTeX question you are given, using the facts provided. If unsure, say so.',
  '- Do not explain physics itself: you cover LaTeX and how papers are written, not the science.',
  '- Answer in at most four short sentences. No headings, no LaTeX sectioning commands.',
].join('\n');

/** Characters of user text sent per request; the context window is small. */
export const MAX_SNIPPET = 600;

export function clip(text: string, max = MAX_SNIPPET): string {
  const t = text.replace(/\s+/g, ' ').trim();
  return t.length <= max ? t : `${t.slice(0, max)} …`;
}

/**
 * Characters of a learning card sent per note. Every card fits whole, so the
 * model sees all of a note's facts (a test keeps new cards within it).
 */
export const MAX_NOTE = 1000;

export function explainPrompt(i: {
  title: string;
  card: string;
  message: string;
  snippet: string;
}): string {
  return [
    `Convention: ${i.title}`,
    `Facts (from a curated guide): ${clip(i.card, MAX_NOTE)}`,
    `What the checker found: ${clip(i.message, 400)}`,
    `The author's LaTeX around it: ${clip(i.snippet)}`,
    'Explain to the author, in terms of their snippet, why this matters and what kind of change would address it. Do not write replacement text for their paper.',
  ].join('\n\n');
}

export function logPrompt(i: { message: string; curated: string | null }): string {
  return [
    `LaTeX log message: ${clip(i.message, 800)}`,
    i.curated
      ? `Known explanation: ${clip(i.curated, 400)}`
      : 'There is no curated explanation for this message.',
    'Explain in plain English what probably went wrong and where to look. Do not write LaTeX for the paper beyond naming a command.',
  ].join('\n\n');
}

/** Characters of a typed topic question sent to the model. */
export const MAX_QUESTION = 300;

const DRAFT_VERB =
  /\b(?:write|draft|rewrite|re-write|rephrase|reword|paraphrase|compose|generate|polish|improve|proofread|summari[sz]e|translate|continue|finish|fix)\b/i;
const PAPER_PART =
  /\b(?:abstract|intro(?:duction)?|conclusions?|summary|paragraphs?|sentences?|sections?|captions?|discussion|results|acknowledg(?:e)?ments?|title|text|paper|letter|draft|manuscript|thesis|chapter)\b/i;
/** "How should I write my introduction?" asks for advice, which is fine. */
const ASKS_HOW = /^\s*(?:how|what|when|why|which|where|should|is|are|do|does)\b/i;
/** "Write my abstract" or "can you rephrase this paragraph" asks Lemma to do the writing. */
const ASKS_FOR_TEXT =
  /\b(?:can|could|would|will) you\b|\bfor (?:me|us)\b|^\s*(?:please\s+)?(?:write|draft|rewrite|rephrase|reword|paraphrase|compose|generate|polish|improve|proofread|summari[sz]e|translate|continue|finish|fix)\b/i;

/**
 * True when a topic question asks Lemma to write or rewrite paper text
 * (ADR-0003). Those are refused before the model sees them; questions about
 * how something is usually written are allowed.
 */
export function isDraftingRequest(question: string): boolean {
  return (
    DRAFT_VERB.test(question) &&
    PAPER_PART.test(question) &&
    (ASKS_FOR_TEXT.test(question) || !ASKS_HOW.test(question))
  );
}

export function topicPrompt(i: {
  question: string;
  notes: readonly { title: string; text: string }[];
}): string {
  const notes =
    i.notes.length > 0
      ? i.notes.map((n) => `- ${n.title}: ${clip(n.text, MAX_NOTE)}`).join('\n')
      : 'No curated note matches this question.';
  return [
    `The author asks: ${clip(i.question, MAX_QUESTION)}`,
    `Curated notes:\n${notes}`,
    'If the question is about LaTeX usage or about how physics papers are structured and written, answer it in plain English, staying within the notes where they apply, and set onTopic to true.',
    'If it asks about physics itself, asks you to judge results, or asks you to write or rewrite text for the paper, set onTopic to false and leave the answer empty.',
  ].join('\n\n');
}

export function rolePrompt(i: { heading: string; excerpt: string }): string {
  const roles = ROLES.map((r) => `- ${r}: ${ROLE_INFO[r].purpose}`).join('\n');
  return [
    'Which roles does this section of a physics paper fill? Choose from:',
    roles,
    `Section heading: ${clip(i.heading, 120)}`,
    `Opening of the section: ${clip(i.excerpt)}`,
    'Answer with JSON only.',
  ].join('\n\n');
}

/** JSON Schema for responseConstraint: machine-checkable role labels. */
export const ROLE_SCHEMA = {
  type: 'object',
  properties: {
    roles: { type: 'array', items: { type: 'string', enum: [...ROLES] }, minItems: 1, maxItems: 3 },
    confidence: { type: 'number', minimum: 0, maximum: 1 },
  },
  required: ['roles', 'confidence'],
  additionalProperties: false,
} as const;

export const EXPLANATION_SCHEMA = {
  type: 'object',
  properties: { explanation: { type: 'string', maxLength: 700 } },
  required: ['explanation'],
  additionalProperties: false,
} as const;

export const TOPIC_SCHEMA = {
  type: 'object',
  properties: {
    onTopic: { type: 'boolean' },
    answer: { type: 'string', maxLength: 900 },
  },
  required: ['onTopic', 'answer'],
  additionalProperties: false,
} as const;
