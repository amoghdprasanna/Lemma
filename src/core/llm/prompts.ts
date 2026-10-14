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
  '- Only explain the convention or error you are given, using the facts provided. If unsure, say so.',
  '- Answer in at most four short sentences. No headings, no LaTeX sectioning commands.',
].join('\n');

/** Characters of user text sent per request; the context window is small. */
export const MAX_SNIPPET = 600;

export function clip(text: string, max = MAX_SNIPPET): string {
  const t = text.replace(/\s+/g, ' ').trim();
  return t.length <= max ? t : `${t.slice(0, max)} …`;
}

export function explainPrompt(i: {
  title: string;
  card: string;
  message: string;
  snippet: string;
}): string {
  return [
    `Convention: ${i.title}`,
    `Facts (from a curated guide): ${clip(i.card, 900)}`,
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
