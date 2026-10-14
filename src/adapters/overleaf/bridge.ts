import {
  FROM_PAGE,
  makeMessage,
  parseMessage,
  TO_PAGE,
  type Message,
} from '@/src/messaging/protocol';
import type { Transport } from '@/src/adapters/page/hook';

/** The subset of a runtime Port the bridge needs (real ports and test fakes). */
export interface PortLike {
  postMessage(msg: unknown): void;
  onMessage: { addListener(cb: (msg: unknown) => void): void };
  onDisconnect: { addListener(cb: () => void): void };
}

export const EDITOR_PORT_NAME = 'lemma-editor';

/**
 * Isolated-world relay between the page hook (window messages) and side
 * panels (runtime ports). Validates in both directions and only forwards the
 * message types each side is allowed to send. Also reads the compile log
 * Overleaf already displays, so no network request is ever made.
 */
export function startBridge(opts: { page: Transport; readLog: () => string | null }): {
  connect(port: PortLike): void;
  stop(): void;
} {
  const ports = new Set<PortLike>();
  let lastStatus: Message | null = null;
  let lastSnapshot: Message | null = null;

  const stopListening = opts.page.listen((raw) => {
    const msg = parseMessage(raw);
    if (!msg || !FROM_PAGE.has(msg.type)) return;
    if (msg.type === 'editor/status') lastStatus = msg;
    if (msg.type === 'editor/snapshot') lastSnapshot = msg;
    for (const p of ports) p.postMessage(msg);
  });

  return {
    connect(port) {
      ports.add(port);
      port.onDisconnect.addListener(() => ports.delete(port));
      if (lastStatus) port.postMessage(lastStatus);
      if (lastSnapshot) port.postMessage(lastSnapshot);
      port.onMessage.addListener((raw) => {
        const msg = parseMessage(raw);
        if (!msg) return;
        if (msg.type === 'log/request') {
          port.postMessage(
            makeMessage('log/result', { requestId: msg.payload.requestId, text: opts.readLog() }),
          );
        } else if (TO_PAGE.has(msg.type)) {
          opts.page.post(msg);
        }
      });
    },
    stop() {
      stopListening();
      ports.clear();
    },
  };
}
