import { OVERLEAF } from '@/src/adapters/overleaf/selectors';
import { makeMessage, parseMessage, TO_PAGE, type Message } from '@/src/messaging/protocol';
import type { EditOp } from '@/src/ports/editor';
import {
  codeMirrorEditor,
  textareaEditor,
  type CmExports,
  type MinimalView,
  type PageEditor,
} from './editors';

/**
 * Runs in the page's MAIN world (docs/adr/0002-overleaf-editor-access.md).
 * Finds the editor, reports its text (debounced), and applies edits the
 * panel asks for. Anything arriving from the window is validated first.
 */
export interface Transport {
  post(msg: Message): void;
  listen(cb: (raw: unknown) => void): () => void;
}

export function windowTransport(win: Window): Transport {
  return {
    post: (msg) => {
      win.postMessage(msg, win.location.origin);
    },
    listen: (cb) => {
      const handler = (e: MessageEvent) => {
        if (e.source === win && e.origin === win.location.origin) cb(e.data);
      };
      win.addEventListener('message', handler);
      return () => {
        win.removeEventListener('message', handler);
      };
    },
  };
}

export interface HookOptions {
  win: Window;
  transport: Transport;
  debounceMs?: number;
  /** How long to look for an editor before reporting it unavailable. */
  giveUpMs?: number;
  pollMs?: number;
}

interface OverleafStore {
  get(path: string): unknown;
  watch?(path: string, cb: (value: unknown) => void): () => void;
}

function overleafStore(win: Window): OverleafStore | null {
  const store = (win as unknown as { overleaf?: { unstable?: { store?: OverleafStore } } }).overleaf
    ?.unstable?.store;
  return store && typeof store.get === 'function' ? store : null;
}

function asString(v: unknown): string | null {
  return typeof v === 'string' ? v : null;
}

function isView(v: unknown): v is MinimalView {
  return (
    typeof v === 'object' &&
    v !== null &&
    'state' in v &&
    'dispatch' in v &&
    typeof (v as { dispatch: unknown }).dispatch === 'function'
  );
}

