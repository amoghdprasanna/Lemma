import type { ProjectAnalysis } from '@/src/core/project/project';
import { inlineAnalyzer, type AnalysisRequest, type Analyzer } from './protocol';

/** Analyzer backed by a dedicated worker; falls back to inline if the worker cannot start. */
export function workerAnalyzer(): Analyzer {
  let worker: Worker;
  try {
    worker = new Worker(new URL('./analysis.worker.ts', import.meta.url), { type: 'module' });
  } catch {
    return inlineAnalyzer();
  }
  let latest = 0;
  const waiting = new Map<number, (r: ProjectAnalysis | null) => void>();
  worker.addEventListener(
    'message',
    (e: MessageEvent<{ id: number; result?: ProjectAnalysis; error?: string }>) => {
      const done = waiting.get(e.data.id);
      waiting.delete(e.data.id);
      done?.(e.data.id === latest ? (e.data.result ?? null) : null);
    },
  );
  return {
    run(request: AnalysisRequest) {
      const id = ++latest;
      // Older requests still in flight resolve to null when they finish.
      return new Promise((resolve) => {
        waiting.set(id, resolve);
        worker.postMessage({ id, request });
      });
    },
    dispose() {
      worker.terminate();
      for (const [, done] of waiting) done(null);
      waiting.clear();
    },
  };
}
