import { definesMacro, hasPackage } from '../model/build';
import type { DocumentModel, MathSegment, Span } from '../model/types';

export interface MathOccurrence {
  span: Span;
  text: string;
  segment: MathSegment;
}

/** Finds `re` matches inside math content, with absolute spans. `re` must be global. */
export function findInMath(
  model: DocumentModel,
  re: RegExp,
): (MathOccurrence & { match: RegExpExecArray })[] {
  const out: (MathOccurrence & { match: RegExpExecArray })[] = [];
  for (const seg of model.math) {
    const content = model.masked.slice(seg.contentSpan.start, seg.contentSpan.end);
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(content)) !== null) {
      const start = seg.contentSpan.start + m.index;
      out.push({ span: { start, end: start + m[0].length }, text: m[0], segment: seg, match: m });
      if (m[0].length === 0) re.lastIndex++;
    }
  }
  return out;
}

// ---------------------------------------------------------------- kets

export type KetStyle = 'manual' | 'macro';
export interface KetOccurrence {
  span: Span;
  style: KetStyle;
  form: 'ket' | 'bra' | 'braket';
  /** Inner content(s), e.g. ['\\psi'] or ['a', 'b']. */
  parts: string[];
}

const SIMPLE = String.raw`[^|{}\\]*(?:\\[a-zA-Z]+[^|{}\\]*)*(?:\{[^{}|]*\}[^|{}\\]*)*`;
const MANUAL_BRAKET = new RegExp(
  String.raw`\\langle\s*(${SIMPLE})\s*\|\s*(${SIMPLE})\s*\\rangle`,
  'g',
);
const MANUAL_KET = new RegExp(String.raw`(?<!\\left\s*|\\)\|\s*(${SIMPLE})\s*\\rangle`, 'g');
const MANUAL_BRA = new RegExp(String.raw`\\langle\s*(${SIMPLE})\s*\|(?!\|)`, 'g');
const MACRO = /\\(ket|bra|braket)\*?\s*\{([^{}]*)\}(?:\s*\{([^{}]*)\})?/g;

function overlapsAny(span: Span, taken: Span[]): boolean {
  return taken.some((t) => span.start < t.end && t.start < span.end);
}

export function findKets(model: DocumentModel): KetOccurrence[] {
  const out: KetOccurrence[] = [];
  const taken: Span[] = [];
  for (const o of findInMath(model, MACRO)) {
    const form = o.match[1] as 'ket' | 'bra' | 'braket';
    const parts = [o.match[2] ?? '', ...(o.match[3] !== undefined ? [o.match[3]] : [])];
    out.push({ span: o.span, style: 'macro', form, parts });
    taken.push(o.span);
  }
  for (const o of findInMath(model, MANUAL_BRAKET)) {
    if (overlapsAny(o.span, taken)) continue;
    out.push({
      span: o.span,
      style: 'manual',
      form: 'braket',
      parts: [o.match[1]?.trim() ?? '', o.match[2]?.trim() ?? ''],
    });
    taken.push(o.span);
  }
  for (const o of findInMath(model, MANUAL_KET)) {
    if (overlapsAny(o.span, taken)) continue;
    out.push({ span: o.span, style: 'manual', form: 'ket', parts: [o.match[1]?.trim() ?? ''] });
    taken.push(o.span);
  }
  for (const o of findInMath(model, MANUAL_BRA)) {
    if (overlapsAny(o.span, taken)) continue;
    out.push({ span: o.span, style: 'manual', form: 'bra', parts: [o.match[1]?.trim() ?? ''] });
    taken.push(o.span);
  }
  return out.sort((a, b) => a.span.start - b.span.start);
}

/** Which bra-ket macros the document can use, if any. */
export function ketMacros(model: DocumentModel): 'physics' | 'braket' | 'custom' | null {
  if (hasPackage(model, 'physics')) return 'physics';
  if (hasPackage(model, 'braket')) return 'braket';
  if (definesMacro(model, 'ket') && definesMacro(model, 'bra')) return 'custom';
  return null;
}

export function ketToMacro(k: KetOccurrence, pkg: 'physics' | 'braket' | 'custom'): string | null {
  const [a = '', b = ''] = k.parts;
  if (k.form === 'ket') return `\\ket{${a}}`;
  if (k.form === 'bra') return `\\bra{${a}}`;
  if (pkg === 'physics') return `\\braket{${a}}{${b}}`;
  if (pkg === 'braket') return `\\braket{${a}|${b}}`;
  return null;
}

export function ketToManual(k: KetOccurrence): string {
  const [a = '', b = ''] = k.parts;
  if (k.form === 'ket') return `|${a}\\rangle`;
  if (k.form === 'bra') return `\\langle ${a}|`;
  const [x, y] = b !== '' ? [a, b] : a.split('|');
  return `\\langle ${x ?? ''}|${y ?? ''}\\rangle`;
}

// ---------------------------------------------------------------- trace

export interface TraceOccurrence {
  span: Span;
  /** Canonical form, e.g. `\mathrm{Tr}` or `Tr` (italic, no command). */
  form: string;
}

