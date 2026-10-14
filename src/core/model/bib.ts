import { matchGroup } from './scan';
import type { BibEntry } from './types';

const SKIP_TYPES = new Set(['comment', 'string', 'preamble']);

/** Reads a field value: `{...}`, `"..."`, a bare number/macro, joined with `#`. */
function readValue(text: string, pos: number): { value: string; end: number } {
  let i = pos;
  const parts: string[] = [];
  for (;;) {
    while (/\s/.test(text[i] ?? '')) i++;
    const ch = text[i];
    if (ch === '{') {
      const end = matchGroup(text, i, '}');
      if (end === -1) return { value: parts.join(''), end: text.length };
      parts.push(text.slice(i + 1, end - 1));
      i = end;
    } else if (ch === '"') {
      let j = i + 1;
      let depth = 0;
      while (j < text.length) {
        const c = text[j];
        if (c === '{') depth++;
        else if (c === '}') depth--;
        else if (c === '"' && depth === 0) break;
        j++;
      }
      parts.push(text.slice(i + 1, j));
      i = j + 1;
    } else {
      const m = /^[^,}#\s]+/.exec(text.slice(i));
      parts.push(m?.[0] ?? '');
      i += m?.[0].length ?? 0;
    }
    while (/\s/.test(text[i] ?? '')) i++;
    if (text[i] === '#') {
      i++;
      continue;
    }
    return { value: parts.join('').replace(/\s+/g, ' ').trim(), end: i };
  }
}

/** Minimal, tolerant BibTeX reader. Malformed entries are skipped. */
export function parseBib(text: string): BibEntry[] {
  const entries: BibEntry[] = [];
  const at = /@([a-zA-Z]+)\s*([{(])/g;
  let m: RegExpExecArray | null;
  while ((m = at.exec(text)) !== null) {
    const type = (m[1] ?? '').toLowerCase();
    const open = m.index + m[0].length - 1;
    const close = text[open] === '{' ? matchGroup(text, open, '}') : text.indexOf(')', open) + 1;
    if (close <= 0) break;
    at.lastIndex = close;
    if (SKIP_TYPES.has(type)) continue;
    const body = text.slice(open + 1, close - 1);
    const comma = body.indexOf(',');
    if (comma === -1) continue;
    const key = body.slice(0, comma).trim();
    const fields: Record<string, string> = {};
    let i = comma + 1;
    while (i < body.length) {
      const fm = /^\s*([A-Za-z][\w-]*)\s*=/.exec(body.slice(i));
      if (!fm) break;
      const { value, end } = readValue(body, i + fm[0].length);
      fields[(fm[1] ?? '').toLowerCase()] = value;
      i = end;
      while (i < body.length && /[\s,]/.test(body[i] ?? '')) i++;
    }
    entries.push({ type, key, fields, span: { start: m.index, end: close } });
  }
  return entries;
}
