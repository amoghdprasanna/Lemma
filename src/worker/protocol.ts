import type { AnalyzeInput } from '@/src/core/analysis';
import { analyzeProject, type ProjectAnalysis, type ProjectFile } from '@/src/core/project/project';

export interface AnalysisRequest {
  files: ProjectFile[];
  openPath: string;
  base: Omit<AnalyzeInput, 'text' | 'fileName' | 'model' | 'project' | 'rules'>;
}

/** Runs analyses; only the newest request's result is delivered. */
export interface Analyzer {
  run(request: AnalysisRequest): Promise<ProjectAnalysis | null>;
  dispose(): void;
}

/** Analyses on the calling thread (tests, and a fallback if workers fail). */
export function inlineAnalyzer(): Analyzer {
  let latest = 0;
  return {
    run(request) {
      const id = ++latest;
      const result = analyzeProject(request.files, request.openPath, request.base);
      return Promise.resolve(id === latest ? result : null);
    },
    dispose: () => undefined,
  };
}
