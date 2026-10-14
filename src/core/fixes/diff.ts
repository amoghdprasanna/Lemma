import { applyEdits, normalizeEdits, type TextEdit } from './text-edit';

export interface DiffLine {
  type: 'context' | 'remove' | 'add';
  text: string;
  /** 1-based line number in the old (context/remove) or new (add) text. */
  line: number;
}

export interface DiffHunk {
  lines: DiffLine[];
}

const CONTEXT = 2;

function lineOf(starts: number[], offset: number): number {
  let lo = 0;
  let hi = starts.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if ((starts[mid] ?? 0) <= offset) lo = mid;
    else hi = mid - 1;
  }
  return lo;
}

function lineStarts(text: string): number[] {
  const starts = [0];
  for (let i = 0; i < text.length; i++) if (text[i] === '\n') starts.push(i + 1);
  return starts;
}

/** Line-based preview of what `edits` will do to `text`. Pure. */
export function diffEdits(text: string, edits: readonly TextEdit[]): DiffHunk[] {
  const sorted = normalizeEdits(edits);
  if (sorted === null || sorted.length === 0) return [];
  const after = applyEdits(text, sorted);
  const oldLines = text.split('\n');
  const newLines = after.split('\n');
  const oldStarts = lineStarts(text);

  // Old line ranges touched by each edit, padded with context and merged.
  const ranges: [number, number, number][] = []; // [firstLine, lastLine, editIndexEnd)
  sorted.forEach((e, i) => {
    const first = Math.max(0, lineOf(oldStarts, e.start) - CONTEXT);
    const last = Math.min(oldLines.length - 1, lineOf(oldStarts, e.end) + CONTEXT);
    const prev = ranges[ranges.length - 1];
    if (prev && first <= prev[1] + 1) {
      prev[1] = Math.max(prev[1], last);
      prev[2] = i + 1;
    } else ranges.push([first, last, i + 1]);
  });

  const hunks: DiffHunk[] = [];
  let delta = 0; // newLines index shift from edits before the current hunk
  let editCursor = 0;
  for (const [first, last, editEnd] of ranges) {
    let hunkDelta = 0;
    for (let i = editCursor; i < editEnd; i++) {
      const e = sorted[i];
      if (!e) continue;
      const removed = text.slice(e.start, e.end).split('\n').length - 1;
      const added = e.insert.split('\n').length - 1;
      hunkDelta += added - removed;
    }
    editCursor = editEnd;
    const oldSlice = oldLines.slice(first, last + 1);
    const newSlice = newLines.slice(first + delta, last + 1 + delta + hunkDelta);
    let head = 0;
    while (head < oldSlice.length && head < newSlice.length && oldSlice[head] === newSlice[head])
      head++;
    let tail = 0;
    while (
      tail < oldSlice.length - head &&
      tail < newSlice.length - head &&
      oldSlice[oldSlice.length - 1 - tail] === newSlice[newSlice.length - 1 - tail]
    )
      tail++;
    const lines: DiffLine[] = [];
    oldSlice
      .slice(0, head)
      .forEach((t, i) => lines.push({ type: 'context', text: t, line: first + i + 1 }));
    oldSlice
      .slice(head, oldSlice.length - tail)
      .forEach((t, i) => lines.push({ type: 'remove', text: t, line: first + head + i + 1 }));
    newSlice
      .slice(head, newSlice.length - tail)
      .forEach((t, i) => lines.push({ type: 'add', text: t, line: first + delta + head + i + 1 }));
    oldSlice
      .slice(oldSlice.length - tail)
      .forEach((t, i) =>
        lines.push({ type: 'context', text: t, line: first + oldSlice.length - tail + i + 1 }),
      );
    hunks.push({ lines });
    delta += hunkDelta;
  }
  return hunks;
}

/** Plain unified-diff-like text, for snapshots and accessibility. */
export function formatDiff(hunks: readonly DiffHunk[]): string {
  return hunks
    .map((h) =>
      h.lines
        .map((l) => `${l.type === 'add' ? '+' : l.type === 'remove' ? '-' : ' '} ${l.text}`)
        .join('\n'),
    )
    .join('\n@@\n');
}
