import { analyze, type AnalysisResult, type AnalyzeInput } from '../analysis';
import { buildModel } from '../model/build';
import { LineIndex } from '../model/text';
import type { BibEntry, Span } from '../model/types';
import type { Fix } from '../fixes/text-edit';
import type { Diagnostic } from '../rules/types';

/**
 * Multi-file projects (docs/adr/0005-multi-file-projects.md). Lemma only ever
 * sees files the user opened in Overleaf or imported from a zip. The main
 * file is flattened (\input/\include replaced by file contents) with a source
 * map, analysed as one paper, and results are mapped back to files.
 */
export interface ProjectFile {
  path: string;
  text: string;
}

export interface Segment {
  path: string;
  /** Offset of this segment within its own file. */
  fileStart: number;
  /** Offset within the flattened text. */
  flatStart: number;
  length: number;
}

export interface Flattened {
  text: string;
  segments: Segment[];
  /** Inputs that could not be resolved to a known file. */
  missing: string[];
  /** Files included (transitively), main first. */
  included: string[];
}

const MAX_DEPTH = 12;

export function normalizePath(p: string): string {
  const parts: string[] = [];
  for (const seg of p.replace(/\\/g, '/').split('/')) {
    if (seg === '' || seg === '.') continue;
    if (seg === '..') parts.pop();
    else parts.push(seg);
  }
  return parts.join('/');
}

function dirname(p: string): string {
  const i = p.lastIndexOf('/');
  return i === -1 ? '' : p.slice(0, i);
}

/** Resolves an \input argument to a known file: relative to the root, then the including file, then by unique name. */
export function resolveInput(raw: string, from: string, known: readonly string[]): string | null {
  const withExt = /\.[a-z]+$/i.test(raw) ? raw : `${raw}.tex`;
  const candidates = [normalizePath(withExt), normalizePath(`${dirname(from)}/${withExt}`)];
  for (const c of candidates) if (known.includes(c)) return c;
  const base = withExt.split('/').pop() ?? withExt;
  const byName = known.filter((k) => k === base || k.endsWith(`/${base}`));
  return byName.length === 1 ? (byName[0] ?? null) : null;
}

export function findMainFile(files: readonly ProjectFile[]): string | null {
  const mains = files.filter((f) => f.path.endsWith('.tex') && /\\documentclass\b/.test(f.text));
  if (mains.length === 0) return null;
  return (mains.find((f) => /(?:^|\/)main\.tex$/.test(f.path)) ?? mains[0])?.path ?? null;
}

export function flatten(files: readonly ProjectFile[], mainPath: string): Flattened {
  const byPath = new Map(files.map((f) => [f.path, f.text]));
  const known = [...byPath.keys()];
  const segments: Segment[] = [];
  const missing: string[] = [];
  const included: string[] = [];
  let out = '';

  const emit = (path: string, from: number, to: number) => {
    if (to <= from) return;
    const text = byPath.get(path) ?? '';
    segments.push({ path, fileStart: from, flatStart: out.length, length: to - from });
    out += text.slice(from, to);
  };

  const visit = (path: string, stack: string[]) => {
    const text = byPath.get(path) ?? '';
    included.push(path);
    const model = buildModel(text, path);
    let pos = 0;
    for (const input of model.inputs) {
      const target = resolveInput(input.path, path, known);
      if (target === null) {
        missing.push(input.path);
        continue;
      }
      if (stack.includes(target) || stack.length > MAX_DEPTH) continue;
      emit(path, pos, input.span.start);
      visit(target, [...stack, target]);
      pos = input.span.end;
    }
    emit(path, pos, text.length);
  };

  visit(mainPath, [mainPath]);
  return { text: out, segments, missing: [...new Set(missing)], included: [...new Set(included)] };
}

/** Maps a span of the flattened text back to one file, or null if it crosses files. */
export function mapSpan(
  segments: readonly Segment[],
  span: Span,
): { path: string; span: Span } | null {
  const empty = span.start === span.end;
  for (const s of segments) {
    const end = s.flatStart + s.length;
    const inside = empty
      ? span.start >= s.flatStart && span.start < end
      : span.start >= s.flatStart && span.end <= end;
    if (inside) {
      const delta = s.fileStart - s.flatStart;
      return { path: s.path, span: { start: span.start + delta, end: span.end + delta } };
    }
  }
  // Zero-width spans at a segment boundary belong to the segment that starts there.
  const at = segments.find((s) => span.start === span.end && span.start === s.flatStart + s.length);
  return at
    ? { path: at.path, span: { start: at.fileStart + at.length, end: at.fileStart + at.length } }
    : null;
}

