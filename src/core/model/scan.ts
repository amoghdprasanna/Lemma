import type { ArgText } from './types';

/**
 * Argument signature, a subset of xparse: `s` star, `o` optional `[...]`,
 * `m` mandatory `{...}`.
 */
export type Signature = string;

/** Skips spaces, tabs and at most one newline (a blank line ends a macro's arguments). */
function skipSpace(text: string, pos: number): number {
  let i = pos;
  let newlines = 0;
  while (i < text.length) {
    const ch = text[i];
    if (ch === ' ' || ch === '\t' || ch === '\r') i++;
    else if (ch === '\n' && newlines === 0) {
      newlines++;
      i++;
    } else break;
  }
  return i;
}

/**
 * Index just past the delimiter closing the group opened at `open`, honouring
 * nested braces and escapes. Returns -1 if unbalanced. `text` must already
 * have comments masked out.
 */
export function matchGroup(text: string, open: number, close: '}' | ']'): number {
  let depth = 0;
  for (let i = open + 1; i < text.length; i++) {
    const ch = text[i];
    if (ch === '\\') {
      i++;
      continue;
    }
    if (ch === '{') depth++;
    else if (ch === '}') {
      if (depth === 0) return close === '}' ? i + 1 : -1;
      depth--;
    } else if (ch === ']' && close === ']' && depth === 0) return i + 1;
  }
  return -1;
}

/**
 * Reads macro arguments starting right after a macro name. `text` should be
 * the comment-masked source; argument text is sliced from `source`.
 */
export function readArgs(
  text: string,
  source: string,
  pos: number,
  signature: Signature,
): { starred: boolean; args: (ArgText | null)[]; end: number } {
  let i = pos;
  let starred = false;
  const args: (ArgText | null)[] = [];
  for (const spec of signature) {
    if (spec === 's') {
      const j = skipSpace(text, i);
      if (text[j] === '*') {
        starred = true;
        i = j + 1;
      }
      continue;
    }
    const j = skipSpace(text, i);
    const open = spec === 'o' ? '[' : '{';
    if (text[j] !== open) {
      args.push(null);
      continue;
    }
    const end = matchGroup(text, j, spec === 'o' ? ']' : '}');
    if (end === -1) {
      args.push(null);
      break;
    }
    args.push({
      span: { start: j, end },
      contentSpan: { start: j + 1, end: end - 1 },
      text: source.slice(j + 1, end - 1),
    });
    i = end;
  }
  return { starred, args, end: i };
}

/** Splits a comma-separated key list (`\cite{a, b}`) into trimmed, non-empty keys. */
export function splitKeys(raw: string): string[] {
  return raw
    .split(',')
    .map((k) => k.trim())
    .filter((k) => k.length > 0);
}
