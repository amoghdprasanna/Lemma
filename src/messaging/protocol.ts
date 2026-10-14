import { z } from 'zod';

/**
 * Typed, versioned messages exchanged between Lemma's contexts: the MAIN-world
 * page hook, the isolated content script, the background and the side panel.
 * Every receiver parses with `parseMessage` and ignores anything that does
 * not validate: the MAIN world shares the page's JavaScript realm, so its
 * messages are untrusted (docs/adr/0002-overleaf-editor-access.md).
 *
 * Bump PROTOCOL_VERSION on any breaking change to a payload.
 */
export const PROTOCOL_NAMESPACE = 'lemma';
export const PROTOCOL_VERSION = 1;

const MAX_TEXT = 8_000_000;

function envelope<const T extends string, P extends z.ZodType>(type: T, payload: P) {
  return z.object({
    ns: z.literal(PROTOCOL_NAMESPACE),
    v: z.literal(PROTOCOL_VERSION),
    type: z.literal(type),
    payload,
  });
}

const EditOp = z.object({
  from: z.number().int().nonnegative(),
  to: z.number().int().nonnegative(),
  insert: z.string().max(100_000),
});

const Message = z.discriminatedUnion('type', [
  /** Content script -> background: this tab is an Overleaf project page. */
  envelope('tab/hello', z.object({ projectId: z.string().regex(/^[0-9a-f]{24}$/) })),
  /**
   * Panel -> background: the panel is busy (checking, or the on-device model
   * is answering), so the toolbar mascot thinks. `still` honours reduced motion.
   */
  envelope(
    'mascot/mood',
    z.object({
      tabId: z.number().int().nonnegative(),
      mood: z.enum(['thinking', 'idle']),
      still: z.boolean(),
    }),
  ),
  /** Page -> panel: can Lemma read the editor? */
  envelope(
    'editor/status',
    z.object({
      state: z.enum(['connecting', 'ready', 'unavailable']),
      reason: z.string().max(500).optional(),
      fileName: z.string().max(500).nullable().optional(),
      docId: z.string().max(100).nullable().optional(),
    }),
  ),
  /** Page -> panel: the open file's text. */
  envelope(
    'editor/snapshot',
    z.object({
      text: z.string().max(MAX_TEXT),
      version: z.number().int().nonnegative(),
      fileName: z.string().max(500).nullable(),
      docId: z.string().max(100).nullable(),
    }),
  ),
  /** Panel -> page. */
  envelope('editor/request-snapshot', z.object({})),
  envelope(
    'editor/apply',
    z.object({
      requestId: z.string().max(64),
      version: z.number().int().nonnegative(),
      edits: z.array(EditOp).min(1).max(500),
    }),
  ),
  envelope(
    'editor/applied',
    z.object({
      requestId: z.string().max(64),
      ok: z.boolean(),
      error: z.enum(['stale', 'unavailable', 'rejected']).optional(),
      message: z.string().max(500).optional(),
    }),
  ),
  envelope(
    'editor/reveal',
    z.object({ from: z.number().int().nonnegative(), to: z.number().int().nonnegative() }),
  ),
  /** Panel -> content script: read the compile log Overleaf already shows. */
  envelope('log/request', z.object({ requestId: z.string().max(64) })),
  envelope(
    'log/result',
    z.object({ requestId: z.string().max(64), text: z.string().max(MAX_TEXT).nullable() }),
  ),
]);

export type Message = z.infer<typeof Message>;
export type MessageType = Message['type'];
export type MessageOf<T extends MessageType> = Extract<Message, { type: T }>;

/** Validates an incoming message; returns null for anything malformed or foreign. */
export function parseMessage(raw: unknown): Message | null {
  const result = Message.safeParse(raw);
  return result.success ? result.data : null;
}

export function makeMessage<T extends MessageType>(
  type: T,
  payload: MessageOf<T>['payload'],
): MessageOf<T> {
  return { ns: PROTOCOL_NAMESPACE, v: PROTOCOL_VERSION, type, payload } as MessageOf<T>;
}

/** Messages the page hook (MAIN world) sends; the bridge ignores everything else on window. */
export const FROM_PAGE: ReadonlySet<MessageType> = new Set([
  'editor/status',
  'editor/snapshot',
  'editor/applied',
]);
/** Messages the page hook accepts. */
export const TO_PAGE: ReadonlySet<MessageType> = new Set([
  'editor/request-snapshot',
  'editor/apply',
  'editor/reveal',
]);
