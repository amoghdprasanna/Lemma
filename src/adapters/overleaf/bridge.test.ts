import { describe, expect, it, vi } from 'vitest';
import { makeMessage, type Message } from '@/src/messaging/protocol';
import type { Transport } from '@/src/adapters/page/hook';
import { startBridge, type PortLike } from './bridge';
import { runtimeEditorPort } from './runtime-editor-port';

function pagePair() {
  const toPage: Message[] = [];
  let fromPage: ((raw: unknown) => void) | null = null;
  const page: Transport = {
    post: (m) => toPage.push(m),
    listen: (cb) => {
      fromPage = cb;
      return () => (fromPage = null);
    },
  };
  return { page, toPage, emit: (raw: unknown) => fromPage?.(raw) };
}

/** Two connected in-memory ports (panel end, bridge end). */
function portPair(): [PortLike, PortLike, () => void] {
  const listeners: [((m: unknown) => void)[], ((m: unknown) => void)[]] = [[], []];
  const disconnects: [(() => void)[], (() => void)[]] = [[], []];
  const make = (me: 0 | 1): PortLike => ({
    postMessage: (m) => {
      for (const l of listeners[me === 0 ? 1 : 0]) l(structuredClone(m));
    },
    onMessage: { addListener: (cb) => listeners[me].push(cb) },
    onDisconnect: { addListener: (cb) => disconnects[me].push(cb) },
  });
  return [
    make(0),
    make(1),
    () => {
      for (const d of [...disconnects[0], ...disconnects[1]]) d();
    },
  ];
}

describe('bridge + runtime editor port', () => {
  it('relays snapshots to the panel and edits to the page, nothing else', async () => {
    const { page, toPage, emit } = pagePair();
    const bridge = startBridge({ page, readLog: () => '! Undefined control sequence.\nl.1 \\x' });
    const [panelEnd, bridgeEnd] = portPair();
    const editor = runtimeEditorPort(() => {
      bridge.connect(bridgeEnd);
      return panelEnd;
    });

    const snapshots: string[] = [];
    editor.onSnapshot((s) => snapshots.push(s.text));
    emit(
      makeMessage('editor/snapshot', {
        text: 'hello',
        version: 3,
        fileName: 'main.tex',
        docId: 'd',
      }),
    );
    emit(
      makeMessage('editor/apply', {
        requestId: 'x',
        version: 1,
        edits: [{ from: 0, to: 0, insert: 'evil' }],
      }),
    );
    emit({ junk: true });
    expect(snapshots).toEqual(['hello']);

    // The panel asked for a snapshot on connect; the spoofed apply never reached the page.
    expect(toPage.map((m) => m.type)).toEqual(['editor/request-snapshot']);

    const result = editor.applyEdits([{ from: 0, to: 5, insert: 'hi' }], 3);
    const sent = toPage.at(-1);
    expect(sent?.type).toBe('editor/apply');
    if (sent?.type !== 'editor/apply') throw new Error('no apply');
    emit(makeMessage('editor/applied', { requestId: sent.payload.requestId, ok: true }));
    await expect(result).resolves.toEqual({ ok: true });

    await expect(editor.readCompileLog()).resolves.toContain('Undefined control sequence');
    editor.dispose();
    bridge.stop();
  });

  it('replays the last status and snapshot to a panel that connects later', () => {
    const { page, emit } = pagePair();
    const bridge = startBridge({ page, readLog: () => null });
    emit(makeMessage('editor/status', { state: 'ready', fileName: 'main.tex', docId: null }));
    emit(
      makeMessage('editor/snapshot', {
        text: 'late',
        version: 1,
        fileName: 'main.tex',
        docId: null,
      }),
    );
    const [panelEnd, bridgeEnd] = portPair();
    const statuses: string[] = [];
    const texts: string[] = [];
    const editor = runtimeEditorPort(() => {
      const p = panelEnd;
      // Listeners are attached by runtimeEditorPort before the bridge replays.
      setTimeout(() => bridge.connect(bridgeEnd), 0);
      return p;
    });
    editor.onStatus((s) => statuses.push(s.state));
    editor.onSnapshot((s) => texts.push(s.text));
    return vi.waitFor(() => {
      expect(statuses).toContain('ready');
      expect(texts).toEqual(['late']);
    });
  });

  it('fails pending edits and reconnects when the page goes away', async () => {
    vi.useFakeTimers();
    const { page } = pagePair();
    const bridge = startBridge({ page, readLog: () => null });
    let connections = 0;
    let drop: () => void = () => undefined;
    const editor = runtimeEditorPort(
      () => {
        connections++;
        const [a, b, disconnect] = portPair();
        bridge.connect(b);
        drop = disconnect;
        return a;
      },
      { retryMs: 100 },
    );
    const result = editor.applyEdits([{ from: 0, to: 0, insert: '' }], 1);
    drop();
    await expect(result).resolves.toMatchObject({ ok: false, error: 'unavailable' });
    vi.advanceTimersByTime(100);
    expect(connections).toBe(2);
    editor.dispose();
    vi.useRealTimers();
  });
});
