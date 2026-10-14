// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { makeMessage, type Message, type MessageOf } from '@/src/messaging/protocol';
import type { CmExports, MinimalView, MinimalViewUpdate } from './editors';
import { startPageHook, type Transport } from './hook';

/** In-memory transport: what the hook posts, and a way to send it messages. */
function memoryTransport() {
  const posted: Message[] = [];
  let listener: ((raw: unknown) => void) | null = null;
  const transport: Transport = {
    post: (m) => posted.push(m),
    listen: (cb) => {
      listener = cb;
      return () => (listener = null);
    },
  };
  return {
    transport,
    posted,
    send: (raw: unknown) => listener?.(raw),
    last<T extends Message['type']>(type: T): MessageOf<T> | undefined {
      return [...posted].reverse().find((m): m is MessageOf<T> => m.type === type);
    },
  };
}

/** A tiny stand-in for CodeMirror's EditorView and Overleaf's extension event. */
function fakeCodeMirror(initial: string) {
  let text = initial;
  const plugins: { update?(u: MinimalViewUpdate): void }[] = [];
  const dispatched: Record<string, unknown>[] = [];
  const view: MinimalView = {
    state: { doc: { toString: () => text, length: text.length } },
    dispatch(spec) {
      dispatched.push(spec);
      const changes = spec.changes as { from: number; to: number; insert: string }[] | undefined;
      if (changes) {
        for (const c of [...changes].sort((a, b) => b.from - a.from)) {
          text = text.slice(0, c.from) + c.insert + text.slice(c.to);
        }
        view.state = { doc: { toString: () => text, length: text.length } };
        for (const p of plugins) p.update?.({ docChanged: true, view });
      }
    },
    focus: () => undefined,
  };
  const cm: CmExports = {
    ViewPlugin: { define: (create) => ({ create }) },
    isolateHistory: { of: (v) => `isolate:${v}` },
  };
  const fire = () => {
    const extensions: { create: (v: MinimalView) => { update?(u: MinimalViewUpdate): void } }[] =
      [];
    window.dispatchEvent(
      new CustomEvent('UNSTABLE_editor:extensions', { detail: { CodeMirror: cm, extensions } }),
    );
    for (const e of extensions) plugins.push(e.create(view));
  };
  return {
    view,
    dispatched,
    fire,
    type(s: string) {
      view.dispatch({ changes: [{ from: text.length, to: text.length, insert: s }] });
    },
    get text() {
      return text;
    },
  };
}

