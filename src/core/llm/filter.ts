import { isRole, type Role } from '../structure/roles';

/**
 * Post-filter for model output (ADR-0003, ADR-0004). Anything that looks like
 * drafted paper content, or that is not the shape we asked for, is dropped
 * and the UI falls back to the curated card text.
 */

/** Text that reads like text written for the paper rather than about it. */
const PROSE_DRAFTING = [
  /\b(?:here(?:'s| is) (?:a|an|the|your) (?:revised|rewritten|improved|new|possible|suggested)|you (?:could|can|might|should) (?:write|say|phrase|rephrase|reword)|suggested (?:text|wording|sentence|abstract|paragraph)|(?:revised|rewritten) (?:version|text|abstract|paragraph)|rewrite (?:it|this|the) as)\b/i,
  /\bwe (?:show|demonstrate|propose|present|prove|derive|report|introduce|obtain)\b/i,
  /\bin this (?:paper|work|letter|article),? we\b/i,
  /```/,
];

const DRAFTING = [
  /\\(?:sub)*section\*?\s*\{|\\begin\s*\{|\\cite\w*\s*\{|\\label\s*\{|\\maketitle/,
  ...PROSE_DRAFTING,
];

/**
 * Topic answers may show how a command is used (`\label{eq:x}`, `\begin{equation}`),
 * so only paper scaffolding counts as drafting there.
 */
const TOPIC_SCAFFOLDING = [
  /\\(?:sub)*section\*?\s*\{|\\begin\s*\{\s*(?:abstract|document)\s*\}|\\maketitle/,
];

/**
 * A short quoted phrase names a wording ("avoid opening with 'In this paper, we'")
 * rather than drafting one, so topic answers may quote it. Quotes longer than
 * a phrase, or holding a whole sentence, are still checked. Single quotes count
 * only at word edges, so apostrophes don't.
 */
const SHORT_QUOTE =
  /["“][^"”\n.!?]{1,30}["”]|‘[^’\n.!?]{1,30}’|(?<=^|[\s(])'[^'\n.!?]{1,30}'(?![a-z])/gi;

const MAX_CHARS = 900;
const MAX_SENTENCES = 6;

/**
 * Why an answer was dropped: `malformed` (not the shape asked for), `drafted`
 * (reads like paper text, ADR-0003) or `rambling` (longer than asked).
 */
export type OutputFailure = 'malformed' | 'drafted' | 'rambling';

export type Parsed<T> =
  { ok: true; value: T } | { ok: false; failure: OutputFailure; reason: string };

const fail = (failure: OutputFailure, reason: string) => ({ ok: false, failure, reason }) as const;

export function filterExplanation(raw: string): Parsed<string> {
  let text = raw.trim();
  // Accept {"explanation": "..."} from structured output.
  if (text.startsWith('{')) {
    try {
      const parsed = JSON.parse(text) as { explanation?: unknown };
      if (typeof parsed.explanation !== 'string') return fail('malformed', 'missing explanation');
      text = parsed.explanation.trim();
    } catch {
      return fail('malformed', 'invalid JSON');
    }
  }
  return check(text, { maxChars: MAX_CHARS, maxSentences: MAX_SENTENCES, drafting: DRAFTING });
}

function check(
  text: string,
  o: {
    maxChars: number;
    maxSentences: number;
    drafting: readonly RegExp[];
    /** Checked against the text with short quotes removed. */
    prose?: readonly RegExp[];
  },
): Parsed<string> {
  if (text.length === 0) return fail('malformed', 'empty');
  if (text.length > o.maxChars) return fail('rambling', 'too long');
  const sentences = text.split(/[.!?](?:\s|$)/).filter((s) => s.trim().length > 0);
  if (sentences.length > o.maxSentences) return fail('rambling', 'too many sentences');
  const unquoted = text.replace(SHORT_QUOTE, '""');
  const hit = o.drafting.find((re) => re.test(text)) ?? o.prose?.find((re) => re.test(unquoted));
  if (hit) return fail('drafted', `looks like drafted content (${hit.source.slice(0, 24)}…)`);
  return { ok: true, value: text };
}

export type TopicResult = { kind: 'answer'; text: string } | { kind: 'off-topic' };

/** Parses {"onTopic", "answer"}; fails when malformed or when the answer fails the filter. */
export function parseTopicAnswer(raw: string): Parsed<TopicResult> {
  let parsed: { onTopic?: unknown; answer?: unknown };
  try {
    parsed = JSON.parse(raw) as typeof parsed;
  } catch {
    return fail('malformed', 'invalid JSON');
  }
  if (parsed.onTopic === false) return { ok: true, value: { kind: 'off-topic' } };
  if (parsed.onTopic !== true || typeof parsed.answer !== 'string')
    return fail('malformed', 'missing answer');
  const r = check(parsed.answer.trim(), {
    maxChars: 1000,
    maxSentences: 8,
    drafting: TOPIC_SCAFFOLDING,
    prose: PROSE_DRAFTING,
  });
  return r.ok ? { ok: true, value: { kind: 'answer', text: r.value } } : r;
}

export function parseRoleSuggestion(raw: string): { roles: Role[]; confidence: number } | null {
  try {
    const parsed = JSON.parse(raw) as { roles?: unknown; confidence?: unknown };
    if (!Array.isArray(parsed.roles)) return null;
    const roles = [...new Set(parsed.roles.filter(isRole))];
    const confidence =
      typeof parsed.confidence === 'number' ? Math.max(0, Math.min(1, parsed.confidence)) : 0;
    if (roles.length === 0 || roles.length !== parsed.roles.length) return null;
    return { roles, confidence };
  } catch {
    return null;
  }
}
