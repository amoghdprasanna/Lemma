import type { OutputFailure, TopicResult } from '@/src/core/llm/filter';
import type { Role } from '@/src/core/structure/roles';

/**
 * On-device language model (docs/adr/0004-on-device-only-ai.md). Only
 * explanations and role labels come back; nothing here can produce an edit
 * (docs/adr/0003-no-content-generation.md).
 */
export type LlmAvailability =
  | 'unsupported' // this browser has no Prompt API
  | 'unavailable' // the device or options are not supported
  | 'downloadable'
  | 'downloading'
  | 'available';

export interface RoleSuggestionInput {
  heading: string;
  /** Opening of the section, already trimmed to fit the context window. */
  excerpt: string;
}

export interface RoleSuggestion {
  roles: Role[];
  confidence: number;
}

export interface ExplainInput {
  title: string;
  /** Curated card text: the facts the explanation must stay within. */
  card: string;
  message: string;
  /** The user's own snippet the diagnostic points at. */
  snippet: string;
}

export interface LogExplainInput {
  message: string;
  /** Lemma's curated translation, if any. */
  curated: string | null;
}

export interface TopicInput {
  question: string;
  /** Curated notes matching the question: the facts the answer should stay within. */
  notes: { title: string; text: string }[];
}

/** An answer about LaTeX or paper writing, or a refusal for anything else (physics, drafting). */
export type TopicAnswer = TopicResult;

/**
 * Why the model gave no answer, so falling back to the notes is never a mystery:
 * - not-ready: no session (the model is not downloaded or not turned on)
 * - overflow: the prompt is more than the context window holds
 * - error: the model threw
 * - malformed / drafted / rambling: the answer failed the post-filter
 */
export type LlmFailure = 'not-ready' | 'overflow' | 'error' | OutputFailure;

export type LlmResult<T> = { ok: true; value: T } | { ok: false; failure: LlmFailure };

export interface LlmPort {
  availability(): Promise<LlmAvailability>;
  /** Creates the session; downloads the model if needed. Must run from a user gesture. */
  enable(onProgress: (fraction: number) => void): Promise<void>;
  suggestRoles(input: RoleSuggestionInput): Promise<RoleSuggestion | null>;
  explain(input: ExplainInput): Promise<LlmResult<string>>;
  explainLogEntry(input: LogExplainInput): Promise<LlmResult<string>>;
  askTopic(input: TopicInput): Promise<LlmResult<TopicAnswer>>;
}