describe('page hook', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
    document.body.innerHTML = '';
    delete (window as { overleaf?: unknown }).overleaf;
  });

  it('attaches through the Overleaf extension event and debounces snapshots', () => {
    const t = memoryTransport();
    const hook = startPageHook({ win: window, transport: t.transport, debounceMs: 500 });
    const cm = fakeCodeMirror('\\section{A}');
    cm.fire();
    expect(t.last('editor/status')?.payload.state).toBe('ready');
    expect(t.last('editor/snapshot')?.payload.text).toBe('\\section{A}');

    cm.type(' x');
    cm.type(' y');
    const before = t.posted.filter((m) => m.type === 'editor/snapshot').length;
    vi.advanceTimersByTime(499);
    expect(t.posted.filter((m) => m.type === 'editor/snapshot').length).toBe(before);
    vi.advanceTimersByTime(1);
    expect(t.last('editor/snapshot')?.payload.text).toBe('\\section{A} x y');
    hook.stop();
  });

  it('applies edits as one isolated, undoable transaction and rejects stale ones', () => {
    const t = memoryTransport();
    const hook = startPageHook({ win: window, transport: t.transport, debounceMs: 0 });
    const cm = fakeCodeMirror('see \\ref{eq:a}');
    cm.fire();
    const version = t.last('editor/snapshot')?.payload.version ?? -1;

    t.send(
      makeMessage('editor/apply', {
        requestId: 'r1',
        version: version + 5,
        edits: [{ from: 0, to: 0, insert: 'x' }],
      }),
    );
    expect(t.last('editor/applied')?.payload).toMatchObject({
      requestId: 'r1',
      ok: false,
      error: 'stale',
    });

    t.send(
      makeMessage('editor/apply', {
        requestId: 'r2',
        version,
        edits: [{ from: 4, to: 14, insert: '\\eqref{eq:a}' }],
      }),
    );
    expect(t.last('editor/applied')?.payload).toMatchObject({ requestId: 'r2', ok: true });
    expect(cm.text).toBe('see \\eqref{eq:a}');
    expect(cm.dispatched.at(-1)).toMatchObject({
      userEvent: 'input.lemma',
      annotations: 'isolate:full',
    });
    hook.stop();
  });

  it('rejects out-of-range edits and ignores foreign messages', () => {
    const t = memoryTransport();
    const hook = startPageHook({ win: window, transport: t.transport });
    const cm = fakeCodeMirror('abc');
    cm.fire();
    const version = t.last('editor/snapshot')?.payload.version ?? -1;
    t.send(
      makeMessage('editor/apply', {
        requestId: 'r',
        version,
        edits: [{ from: 2, to: 9, insert: '' }],
      }),
    );
    expect(t.last('editor/applied')?.payload).toMatchObject({ ok: false, error: 'rejected' });
    const count = t.posted.length;
    t.send({ ns: 'lemma', v: 1, type: 'editor/apply', payload: { evil: true } });
    t.send(
      makeMessage('editor/snapshot', { text: 'spoof', version: 1, fileName: null, docId: null }),
    );
    expect(t.posted.length).toBe(count);
    expect(cm.text).toBe('abc');
    hook.stop();
  });

  it('reads the file name from the Overleaf store and reports changes', () => {
    const watchers = new Map<string, (v: unknown) => void>();
    const values: Record<string, unknown> = {
      'editor.open_doc_name': 'main.tex',
      'editor.open_doc_id': 'd1',
    };
    (window as { overleaf?: unknown }).overleaf = {
      unstable: {
        store: {
          get: (p: string) => values[p],
          watch: (p: string, cb: (v: unknown) => void) => {
            watchers.set(p, cb);
            return () => watchers.delete(p);
          },
        },
      },
    };
    const t = memoryTransport();
    const hook = startPageHook({ win: window, transport: t.transport, pollMs: 10 });
    const cm = fakeCodeMirror('x');
    cm.fire();
    vi.advanceTimersByTime(10);
    watchers.get('editor.open_doc_name')?.('intro.tex');
    expect(t.last('editor/snapshot')?.payload.fileName).toBe('intro.tex');
    hook.stop();
  });

  it('falls back to a marked textarea', () => {
    document.body.innerHTML = '<textarea data-lemma-editor>Hello $$x$$</textarea>';
    const t = memoryTransport();
    const hook = startPageHook({ win: window, transport: t.transport, pollMs: 10, debounceMs: 0 });
    vi.advanceTimersByTime(10);
    expect(t.last('editor/snapshot')?.payload.text).toBe('Hello $$x$$');
    const version = t.last('editor/snapshot')?.payload.version ?? -1;
    t.send(
      makeMessage('editor/apply', {
        requestId: 'r',
        version,
        edits: [
          { from: 6, to: 8, insert: '\\[' },
          { from: 9, to: 11, insert: '\\]' },
        ],
      }),
    );
    expect(t.last('editor/applied')?.payload.ok).toBe(true);
    expect(document.querySelector('textarea')?.value).toBe('Hello \\[x\\]');
    hook.stop();
  });

  it('reports the editor as unavailable after giving up', () => {
    const t = memoryTransport();
    const hook = startPageHook({
      win: window,
      transport: t.transport,
      pollMs: 100,
      giveUpMs: 1000,
    });
    vi.advanceTimersByTime(1200);
    expect(t.last('editor/status')?.payload.state).toBe('unavailable');
    hook.stop();
  });
});
