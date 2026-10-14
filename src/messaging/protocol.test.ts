import { describe, expect, it } from 'vitest';
import { makeMessage, parseMessage, PROTOCOL_VERSION } from './protocol';

const projectId = '64a1f0c2e4b0a1b2c3d4e5f6';

describe('protocol', () => {
  it('round-trips a well-formed message', () => {
    const msg = makeMessage('tab/hello', { projectId });
    expect(parseMessage(msg)).toEqual(msg);
  });

  it('accepts a mascot mood from the panel', () => {
    const msg = makeMessage('mascot/mood', { tabId: 7, mood: 'thinking', still: false });
    expect(parseMessage(msg)).toEqual(msg);
  });

  it.each([
    [
      'a mascot mood for a bogus tab',
      {
        ns: 'lemma',
        v: PROTOCOL_VERSION,
        type: 'mascot/mood',
        payload: { tabId: -1, mood: 'thinking', still: false },
      },
    ],
    ['null', null],
    ['a string', 'tab/hello'],
    [
      'a foreign namespace',
      { ns: 'other', v: PROTOCOL_VERSION, type: 'tab/hello', payload: { projectId } },
    ],
    [
      'a future version',
      { ns: 'lemma', v: PROTOCOL_VERSION + 1, type: 'tab/hello', payload: { projectId } },
    ],
    ['an unknown type', { ns: 'lemma', v: PROTOCOL_VERSION, type: 'tab/bye', payload: {} }],
    [
      'an invalid payload',
      { ns: 'lemma', v: PROTOCOL_VERSION, type: 'tab/hello', payload: { projectId: 'x' } },
    ],
  ])('rejects %s', (_label, raw) => {
    expect(parseMessage(raw)).toBeNull();
  });
});
