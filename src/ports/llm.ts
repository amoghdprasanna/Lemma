import type { OutputFailure, TopicResult } from '@/src/core/llm/filter';
import type { Role } from '@/src/core/structure/roles';

/**
 * The language model: Chrome's built-in one or a server the user picked
 * (docs/adr/0004-on-device-only-ai.md, docs/adr/0008-ai-backends.md). Only
 * explanations and role labels come back; nothing here can produce an edit
 * (docs/adr/0003-no-content-generation.md).
 */
export type LlmAvailability =
  | 'unsupported' // this browser has no Prompt API, or AI is off
  | 'unavailable' // the device or options are not supported, or the server can't be reached
  | 'downloadable' // one click away: download the model, or allow Lemma to reach the server
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
 * - blocked: a remote model and paper text the user hasn't agreed to send (ADR-0008)
 * - malformed / drafted / rambling: the answer failed the post-filter
 */
export type LlmFailure = 'not-ready' | 'overflow' | 'error' | 'blocked' | OutputFailure;

export type LlmResult<T> = { ok: true; value: T } | { ok: false; failure: LlmFailure };

export interface LlmPort {
  availability(): Promise<LlmAvailability>;
  /**
   * Gets the model ready: downloads it, or asks for permission to reach the
   * server. Must run from a user gesture. Throws with a message for the user.
   */
  enable(onProgress: (fraction: number) => void): Promise<void>;
  /** Models a server offers, for the Settings picker. Servers only. */
  models?(): Promise<string[]>;
  suggestRoles(input: RoleSuggestionInput): Promise<RoleSuggestion | null>;
  explain(input: ExplainInput): Promise<LlmResult<string>>;
  explainLogEntry(input: LogExplainInput): Promise<LlmResult<string>>;
  askTopic(input: TopicInput): Promise<LlmResult<TopicAnswer>>;
}
