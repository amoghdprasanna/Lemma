import type { EditOp } from '@/src/ports/editor';

/**
 * An editor living in the page. The hook (hook.ts) handles versions,
 * debouncing and messaging; implementations only read, write and reveal.
 */
export interface PageEditor {
  readonly kind: 'codemirror' | 'textarea';
  text(): string;
  /** Applies edits (offsets relative to the current text) as one undoable step. */
  apply(edits: readonly EditOp[]): void;
  reveal(from: number, to: number): void;
}

// --- CodeMirror 6, typed structurally so Lemma does not bundle CodeMirror. ---

export interface MinimalView {
  state: { doc: { toString(): string; length: number } };
  dispatch(spec: Record<string, unknown>): void;
  focus(): void;
}

export interface MinimalViewUpdate {
  docChanged: boolean;
  view: MinimalView;
}

/** The subset of Overleaf's exported `CodeMirror` object Lemma uses. */
export interface CmExports {
  ViewPlugin: {
    define(
      create: (view: MinimalView) => { update?(u: MinimalViewUpdate): void; destroy?(): void },
    ): unknown;
  };
  isolateHistory?: { of(value: 'before' | 'after' | 'full'): unknown };
}

export function codeMirrorEditor(view: MinimalView, cm: CmExports | null): PageEditor {
  return {
    kind: 'codemirror',
    text: () => view.state.doc.toString(),
    apply(edits) {
      const annotation = cm?.isolateHistory?.of('full');
      view.dispatch({
        changes: edits.map((e) => ({ from: e.from, to: e.to, insert: e.insert })),
        userEvent: 'input.lemma',
        scrollIntoView: true,
        ...(annotation !== undefined ? { annotations: annotation } : {}),
      });
    },
    reveal(from, to) {
      view.dispatch({ selection: { anchor: from, head: to }, scrollIntoView: true });
      view.focus();
    },
  };
}

// --- A plain <textarea>: the fallback that proves the adapter seam is real. ---

export function textareaEditor(ta: HTMLTextAreaElement): PageEditor {
  return {
    kind: 'textarea',
    text: () => ta.value,
    apply(edits) {
      ta.focus();
      // Back to front so earlier offsets stay valid. execCommand keeps the
      // browser's own undo stack; setRangeText is the fallback.
      for (const e of [...edits].sort((a, b) => b.from - a.from)) {
        ta.setSelectionRange(e.from, e.to);
        const doc = ta.ownerDocument as Document & {
          execCommand?: (cmd: string, ui: boolean, value: string) => boolean;
        };
        // execCommand is deprecated but still the only way to keep a textarea's native undo.
        const ok =
          typeof doc.execCommand === 'function' && // eslint-disable-line @typescript-eslint/no-deprecated
          doc.execCommand('insertText', false, e.insert); // eslint-disable-line @typescript-eslint/no-deprecated
        if (!ok) ta.setRangeText(e.insert, e.from, e.to, 'end');
      }
      ta.dispatchEvent(new Event('input', { bubbles: true }));
    },
    reveal(from, to) {
      ta.focus();
      ta.setSelectionRange(from, to);
    },
  };
}
