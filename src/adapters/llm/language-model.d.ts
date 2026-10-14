/**
 * Minimal typings for Chrome's built-in Prompt API (LanguageModel), as
 * documented at developer.chrome.com/docs/ai/prompt-api (checked 2026-10-13).
 * Only the members Lemma uses.
 */
type LemmaLanguageModelAvailability = 'unavailable' | 'downloadable' | 'downloading' | 'available';

interface LemmaLanguageModelExpected {
  type: 'text';
  languages: string[];
}

interface LemmaLanguageModelOptions {
  expectedInputs?: LemmaLanguageModelExpected[];
  expectedOutputs?: LemmaLanguageModelExpected[];
}

interface LemmaDownloadProgressEvent extends Event {
  loaded: number;
}

interface LemmaLanguageModelMonitor extends EventTarget {
  addEventListener(
    type: 'downloadprogress',
    listener: (e: LemmaDownloadProgressEvent) => void,
  ): void;
}

interface LemmaLanguageModelSession {
  readonly contextUsage?: number;
  readonly contextWindow?: number;
  prompt(
    input: string,
    options?: { responseConstraint?: unknown; signal?: AbortSignal },
  ): Promise<string>;
  measureContextUsage?(input: string): Promise<number>;
  clone(): Promise<LemmaLanguageModelSession>;
  destroy(): void;
}

interface LemmaLanguageModelStatic {
  availability(options?: LemmaLanguageModelOptions): Promise<LemmaLanguageModelAvailability>;
  create(
    options?: LemmaLanguageModelOptions & {
      initialPrompts?: { role: 'system' | 'user' | 'assistant'; content: string }[];
      monitor?: (m: LemmaLanguageModelMonitor) => void;
      signal?: AbortSignal;
      temperature?: number;
      topK?: number;
    },
  ): Promise<LemmaLanguageModelSession>;
}
