import { analyzeProject } from '@/src/core/project/project';
import type { AnalysisRequest } from './protocol';

/** Parsing and rules run here so typing in Overleaf never waits on Lemma. */
self.addEventListener('message', (e: MessageEvent<{ id: number; request: AnalysisRequest }>) => {
  const { id, request } = e.data;
  try {
    const started = performance.now();
    const result = analyzeProject(request.files, request.openPath, request.base);
    self.postMessage({ id, result, ms: performance.now() - started });
  } catch (err) {
    self.postMessage({ id, error: err instanceof Error ? err.message : String(err) });
  }
});
