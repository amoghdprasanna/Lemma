/**
 * The only kinds of change Lemma may make (docs/adr/0003-no-content-generation.md):
 * - mechanical: deterministic rewrites of existing text (`\ref` -> `\eqref`, `~`);
 * - skeleton: empty structure plus curated TODO prompts;
 * - settings: the `% lemma:` magic comment.
 * There is deliberately no free-text kind.
 */
export type EditKind = 'mechanical' | 'skeleton' | 'settings';

export interface TextEdit {
  kind: EditKind;
  start: number;
  end: number;
  insert: string;
}

export interface Fix {
  title: string;
  edits: TextEdit[];
}

export function mechanical(start: number, end: number, insert: string): TextEdit {
  return { kind: 'mechanical', start, end, insert };
}

/** Sorted ascending and non-overlapping, or null. */
export function normalizeEdits(edits: readonly TextEdit[]): TextEdit[] | null {
  const sorted = [...edits].sort((a, b) => a.start - b.start || a.end - b.end);
  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1];
    const cur = sorted[i];
    if (prev && cur && cur.start < prev.end) return null;
  }
  return sorted;
}

/** Applies non-overlapping edits. Throws on overlap or out-of-range edits. */
export function applyEdits(text: string, edits: readonly TextEdit[]): string {
  const sorted = normalizeEdits(edits);
  if (sorted === null) throw new Error('Overlapping edits');
  let out = '';
  let pos = 0;
  for (const e of sorted) {
    if (e.start < pos || e.end > text.length || e.start > e.end)
      throw new Error('Edit out of range');
    out += text.slice(pos, e.start) + e.insert;
    pos = e.end;
  }
  return out + text.slice(pos);
}