function mapFix(fix: Fix, segments: readonly Segment[], path: string): Fix | null {
  const edits = [];
  for (const e of fix.edits) {
    const m = mapSpan(segments, { start: e.start, end: e.end });
    if (!m || m.path !== path) return null;
    edits.push({ ...e, start: m.span.start, end: m.span.end });
  }
  return { ...fix, edits };
}

export interface FileDiagnostics {
  path: string;
  diagnostics: Diagnostic[];
}

export interface ProjectAnalysis extends AnalysisResult {
  /** The file the user has open; `diagnostics` refer to it. */
  openPath: string;
  /** Whether the analysis covered the whole paper (flattened) or just the open file. */
  scope: 'project' | 'file';
  mainPath: string | null;
  /** Diagnostics located in other files, which the user can open to fix. */
  otherFiles: FileDiagnostics[];
  missingFiles: string[];
  knownFiles: string[];
  /** For outline units: the file each unit's heading lives in. */
  unitFiles: (string | null)[];
}

/**
 * Analyses the open file in the context of every known file of the project.
 * Falls back to single-file analysis when the open file is not reachable from
 * a main file Lemma knows.
 */
export function analyzeProject(
  files: readonly ProjectFile[],
  openPath: string,
  base: Omit<AnalyzeInput, 'text' | 'fileName' | 'model' | 'project'>,
): ProjectAnalysis {
  const bibEntries: BibEntry[] = files
    .filter((f) => f.path.endsWith('.bib'))
    .flatMap((f) => buildModel(f.text, f.path).bibEntries);
  const knownFiles = files.map((f) => f.path);
  const open = files.find((f) => f.path === openPath);
  const mainPath = findMainFile(files);
  const flat = mainPath ? flatten(files, mainPath) : null;

  if (!open || open.path.endsWith('.bib') || !flat || !flat.included.includes(openPath)) {
    const text = open?.text ?? '';
    const single = analyze({
      ...base,
      text,
      fileName: openPath,
      project: {
        ...(bibEntries.length > 0 ? { bibEntries } : {}),
      },
    });
    return {
      ...single,
      openPath,
      scope: 'file',
      mainPath,
      otherFiles: [],
      missingFiles: [],
      knownFiles,
      unitFiles: single.structure.map(() => openPath),
    };
  }

  const mainText = files.find((f) => f.path === mainPath)?.text ?? '';
  const model = buildModel(flat.text, mainPath);
  // Settings live in the main file's magic comment; flattening keeps it at the top.
  const result = analyze({
    ...base,
    text: flat.text,
    fileName: mainPath,
    model,
    project: {
      partial: flat.missing.length > 0,
      ...(bibEntries.length > 0 ? { bibEntries } : {}),
    },
  });

  const lineIndexes = new Map<string, LineIndex>();
  const lineIn = (path: string, offset: number) => {
    let idx = lineIndexes.get(path);
    if (!idx) {
      idx = new LineIndex(files.find((f) => f.path === path)?.text ?? '');
      lineIndexes.set(path, idx);
    }
    return idx.locate(offset).line;
  };

  const mine: Diagnostic[] = [];
  const others = new Map<string, Diagnostic[]>();
  for (const d of result.diagnostics) {
    const m = mapSpan(flat.segments, d.span) ?? {
      path: mainPath ?? openPath,
      span: { start: 0, end: 0 },
    };
    const fixes = d.fixes
      .map((f) => mapFix(f, flat.segments, m.path))
      .filter((f): f is Fix => f !== null);
    const mapped: Diagnostic = { ...d, span: m.span, line: lineIn(m.path, m.span.start), fixes };
    if (m.path === openPath) mine.push(mapped);
    else others.set(m.path, [...(others.get(m.path) ?? []), mapped]);
  }

  const structure = result.structure.map((u) => {
    const m = mapSpan(flat.segments, { start: u.span.start, end: u.span.start });
    return {
      unit: {
        ...u,
        span: m && m.path === openPath ? { start: m.span.start, end: m.span.start } : u.span,
      },
      path: m?.path ?? null,
    };
  });

  return {
    ...result,
    fileName: openPath,
    isMain: openPath === mainPath,
    magic: openPath === mainPath ? result.magic : null,
    diagnostics: mine,
    structure: structure.map((s) => s.unit),
    unitFiles: structure.map((s) => s.path),
    openPath,
    scope: 'project',
    mainPath,
    otherFiles: [...others.entries()].map(([path, diagnostics]) => ({ path, diagnostics })),
    missingFiles: flat.missing,
    knownFiles,
    partial: flat.missing.length > 0,
    partialReasons:
      flat.missing.length > 0
        ? [
            `Lemma has not seen ${flat.missing.join(', ')}. Open those files in Overleaf (or import the project zip) for a complete view.`,
          ]
        : [],
    stats: { ...result.stats, lines: mainText.split('\n').length },
  };
}
