import type { DocumentModel, Span } from './types';

/** Replaces each span of `text` with spaces, keeping newlines and length. */
export function blankSpans(text: string, spans: readonly Span[]): string {
  if (spans.length === 0) return text;
  const chars = text.split('');
  for (const { start, end } of spans) {
    for (let i = start; i < end && i < chars.length; i++) {
      if (chars[i] !== '\n') chars[i] = ' ';
    }
  }
  return chars.join('');
}

export function contains(outer: Span, inner: Span | number): boolean {
  const s = typeof inner === 'number' ? inner : inner.start;
  const e = typeof inner === 'number' ? inner : inner.end;
  return outer.start <= s && e <= outer.end;
}

export function overlaps(a: Span, b: Span): boolean {
  return a.start < b.end && b.start < a.end;
}

const NON_PROSE_MACROS =
  /\\(?:cite[a-zA-Z]*|onlinecite|ref|eqref|pageref|autoref|[cC]ref|cpageref|nameref|label|includegraphics|url|href|bibliography|bibliographystyle|input|include|usepackage|documentclass)\*?\s*(?:\[[^\]]*\]\s*)*(?:\{[^}]*\}\s*)*/g;

/**
 * Plain prose for a span: comments, math and reference-like macros removed,
 * other macro names dropped (their arguments kept), braces removed. Offsets
 * are not preserved; use for counting and keyword heuristics only.
 */
export function proseOf(model: DocumentModel, span: Span): string {
  const mathSpans = model.math
    .filter((m) => m.span.end > span.start && m.span.start < span.end)
    .map((m) => ({
      start: Math.max(0, m.span.start - span.start),
      end: Math.min(span.end, m.span.end) - span.start,
    }));
  const raw = blankSpans(model.masked.slice(span.start, span.end), mathSpans);
  return raw
    .replace(NON_PROSE_MACROS, ' ')
    .replace(/\\begin\{[^}]*\}|\\end\{[^}]*\}/g, ' ')
    .replace(/\\[a-zA-Z@]+\*?/g, ' ')
    .replace(/\\./g, ' ')
    .replace(/[{}~]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function wordCount(prose: string): number {
  return prose.split(/\s+/).filter((w) => /[A-Za-z0-9]/.test(w)).length;
}

/** Maps offsets to 1-based line/column. */
export class LineIndex {
  private readonly starts: number[] = [0];

  constructor(text: string) {
    for (let i = 0; i < text.length; i++) if (text[i] === '\n') this.starts.push(i + 1);
  }

  locate(offset: number): { line: number; column: number } {
    let lo = 0;
    let hi = this.starts.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if ((this.starts[mid] ?? 0) <= offset) lo = mid;
      else hi = mid - 1;
    }
    return { line: lo + 1, column: offset - (this.starts[lo] ?? 0) + 1 };
  }

  lineStart(line: number): number {
    return this.starts[line - 1] ?? 0;
  }
}

/** Short, stable FNV-1a hash (hex) for fingerprints and caches. */
export function hash(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}

/** Normalises a heading for matching: lowercase, no numbering, punctuation or TeX. */
export function normalizeHeading(title: string): string {
  return title
    .replace(/\\[a-zA-Z@]+\*?/g, ' ')
    .replace(/[{}$\\~]/g, ' ')
    .toLowerCase()
    .replace(/^\s*(?:\d+(?:\.\d+)*\.?|(?:[ivxlc]+|[a-z])[.)])\s+/, '')
    .replace(/[^a-z0-9& ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
