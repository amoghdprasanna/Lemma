import { filterExplanation, parseRoleSuggestion } from '@/src/core/llm/filter';
import {
  EXPLANATION_SCHEMA,
  explainPrompt,
  logPrompt,
  ROLE_SCHEMA,
  rolePrompt,
  SYSTEM_PROMPT,
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
  let base: LemmaLanguageModelSession | null = null;
  const cache = new Map<string, string | null>();

  const remember = (key: string, value: string | null) => {
    cache.set(key, value);
    if (cache.size > CACHE_SIZE) cache.delete(cache.keys().next().value ?? '');
    return value;
  };

  /** One prompt on a fresh clone of the base session, so turns never accumulate. */
  const ask = async (prompt: string, schema: unknown): Promise<string | null> => {
    if (!base) return null;
    const key = hash(prompt);
    if (cache.has(key)) return cache.get(key) ?? null;
    const session = await base.clone();
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
      base ??= await lm.create({
        ...LANGUAGE,
        initialPrompts: [{ role: 'system', content: SYSTEM_PROMPT }],
        monitor(m) {
          m.addEventListener('downloadprogress', (e) => {
            onProgress(e.loaded);
          });
        },
      });
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
  };
}
