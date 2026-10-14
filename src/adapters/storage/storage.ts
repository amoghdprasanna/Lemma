import { browser } from 'wxt/browser';
import type { StoragePort } from '@/src/ports/storage';

/** chrome.storage-backed storage. Data stays in this browser profile. */
export function chromeStorage(): StoragePort {
  const area = (a: 'local' | 'session') =>
    a === 'local' ? browser.storage.local : browser.storage.session;
  return {
    async get<T>(a: 'local' | 'session', key: string) {
      const r = await area(a).get(key);
      return r[key] as T | undefined;
    },
    async set(a, key, value) {
      await area(a).set({ [key]: value });
    },
    async remove(a, key) {
      await area(a).remove(key);
    },
  };
}

/** In-memory storage for tests and for pages without extension storage. */
export function memoryStorage(): StoragePort & { dump(): Record<string, unknown> } {
  const data = new Map<string, unknown>();
  return {
    get<T>(a: 'local' | 'session', key: string) {
      return Promise.resolve(structuredClone(data.get(`${a}:${key}`)) as T | undefined);
    },
    set(a, key, value) {
      data.set(`${a}:${key}`, structuredClone(value));
      return Promise.resolve();
    },
    remove(a, key) {
      data.delete(`${a}:${key}`);
      return Promise.resolve();
    },
    dump: () => Object.fromEntries(data),
  };
}
