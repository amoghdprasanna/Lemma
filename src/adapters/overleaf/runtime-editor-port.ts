import { makeMessage, parseMessage } from '@/src/messaging/protocol';
import type {
  ApplyResult,
  EditOp,
  EditorPort,
  EditorSnapshot,
  EditorStatus,
} from '@/src/ports/editor';
import type { PortLike } from './bridge';

/** EditorPort for tabs Lemma cannot work with: reports why, never connects. */
export function unavailableEditorPort(reason: string): EditorPort {
  return {
    onStatus(cb) {
      cb({ state: 'unavailable', reason });
      return () => undefined;
    },
    onSnapshot: () => () => undefined,
    requestSnapshot: () => undefined,
    applyEdits: () => Promise.resolve({ ok: false, error: 'unavailable', message: reason }),
    reveal: () => undefined,
    readCompileLog: () => Promise.resolve(null),
    dispose: () => undefined,
  };
}

/**
 * EditorPort for the side panel: talks to the tab's content-script bridge over
 * a runtime port, reconnecting when the page reloads.
 */
export function runtimeEditorPort(
  connect: () => PortLike,
  opts: { retryMs?: number; timeoutMs?: number } = {},
): EditorPort {
  const retryMs = opts.retryMs ?? 1000;
  const timeoutMs = opts.timeoutMs ?? 5000;
  const statusListeners = new Set<(s: EditorStatus) => void>();
  const snapshotListeners = new Set<(s: EditorSnapshot) => void>();
  const pending = new Map<string, (r: ApplyResult) => void>();
  const pendingLogs = new Map<string, (text: string | null) => void>();
  let port: PortLike | null = null;
  let disposed = false;
  let counter = 0;
  let failures = 0;
  const nextId = () => `${String(Date.now())}-${String(++counter)}`;

  const emitStatus = (s: EditorStatus) => {
    for (const l of statusListeners) l(s);
  };

  const open = () => {
    if (disposed) return;
    try {
      port = connect();
    } catch {
      emitStatus({
        state: 'unavailable',
        reason: 'This tab is not an Overleaf project, or Lemma could not reach it.',
      });
      return;
    }
    port.onMessage.addListener((raw) => {
      const msg = parseMessage(raw);
      if (!msg) return;
      switch (msg.type) {
        case 'editor/status': {
          const p = msg.payload;
          emitStatus(
            p.state === 'ready'
              ? { state: 'ready', fileName: p.fileName ?? null, docId: p.docId ?? null }
              : p.state === 'unavailable'
                ? { state: 'unavailable', reason: p.reason ?? 'The editor is not available.' }
                : { state: 'connecting' },
          );
          break;
        }
        case 'editor/snapshot':
          failures = 0;
          for (const l of snapshotListeners) l(msg.payload);
          break;
        case 'editor/applied': {
          const done = pending.get(msg.payload.requestId);
          pending.delete(msg.payload.requestId);
          done?.(
            msg.payload.ok
              ? { ok: true }
              : {
                  ok: false,
                  error: msg.payload.error ?? 'rejected',
                  message: msg.payload.message ?? '',
                },
          );
          break;
        }
        case 'log/result': {
          const done = pendingLogs.get(msg.payload.requestId);
          pendingLogs.delete(msg.payload.requestId);
          done?.(msg.payload.text);
          break;
        }
        default:
          break;
      }
    });
    port.onDisconnect.addListener(() => {
      port = null;
      for (const [, done] of pending)
        done({ ok: false, error: 'unavailable', message: 'The page went away.' });
      pending.clear();
      if (!disposed) {
        failures++;
        emitStatus(
          failures >= 5
            ? {
                state: 'unavailable',
                reason: 'Lemma cannot reach this page. Try reloading the Overleaf tab.',
              }
            : { state: 'connecting' },
        );
        setTimeout(open, retryMs);
      }
    });
    port.postMessage(makeMessage('editor/request-snapshot', {}));
  };

  open();

  return {
    onStatus(cb) {
      statusListeners.add(cb);
      return () => statusListeners.delete(cb);
    },
    onSnapshot(cb) {
      snapshotListeners.add(cb);
      return () => snapshotListeners.delete(cb);
    },
    requestSnapshot() {
      port?.postMessage(makeMessage('editor/request-snapshot', {}));
    },
    applyEdits(edits: EditOp[], version: number) {
      return new Promise<ApplyResult>((resolve) => {
        if (!port) {
          resolve({ ok: false, error: 'unavailable', message: 'Not connected to the editor.' });
          return;
        }
        const requestId = nextId();
        const timer = setTimeout(() => {
          pending.delete(requestId);
          resolve({ ok: false, error: 'unavailable', message: 'The editor did not answer.' });
        }, timeoutMs);
        pending.set(requestId, (r) => {
          clearTimeout(timer);
          resolve(r);
        });
        port.postMessage(makeMessage('editor/apply', { requestId, version, edits }));
      });
    },
    reveal(from, to) {
      port?.postMessage(makeMessage('editor/reveal', { from, to }));
    },
    readCompileLog() {
      return new Promise<string | null>((resolve) => {
        if (!port) {
          resolve(null);
          return;
        }
        const requestId = nextId();
        const timer = setTimeout(() => {
          pendingLogs.delete(requestId);
          resolve(null);
        }, timeoutMs);
        pendingLogs.set(requestId, (text) => {
          clearTimeout(timer);
          resolve(text);
        });
        port.postMessage(makeMessage('log/request', { requestId }));
      });
    },
    dispose() {
      disposed = true;
      statusListeners.clear();
      snapshotListeners.clear();
    },
  };
}
