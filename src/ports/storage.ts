/**
 * Key-value storage that stays in this browser. `local` survives restarts;
 * `session` is cleared when the browser closes.
 */
export interface StoragePort {
  get<T>(area: 'local' | 'session', key: string): Promise<T | undefined>;
  set(area: 'local' | 'session', key: string, value: unknown): Promise<void>;
  remove(area: 'local' | 'session', key: string): Promise<void>;
}