const TRACE =
  /\\(?:mathrm|text|textrm|operatorname\*?)\s*\{\s*(Tr|tr)\s*\}|\{\\rm\s+(Tr|tr)\s*\}|\\(Tr|tr)(?![a-zA-Z])|(?<![\\a-zA-Z{])(Tr|tr)(?![a-zA-Z])/g;

export function findTraces(model: DocumentModel): TraceOccurrence[] {
  return findInMath(model, TRACE).map((o) => {
    const m = o.match;
    const name = m[1] ?? m[2] ?? m[3] ?? m[4] ?? 'Tr';
    let form: string;
    if (m[1] !== undefined) form = o.text.replace(/\s+/g, '').replace(/\{(Tr|tr)\}/, `{${name}}`);
    else if (m[2] !== undefined) form = `{\\rm ${name}}`;
    else if (m[3] !== undefined) form = `\\${name}`;
    else form = name;
    return { span: o.span, form };
  });
}

// ---------------------------------------------------------------- adjoint

export interface StarOccurrence {
  span: Span;
  base: string;
  mark: 'dagger' | 'star';
}

const SUPER =
  /(\\[a-zA-Z]+|[A-Za-z])\s*\^\s*(?:\{\s*(\\dagger|\\ast|\*)\s*\}|(\\dagger|\\ast|\*))/g;

export function findAdjoints(model: DocumentModel): StarOccurrence[] {
  return findInMath(model, SUPER).map((o) => {
    const mark = o.match[2] ?? o.match[3] ?? '';
    return { span: o.span, base: o.match[1] ?? '', mark: mark === '\\dagger' ? 'dagger' : 'star' };
  });
}

// ---------------------------------------------------------------- symbols

export const GREEK = new Set([
  'alpha',
  'beta',
  'gamma',
  'delta',
  'epsilon',
  'varepsilon',
  'zeta',
  'eta',
  'theta',
  'vartheta',
  'iota',
  'kappa',
  'lambda',
  'mu',
  'nu',
  'xi',
  'rho',
  'varrho',
  'sigma',
  'tau',
  'upsilon',
  'phi',
  'varphi',
  'chi',
  'psi',
  'omega',
  'Gamma',
  'Delta',
  'Theta',
  'Lambda',
  'Xi',
  'Sigma',
  'Upsilon',
  'Phi',
  'Psi',
  'Omega',
]);

const STRIP_ARG =
  /\\(?:text|textrm|mathrm|operatorname\*?|label|begin|end|mathbb|mathcal|mathsf|mathfrak|ket|bra|braket)\s*\{[^{}]*\}/g;

/** Base symbols (single Latin letters and Greek letters) used in a math segment. */
export function symbolsIn(content: string): Set<string> {
  const cleaned = content
    .replace(STRIP_ARG, ' ')
    .replace(/\\left|\\right/g, ' ')
    // Sub- and superscripts are indices and decorations, not base symbols.
    .replace(/[_^]\s*\{[^{}]*\}/g, ' ')
    .replace(/[_^]\s*\\?[A-Za-z0-9]+/g, ' ');
  const out = new Set<string>();
  const re = /\\([a-zA-Z]+)|([A-Za-z])/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(cleaned)) !== null) {
    if (m[1] !== undefined) {
      if (GREEK.has(m[1])) out.add(`\\${m[1]}`);
    } else if (m[2] !== undefined) out.add(m[2]);
  }
  return out;
}

export interface SymbolIntro {
  symbol: string;
  /** The inline math where it first appears in running text. */
  span: Span;
  /** The author's own sentence fragment around it (for the notation sheet). */
  context: string;
}

const INTRO = /(?:where|let|denote[sd]?|define[sd]?|is the|are the|be the|by)\W*$/i;

/** Symbols introduced in running text, with the author's sentence fragment as context. */
export function symbolIntroductions(model: DocumentModel): SymbolIntro[] {
  const seen = new Set<string>();
  const out: SymbolIntro[] = [];
  for (const seg of model.math) {
    if (seg.display) continue;
    const content = model.masked.slice(seg.contentSpan.start, seg.contentSpan.end);
    const syms = symbolsIn(content);
    if (syms.size !== 1 || content.length > 40) continue;
    const before = model.masked.slice(Math.max(0, seg.span.start - 60), seg.span.start);
    const afterText = model.masked.slice(seg.span.end, seg.span.end + 60);
    if (!INTRO.test(before) && !/^\s*(?:is|are|denotes?)\b/.test(afterText)) continue;
    for (const s of syms) {
      if (seen.has(s)) continue;
      seen.add(s);
      const ctx =
        (before.split(/[.;:]\s/).pop() ?? '') +
        model.text.slice(seg.span.start, seg.span.end) +
        (afterText.split(/[.;,]/)[0] ?? '');
      out.push({ symbol: s, span: seg.span, context: ctx.replace(/\s+/g, ' ').trim() });
    }
  }
  return out;
}