export function startPageHook(opts: HookOptions): { stop(): void } {
  const { win, transport } = opts;
  const debounceMs = opts.debounceMs ?? 500;
  const giveUpMs = opts.giveUpMs ?? 15_000;
  const pollMs = opts.pollMs ?? 500;

  let editor: PageEditor | null = null;
  const currentEditor = () => editor;
  let editorSource: unknown = null; // the view or element behind `editor`
  let cm: CmExports | null = null;
  let version = 0;
  let fileName: string | null = null;
  let docId: string | null = null;
  let snapshotTimer: ReturnType<typeof setTimeout> | null = null;
  let lastDoc: unknown = null;
  let stopped = false;
  const cleanups: (() => void)[] = [];

  const status = () => {
    if (editor) transport.post(makeMessage('editor/status', { state: 'ready', fileName, docId }));
  };
  const snapshot = () => {
    if (snapshotTimer) clearTimeout(snapshotTimer);
    snapshotTimer = null;
    if (!editor || stopped) return;
    transport.post(
      makeMessage('editor/snapshot', { text: editor.text(), version, fileName, docId }),
    );
  };
  const changed = () => {
    version++;
    if (snapshotTimer) clearTimeout(snapshotTimer);
    snapshotTimer = setTimeout(snapshot, debounceMs);
  };
  const attach = (source: unknown, e: PageEditor) => {
    if (editorSource === source) return;
    editorSource = source;
    editor = e;
    version++;
    status();
    snapshot();
  };

  transport.post(makeMessage('editor/status', { state: 'connecting' }));

  // 1. Overleaf's extension hook: gives us the CodeMirror exports and change events.
  const onExtensions = (event: Event) => {
    const detail = (event as CustomEvent<{ CodeMirror?: CmExports; extensions?: unknown[] }>)
      .detail;
    const exports = detail.CodeMirror;
    if (!exports || !Array.isArray(detail.extensions)) return;
    cm = exports;
    detail.extensions.push(
      exports.ViewPlugin.define((view) => {
        attach(view, codeMirrorEditor(view, exports));
        return {
          update(u) {
            if (u.docChanged && editorSource === u.view) changed();
          },
          destroy() {
            if (editorSource === view) {
              editorSource = null;
              editor = null;
            }
          },
        };
      }),
    );
  };
  win.addEventListener(OVERLEAF.extensionsEvent, onExtensions);
  cleanups.push(() => {
    win.removeEventListener(OVERLEAF.extensionsEvent, onExtensions);
  });

  // 2. Overleaf's unstable store: file name and id, and the view as a fallback.
  let watching = false;
  const watchStore = (store: OverleafStore) => {
    if (watching) return;
    watching = true;
    fileName = asString(store.get(OVERLEAF.store.docName));
    docId = asString(store.get(OVERLEAF.store.docId));
    // The editor may have attached before the store existed: announce the name now.
    if (editor) {
      status();
      snapshot();
    }
    for (const [path, set] of [
      [OVERLEAF.store.docName, (v: unknown) => (fileName = asString(v))],
      [OVERLEAF.store.docId, (v: unknown) => (docId = asString(v))],
    ] as const) {
      const unwatch = store.watch?.(path, (v) => {
        set(v);
        version++;
        status();
        snapshot();
      });
      if (unwatch) cleanups.push(unwatch);
    }
  };

  const started = Date.now();
  let askedOverleafToReload = false;
  const poll = setInterval(() => {
    const store = overleafStore(win);
    if (store) watchStore(store);
    if (!editor) {
      const view = store?.get(OVERLEAF.store.view);
      if (isView(view)) {
        if (cm === null && !askedOverleafToReload) {
          // Loaded after the editor: ask Overleaf to re-run extension setup.
          askedOverleafToReload = true;
          win.dispatchEvent(new Event(OVERLEAF.reloadExtensionsEvent));
        } else attach(view, codeMirrorEditor(view, cm));
      } else {
        const ta = win.document.querySelector<HTMLTextAreaElement>(OVERLEAF.textareaFallback);
        if (ta) {
          attach(ta, textareaEditor(ta));
          const onInput = () => {
            changed();
          };
          ta.addEventListener('input', onInput);
          cleanups.push(() => {
            ta.removeEventListener('input', onInput);
          });
        }
      }
      // attach() above may have set `editor`; read it fresh.
      if (currentEditor() === null && Date.now() - started > giveUpMs) {
        transport.post(
          makeMessage('editor/status', {
            state: 'unavailable',
            reason:
              "Lemma can't find Overleaf's editor on this page. Overleaf may have changed how extensions reach it; Lemma needs an update.",
          }),
        );
        clearInterval(poll);
      }
    } else if (cm === null && isView(editorSource)) {
      // Store-only fallback: no change events, so watch the document identity.
      const doc = editorSource.state.doc;
      if (lastDoc !== null && doc !== lastDoc) changed();
      lastDoc = doc;
    }
  }, pollMs);
  cleanups.push(() => {
    clearInterval(poll);
  });

  // 3. Requests from the panel (via the isolated content script).
  cleanups.push(
    transport.listen((raw) => {
      const msg = parseMessage(raw);
      if (!msg || !TO_PAGE.has(msg.type)) return;
      if (msg.type === 'editor/request-snapshot') {
        status();
        snapshot();
      } else if (msg.type === 'editor/reveal') {
        editor?.reveal(msg.payload.from, msg.payload.to);
      } else if (msg.type === 'editor/apply') {
        const { requestId, edits } = msg.payload;
        const reply = (
          ok: boolean,
          error?: 'stale' | 'unavailable' | 'rejected',
          message?: string,
        ) => {
          transport.post(
            makeMessage('editor/applied', {
              requestId,
              ok,
              ...(error ? { error } : {}),
              ...(message ? { message } : {}),
            }),
          );
        };
        if (!editor) {
          reply(false, 'unavailable', 'The editor is not available.');
          return;
        }
        if (msg.payload.version !== version) {
          reply(false, 'stale', 'The document changed since this fix was computed.');
          return;
        }
        if (!validEdits(edits, editor.text().length)) {
          reply(false, 'rejected', 'Edits are out of range.');
          return;
        }
        try {
          editor.apply(edits);
          reply(true);
        } catch (e) {
          reply(false, 'rejected', e instanceof Error ? e.message : 'The editor refused the edit.');
        }
      }
    }),
  );

  return {
    stop() {
      stopped = true;
      if (snapshotTimer) clearTimeout(snapshotTimer);
      for (const c of cleanups) c();
    },
  };
}

function validEdits(edits: readonly EditOp[], length: number): boolean {
  const sorted = [...edits].sort((a, b) => a.from - b.from);
  let pos = 0;
  for (const e of sorted) {
    if (e.from < pos || e.to < e.from || e.to > length) return false;
    pos = e.to;
  }
  return true;
}
