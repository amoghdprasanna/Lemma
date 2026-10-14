import type { DocumentModel, Span } from '../model/types';
import { contains } from '../model/text';
import { proseMask } from './prose-mask';

/**
 * Common acronyms in quantum information, with expansions to suggest. The
 * expansions are shown as a hint; Lemma never inserts them (ADR-0003).
 */
export const KNOWN_ACRONYMS: Record<string, string> = {
  QEC: 'quantum error correction',
  NISQ: 'noisy intermediate-scale quantum',
  VQE: 'variational quantum eigensolver',
  VQA: 'variational quantum algorithm',
  QAOA: 'quantum approximate optimization algorithm',
  QML: 'quantum machine learning',
  QNN: 'quantum neural network',
  PQC: 'parametrized quantum circuit',
  QFT: 'quantum Fourier transform',
  QPE: 'quantum phase estimation',
  QKD: 'quantum key distribution',
  QSVT: 'quantum singular value transformation',
  QSP: 'quantum signal processing',
  MBQC: 'measurement-based quantum computation',
  LOCC: 'local operations and classical communication',
  POVM: 'positive operator-valued measure',
  CPTP: 'completely positive trace-preserving',
  MPS: 'matrix product state',
  PEPS: 'projected entangled pair state',
  DMRG: 'density matrix renormalization group',
  LDPC: 'low-density parity-check',
  CSS: 'Calderbank-Shor-Steane',
  GKP: 'Gottesman-Kitaev-Preskill',
  SPAM: 'state preparation and measurement',
  RB: 'randomized benchmarking',
  MWPM: 'minimum-weight perfect matching',
  HHL: 'Harrow-Hassidim-Lloyd',
  QUBO: 'quadratic unconstrained binary optimization',
  CNOT: 'controlled-NOT',
  GHZ: 'Greenberger-Horne-Zeilinger',
};

/** Uppercase tokens that are not acronyms to check (Roman numerals, units, words). */
const IGNORE = new Set([
  'I',
  'II',
  'III',
  'IV',
  'V',
  'VI',
  'VII',
  'VIII',
  'IX',
  'X',
  'XI',
  'XII',
  'OK',
  'TODO',
  'AND',
  'OR',
  'NOT',
  'XOR',
  'NAND',
  'SWAP',
  'ID',
  'GHz',
  'MHz',
  'KHz',
  'THz',
]);

const STOP = new Set(['of', 'and', 'the', 'for', 'in', 'on', 'with', 'a', 'an', 'to', 'by', 'via']);

export interface AcronymDefinition {
  span: Span;
  expansion: string;
}

export interface AcronymInfo {
  acronym: string;
  uses: Span[];
  definitions: AcronymDefinition[];
}

const TOKEN = /(?<![A-Za-z0-9-])([A-Z][A-Z0-9]*[A-Z])(s?)(?![A-Za-z0-9])/g;

function letters(acronym: string): string {
  return acronym.replace(/[^A-Za-z]/g, '').toLowerCase();
}

/**
 * Do the initials of the last words (ending at the acronym) spell `acronym`?
 * A word may supply several leading letters ("NOT" in controlled-NOT), and
 * hyphenated words count their parts. Returns how many words were used, or 0.
 */
export function matchesExpansion(acronym: string, words: string[]): number {
  const target = letters(acronym);
  for (let take = 1; take <= Math.min(words.length, target.length + 4); take++) {
    const slice = words.slice(words.length - take);
    if (STOP.has(slice[0]?.toLowerCase() ?? '')) continue;
    const parts = slice.flatMap((w) => w.split('-')).filter((w) => w.length > 0);
    if (
      align(
        target,
        parts.map((w) => w.toLowerCase()),
      )
    )
      return take;
  }
  return 0;
}

function align(target: string, words: string[]): boolean {
  const go = (ti: number, wi: number): boolean => {
    if (ti === target.length) return words.slice(wi).every((w) => STOP.has(w));
    if (wi === words.length) return false;
    const w = words[wi] ?? '';
    if (STOP.has(w) && go(ti, wi + 1)) return true;
    // This word supplies 1..n leading letters.
    for (let n = 1; n <= w.length && ti + n <= target.length; n++) {
      if (w.slice(0, n) !== target.slice(ti, ti + n)) break;
      if (go(ti + n, wi + 1)) return true;
    }
    return false;
  };
  return go(0, 0);
}

/** All acronym uses and definitions in the document's prose. */
export function findAcronyms(model: DocumentModel): AcronymInfo[] {
  const text = proseMask(model);
  const byName = new Map<string, AcronymInfo>();
  const get = (a: string) => {
    let info = byName.get(a);
    if (!info) {
      info = { acronym: a, uses: [], definitions: [] };
      byName.set(a, info);
    }
    return info;
  };
  TOKEN.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = TOKEN.exec(text)) !== null) {
    const acronym = m[1] ?? '';
    if (IGNORE.has(acronym) || acronym.length > 8 || !/[A-Z].*[A-Z]/.test(acronym)) continue;
    if (!contains(model.bodySpan, m.index)) continue;
    const span = { start: m.index, end: m.index + m[0].length };
    const info = get(acronym);
    info.uses.push(span);

    // "long form (ACR)"
    const before = text.slice(Math.max(0, m.index - 160), m.index);
    if (/\(\s*$/.test(before) && /^\s*\)/.test(text.slice(span.end))) {
      const words = before.replace(/\(\s*$/, '').match(/[A-Za-z][A-Za-z-]*/g) ?? [];
      const used = matchesExpansion(acronym, words.slice(-12));
      if (used > 0) {
        info.definitions.push({ span, expansion: words.slice(-used).join(' ') });
        continue;
      }
    }
    // "ACR (long form)"
    const after = /^\s*\(([^()]{3,120})\)/.exec(text.slice(span.end));
    if (after?.[1] !== undefined) {
      const words = after[1].match(/[A-Za-z][A-Za-z-]*/g) ?? [];
      if (matchesExpansion(acronym, words) > 0) {
        info.definitions.push({ span, expansion: after[1].trim() });
      }
    }
  }
  return [...byName.values()];
}

export function usesAcronymPackage(model: DocumentModel): boolean {
  return model.packages.some((p) =>
    ['acro', 'acronym', 'glossaries', 'glossaries-extra'].includes(p.name),
  );
}
