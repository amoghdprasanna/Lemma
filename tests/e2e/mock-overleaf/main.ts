/**
 * A stand-in for Overleaf's editor page, built for the e2e tests. It mirrors
 * the contract Lemma relies on (docs/adr/0002-overleaf-editor-access.md):
 * - dispatches `UNSTABLE_editor:extensions` with exported CodeMirror objects
 *   and an `extensions` array, and re-dispatches on `editor:extension-loaded`;
 * - exposes `window.overleaf.unstable.store` with editor.view / open_doc_name;
 * - renders a raw compile log in `pre.log-entry-content-raw`.
 * Never test against live Overleaf.
 */
import {
  history,
  historyKeymap,
  invertedEffects,
  isolateHistory,
  redo,
  undo,
} from '@codemirror/commands';
import {
  ChangeSet,
  Compartment,
  EditorSelection,
  EditorState,
  type Extension,
} from '@codemirror/state';
import { EditorView, keymap, ViewPlugin } from '@codemirror/view';

const CodeMirror = {
  ChangeSet,
  EditorSelection,
  EditorView,
  ViewPlugin,
  keymap,
  undo,
  redo,
  invertedEffects,
  isolateHistory,
};

declare global {
  interface Window {
    overleaf?: { unstable?: { store?: unknown } };
    mock: { view: EditorView; text(): string; undo(): boolean; type(s: string): void };
  }
}

const params = new URLSearchParams(location.search);
const docName = params.get('file') ?? 'main.tex';
const initial = document.getElementById('initial-doc')?.textContent ?? '';

// --- the unstable store ---
const values = new Map<string, unknown>([
  ['editor.open_doc_name', docName],
  ['editor.open_doc_id', 'doc-1'],
]);
const watchers = new Map<string, Set<(v: unknown) => void>>();
window.overleaf = {
  unstable: {
    store: {
      get: (path: string) => values.get(path),
      watch: (path: string, cb: (v: unknown) => void) => {
        const set = watchers.get(path) ?? new Set();
        set.add(cb);
        watchers.set(path, set);
        return () => set.delete(cb);
      },
    },
  },
};

// --- third-party extension hook, as in Overleaf's third-party-extensions.ts ---
const thirdParty = new Compartment();
const collect = (): Extension[] => {
  const extensions: Extension[] = [];
  window.dispatchEvent(
    new CustomEvent('UNSTABLE_editor:extensions', { detail: { CodeMirror, extensions } }),
  );
  return extensions;
};

const view = new EditorView({
  parent: document.getElementById('editor') ?? document.body,
  state: EditorState.create({
    doc: initial,
    extensions: [history(), keymap.of(historyKeymap), thirdParty.of(collect())],
  }),
});
values.set('editor.view', view);
window.addEventListener('editor:extension-loaded', () => {
  view.dispatch({ effects: thirdParty.reconfigure(collect()) });
});

window.mock = {
  view,
  text: () => view.state.doc.toString(),
  undo: () => undo(view),
  type: (s: string) => {
    view.dispatch({ changes: { from: view.state.doc.length, insert: s }, userEvent: 'input.type' });
  },
};
