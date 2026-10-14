import { describe, expect, it } from 'vitest';
import { chromeStorage, memoryStorage } from './storage';

describe.each([
  ['chrome.storage (fake browser)', chromeStorage],
  ['memory', memoryStorage],
])('%s', (_name, make) => {
  it('stores, reads and removes per area', async () => {
    const s = make();
    await s.set('local', 'k', { a: 1 });
    await s.set('session', 'k', 'session value');
    await expect(s.get('local', 'k')).resolves.toEqual({ a: 1 });
    await expect(s.get('session', 'k')).resolves.toBe('session value');
    await s.remove('local', 'k');
    await expect(s.get('local', 'k')).resolves.toBeUndefined();
  });
});
