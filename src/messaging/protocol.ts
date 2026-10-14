import { z } from 'zod';

/**
 * Typed, versioned messages exchanged between Lemma's contexts (content
 * scripts, background, side panel). Every receiver parses with `parseMessage`
 * and ignores anything that does not validate: messages can arrive from
 * contexts we do not fully control (docs/adr/0002-overleaf-editor-access.md).
 *
 * Bump PROTOCOL_VERSION on any breaking change to a payload.
 */
export const PROTOCOL_NAMESPACE = 'lemma';
export const PROTOCOL_VERSION = 1;

function envelope<const T extends string, P extends z.ZodType>(type: T, payload: P) {
  return z.object({
    ns: z.literal(PROTOCOL_NAMESPACE),
    v: z.literal(PROTOCOL_VERSION),
    type: z.literal(type),
    payload,
  });
}

/** Content script -> background: this tab is an Overleaf project page. */
const TabHello = envelope('tab/hello', z.object({ projectId: z.string().regex(/^[0-9a-f]{24}$/) }));

const Message = z.discriminatedUnion('type', [TabHello]);

export type Message = z.infer<typeof Message>;
export type MessageOf<T extends Message['type']> = Extract<Message, { type: T }>;

/** Validates an incoming message; returns null for anything malformed or foreign. */
export function parseMessage(raw: unknown): Message | null {
  const result = Message.safeParse(raw);
  return result.success ? result.data : null;
}

export function makeMessage<T extends Message['type']>(
  type: T,
  payload: MessageOf<T>['payload'],
): MessageOf<T> {
  return { ns: PROTOCOL_NAMESPACE, v: PROTOCOL_VERSION, type, payload } as MessageOf<T>;
}
