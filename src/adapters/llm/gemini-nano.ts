import { filterExplanation, parseRoleSuggestion, parseTopicAnswer } from '@/src/core/llm/filter';
import {
  EXPLANATION_SCHEMA,
  explainPrompt,
  logPrompt,
  ROLE_SCHEMA,
  rolePrompt,
  SYSTEM_PROMPT,
  TOPIC_SCHEMA,
  topicPrompt,
} from '@/src/core/llm/prompts';
import { hash } from '@/src/core/model/text';
import type { LlmAvailability, LlmPort } from '@/src/ports/llm';

/**
 * LlmPort on Chrome's built-in Gemini Nano (docs/adr/0004-on-device-only-ai.md).
 * Runs in the side panel (the Prompt API is not available in workers). Every
 * answer passes the post-filter; anything rejected becomes null and the UI
 * shows the curated card instead.
 */
const LANGUAGE: LemmaLanguageModelOptions = {
  expectedInputs: [{ type: 'text', languages: ['en'] }],
  expectedOutputs: [{ type: 'text', languages: ['en'] }],
};
const CACHE_SIZE = 200;

function api(): LemmaLanguageModelStatic | null {
  const g = globalThis as { LanguageModel?: LemmaLanguageModelStatic };
  return g.LanguageModel ?? null;
}

export function geminiNano(): LlmPort {
  let base: Promise<LemmaLanguageModelSession> | null = null;
  const cache = new Map<string, string | null>();

  const remember = (key: string, value: string | null) => {
    cache.set(key, value);
    if (cache.size > CACHE_SIZE) cache.delete(cache.keys().next().value ?? '');
    return value;
  };

  const create = (lm: LemmaLanguageModelStatic, onProgress?: (fraction: number) => void) => {
    base ??= lm
      .create({
        ...LANGUAGE,
        initialPrompts: [{ role: 'system', content: SYSTEM_PROMPT }],
        monitor(m) {
          m.addEventListener('downloadprogress', (e) => {
            onProgress?.(e.loaded);
          });
        },
      })
      .catch((e: unknown) => {
        base = null;
        throw e;
      });
    return base;
  };

  /**
   * The base session. A reopened panel starts without one even though the
   * model is already on disk, so open it on the first prompt; that needs no
   * click and downloads nothing. Lazy, so an open panel never holds the model
   * in memory until someone asks for it.
   */
  const baseSession = async (): Promise<LemmaLanguageModelSession | null> => {
    if (base) return base;
    const lm = api();
    if (!lm || (await lm.availability(LANGUAGE)) !== 'available') return null;
    return create(lm);
  };

  /** One prompt on a fresh clone of the base session, so turns never accumulate. */
  const ask = async (prompt: string, schema: unknown): Promise<string | null> => {
    const key = hash(prompt);
    if (cache.has(key)) return cache.get(key) ?? null;
    let session: LemmaLanguageModelSession;
    try {
      const b = await baseSession();
      if (!b) return null;
      session = await b.clone();
    } catch {
      return null;
    }
    try {
      const window = session.contextWindow ?? Infinity;
      const used =
        (session.contextUsage ?? 0) + ((await session.measureContextUsage?.(prompt)) ?? 0);
      if (used > window) return remember(key, null);
      return remember(key, await session.prompt(prompt, { responseConstraint: schema }));
    } catch {
      return null;
    } finally {
      session.destroy();
    }
  };

  return {
    async availability(): Promise<LlmAvailability> {
      const lm = api();
      if (!lm) return 'unsupported';
      try {
        return await lm.availability(LANGUAGE);
      } catch {
        return 'unavailable';
      }
    },
    async enable(onProgress) {
      const lm = api();
      if (!lm) throw new Error('This browser does not provide the Prompt API.');
      await create(lm, onProgress);
      onProgress(1);
    },
    async suggestRoles(input) {
      const raw = await ask(rolePrompt(input), ROLE_SCHEMA);
      return raw === null ? null : parseRoleSuggestion(raw);
    },
    async explain(input) {
      const raw = await ask(explainPrompt(input), EXPLANATION_SCHEMA);
      if (raw === null) return null;
      const r = filterExplanation(raw);
      return r.ok ? r.text : null;
    },
    async explainLogEntry(input) {
      const raw = await ask(logPrompt(input), EXPLANATION_SCHEMA);
      if (raw === null) return null;
      const r = filterExplanation(raw);
      return r.ok ? r.text : null;
    },
    async askTopic(input) {
      const raw = await ask(topicPrompt(input), TOPIC_SCHEMA);
      return raw === null ? null : parseTopicAnswer(raw);
    },
  };
}
