import { readMagicBlock } from '../settings/magic-comment';
import { SKELETON_HEADINGS, SKELETON_PROMPTS } from './skeleton';
import { normalizeEdits, type Fix, type TextEdit } from './text-edit';

/**
 * Enforces ADR-0003 (no content generation). Every fix passes through here
 * before the user can preview it; anything that could be authored prose is
 * rejected.
 */
export type GuardResult = { ok: true } | { ok: false; reason: string };

const ok: GuardResult = { ok: true };
const fail = (reason: string): GuardResult => ({ ok: false, reason });

/**
 * Words that remain after removing TeX commands, braces, punctuation and
 * whitespace. Lowercased: changing case (`tr` -> `Tr`) is notation, not content.
 */
export function proseTokens(s: string): string[] {
  return s
    .replace(/\\[a-zA-Z@]+\*?/g, ' ')
    .replace(/\\./g, ' ')
    .split(/[^A-Za-z0-9]+/)
    .filter((w) => w.length > 0)
    .map((w) => w.toLowerCase());
}

/**
 * Mechanical edits may only rearrange or re-mark tokens already present in
 * the text they replace. Checked across all mechanical edits of a fix, so a
 * fix can move text (delete here, insert there).
 */
function checkMechanical(edits: readonly TextEdit[], text: string): GuardResult {
  const available = new Map<string, number>();
  let removedLength = 0;
  let insertedLength = 0;
  for (const e of edits) {
    const removed = text.slice(e.start, e.end);
    removedLength += removed.length;
    insertedLength += e.insert.length;
    if (/%/.test(e.insert.replace(/\\%/g, '')))
      return fail('Mechanical edits may not add comments.');
    for (const t of proseTokens(removed)) available.set(t, (available.get(t) ?? 0) + 1);
  }
  if (insertedLength > removedLength + 64) return fail('Mechanical fix grows the text too much.');
  for (const e of edits) {
    for (const t of proseTokens(e.insert)) {
      const n = available.get(t) ?? 0;
      if (n === 0) return fail(`Mechanical edit introduces new text "${t}".`);
      available.set(t, n - 1);
    }
  }
  return ok;
}

const SKELETON_LINE = [
  /^$/,
  /^\\(?:sub)?section\*?\{([^{}]*)\}$/,
  /^\\begin\{(?:abstract|acknowledgments)\}$/,
  /^\\end\{(?:abstract|acknowledgments)\}$/,
  /^\\appendix$/,
];

function checkSkeleton(edit: TextEdit, text: string): GuardResult {
  if (edit.start !== edit.end && text.slice(edit.start, edit.end).trim() !== '') {
    return fail('Skeleton edits may only insert, not replace text.');
  }
  for (const raw of edit.insert.split('\n')) {
    const line = raw.trim();
    if (line.startsWith('%')) {
      if (!SKELETON_PROMPTS.has(line.replace(/^%\s*/, '')))
        return fail(`Uncurated comment: ${line}`);
      continue;
    }
    const matched = SKELETON_LINE.find((re) => re.test(line));
    if (!matched) return fail(`Unexpected skeleton line: ${line}`);
    const heading = /^\\(?:sub)?section\*?\{([^{}]*)\}$/.exec(line)?.[1];
    if (heading !== undefined && !SKELETON_HEADINGS.has(heading)) {
      return fail(`Uncurated heading: ${heading}`);
    }
  }
  return ok;
}

function checkSettings(edit: TextEdit): GuardResult {
  const lines = edit.insert.split('\n').filter((l) => l.trim() !== '');
  if (lines.length === 0) return ok; // removing the block
  if (!lines.every((l) => /^%\s*lemma:/.test(l.trim())))
    return fail('Settings edit contains non-settings lines.');
  const block = readMagicBlock(edit.insert);
  if (!block || block.problems.length > 0) {
    return fail(`Settings edit does not parse: ${block?.problems.join(' ') ?? 'empty'}`);
  }
  return ok;
}

export function checkFix(fix: Fix, text: string): GuardResult {
  if (fix.edits.length === 0) return fail('Fix has no edits.');
  if (normalizeEdits(fix.edits) === null) return fail('Fix edits overlap.');
  for (const e of fix.edits) {
    if (e.start < 0 || e.end > text.length || e.start > e.end) return fail('Edit out of range.');
    const r =
      e.kind === 'skeleton'
        ? checkSkeleton(e, text)
        : e.kind === 'settings'
          ? checkSettings(e)
          : ok;
    if (!r.ok) return r;
  }
  return checkMechanical(
    fix.edits.filter((e) => e.kind === 'mechanical'),
    text,
  );
}
