import { isRole, type Role } from '../structure/roles';

/**
 * Post-filter for model output (ADR-0003, ADR-0004). Anything that looks like
 * drafted paper content, or that is not the shape we asked for, is dropped
 * and the UI falls back to the curated card text.
 */
const DRAFTING = [
  /\\(?:sub)*section\*?\s*\{|\\begin\s*\{|\\cite\w*\s*\{|\\label\s*\{|\\maketitle/,
  /\b(?:here(?:'s| is) (?:a|an|the|your) (?:revised|rewritten|improved|new|possible|suggested)|you (?:could|can|might|should) (?:write|say|phrase|rephrase|reword)|suggested (?:text|wording|sentence|abstract|paragraph)|(?:revised|rewritten) (?:version|text|abstract|paragraph)|rewrite (?:it|this|the) as)\b/i,
  /\bwe (?:show|demonstrate|propose|present|prove|derive|report|introduce|obtain)\b/i,
  /\bin this (?:paper|work|letter|article),? we\b/i,
  /```/,
];

const MAX_CHARS = 900;
const MAX_SENTENCES = 6;

export type FilterResult = { ok: true; text: string } | { ok: false; reason: string };

export function filterExplanation(raw: string): FilterResult {
  let text = raw.trim();
  // Accept {"explanation": "..."} from structured output.
  if (text.startsWith('{')) {
    try {
      const parsed = JSON.parse(text) as { explanation?: unknown };
      if (typeof parsed.explanation !== 'string')
        return { ok: false, reason: 'missing explanation' };
      text = parsed.explanation.trim();
    } catch {
      return { ok: false, reason: 'invalid JSON' };
    }
  }
  if (text.length === 0) return { ok: false, reason: 'empty' };
  if (text.length > MAX_CHARS) return { ok: false, reason: 'too long' };
  const sentences = text.split(/[.!?](?:\s|$)/).filter((s) => s.trim().length > 0);
  if (sentences.length > MAX_SENTENCES) return { ok: false, reason: 'too many sentences' };
  for (const re of DRAFTING)
    if (re.test(text))
      return { ok: false, reason: `looks like drafted content (${re.source.slice(0, 24)}…)` };
  return { ok: true, text };
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
