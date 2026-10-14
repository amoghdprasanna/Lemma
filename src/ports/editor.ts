/**
 * How the core reaches an editor. Implemented by the Overleaf adapter (via
 * the content-script bridge) and by test fakes; the core never sees Overleaf.
 */
export type EditorStatus =
  | { state: 'connecting' }
  | { state: 'ready'; fileName: string | null; docId: string | null }
  | { state: 'unavailable'; reason: string };

export interface EditorSnapshot {
  text: string;
  /** Increments on every change; edits carry the version they were computed against. */
  version: number;
  fileName: string | null;
  docId: string | null;
}

export interface EditOp {
  from: number;
  to: number;
  insert: string;
}

export type ApplyResult =
  { ok: true } | { ok: false; error: 'stale' | 'unavailable' | 'rejected'; message: string };

export interface EditorPort {
  onStatus(cb: (status: EditorStatus) => void): () => void;
  onSnapshot(cb: (snapshot: EditorSnapshot) => void): () => void;
  requestSnapshot(): void;
  /** Applies edits as one undoable step, only if the document is still at `version`. */
  applyEdits(edits: EditOp[], version: number): Promise<ApplyResult>;
  /** Selects and scrolls to a range. */
  reveal(from: number, to: number): void;
  /** Raw compile log, if the host page shows one. */
  readCompileLog(): Promise<string | null>;
  dispose(): void;
}
