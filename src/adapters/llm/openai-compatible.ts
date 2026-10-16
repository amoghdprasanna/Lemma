import { browser } from 'wxt/browser';
import { checkServerUrl, findPreset, type BackendSettings } from '@/src/core/llm/backend';
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
import type { LlmAvailability, LlmPort, LlmResult } from '@/src/ports/llm';

/**
 * LlmPort over the OpenAI chat-completions API (docs/adr/0008-ai-backends.md):
 * Ollama, LM Studio and llama.cpp on this computer, or OpenRouter. Same
 * prompts, schemas and post-filter as the Chrome model, so ADR-0003 holds
 * whatever model answers. The only file in Lemma that makes network requests.
 */
export interface ServerDeps {
  fetch: typeof fetch;
  permissions: {
    contains(origin: string): Promise<boolean>;
    /** Must be the first call in a click handler: Chrome needs the user gesture. */
    request(origin: string): Promise<boolean>;
  };
}

export function serverDeps(): ServerDeps {
  return {
    fetch: (input, init) => fetch(input, init),
    permissions: {
      contains: (origin) => browser.permissions.contains({ origins: [origin] }),
      request: (origin) => browser.permissions.request({ origins: [origin] }),
    },
  };
}

const PROBE_TIMEOUT_MS = 8_000;
/** A local model loads on its first request, which can take a while on a laptop. */
const ANSWER_TIMEOUT_MS = 120_000;
/** Room for a model that thinks before answering; the post-filter caps the answer itself. */
const MAX_TOKENS = 1024;
const CACHE_SIZE = 200;
const OVERFLOW = /context|too long|maximum.*tokens|exceed/i;

class ServerError extends Error {}

/** `<think>` blocks and Markdown fences some models wrap around JSON. */
export function unwrap(content: string): string {
  const text = content.replace(/<think>[\s\S]*?<\/think>/g, '').trim();
  const fenced = /^```(?:json)?\s*([\s\S]*?)\s*```$/.exec(text);
  return fenced?.[1] ?? text;
}

export function openAiCompatible(settings: BackendSettings, deps: ServerDeps): LlmPort {
  const check = checkServerUrl(settings.baseUrl);
  const base = settings.baseUrl.trim().replace(/\/+$/, '');
  const preset = findPreset(settings.preset);
  const remote = check.ok && check.remote;
  const where = check.ok ? check.url.host : settings.baseUrl;
  /** The model to ask: the chosen one, or the only one a server offers. Set by probe(). */
  let model = settings.model;
  const cache = new Map<string, LlmResult<string>>();

  const headers = (): Record<string, string> => ({
    'Content-Type': 'application/json',
    ...(settings.apiKey ? { Authorization: `Bearer ${settings.apiKey}` } : {}),
    ...(remote ? { 'X-Title': 'Lemma' } : {}),
  });

  const refused = (status: number): string => {
    if (status === 401) return 'The server refused the API key.';
    if (status === 403 && !remote)
      return check.ok && check.url.port === '11434'
        ? 'Ollama refused Lemma. Quit Ollama, set OLLAMA_ORIGINS="chrome-extension://*" (see the README), and start it again.'
        : `The server at ${where} refused Lemma (403). If it checks origins, allow chrome-extension://*.`;
    if (status === 403) return 'The server refused this request (403). Check the key’s limits.';
    return `The server at ${where} answered with an error (${String(status)}).`;
  };

  /** Lists the server's models; throws a ServerError whose message is for the user. */
  const listModels = async (): Promise<string[]> => {
    let res: Response;
    try {
      res = await deps.fetch(`${base}/models`, {
        headers: headers(),
        signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
      });
    } catch {
      throw new ServerError(
        remote
          ? `Can’t reach ${where}. Check your connection.`
          : `Can’t reach ${preset.label} at ${where}. Is it running?`,
      );
    }
    if (!res.ok) throw new ServerError(refused(res.status));
    const body = (await res.json().catch(() => null)) as { data?: { id?: unknown }[] } | null;
    return (body?.data ?? []).map((m) => m.id).filter((id): id is string => typeof id === 'string');
  };

  /** Checks the server is reachable and has the model; throws a ServerError otherwise. */
  const probe = async (): Promise<void> => {
    if (remote && !settings.apiKey) throw new ServerError(`Paste your ${preset.label} API key.`);
    const ids = await listModels();
    const only = ids.length === 1 ? ids[0] : undefined;
    model = settings.model || only || '';
    if (model === '') throw new ServerError('Choose a model in Settings.');
    if (ids.length > 1 && !ids.includes(model)) {
      const offered = ids.slice(0, 5).join(', ');
      throw new ServerError(`The server has no model “${model}”. It offers: ${offered}.`);
    }
  };

  const remember = (key: string, value: LlmResult<string>) => {
    cache.set(key, value);
    if (cache.size > CACHE_SIZE) cache.delete(cache.keys().next().value ?? '');
    return value;
  };

  const ask = async (prompt: string, schema: unknown): Promise<LlmResult<string>> => {
    if (!check.ok || model === '') return { ok: false, failure: 'not-ready' };
    const key = hash(`${model}\n${prompt}`);
    const cached = cache.get(key);
    if (cached) return cached;
    const body = {
      model,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: prompt },
      ],
      temperature: 0.2,
      max_tokens: MAX_TOKENS,
      stream: false,
      response_format: {
        type: 'json_schema',
        json_schema: { name: 'answer', strict: true, schema },
      },
      // OpenRouter: only providers that keep no prompts and honour the schema.
      // Local: skip hidden reasoning (llama.cpp, vLLM; others ignore the field),
      // which otherwise takes most of the tokens and the time on a laptop.
      ...(remote
        ? { provider: { data_collection: 'deny', require_parameters: true } }
        : { chat_template_kwargs: { enable_thinking: false } }),
    };
    let res: Response;
    try {
      res = await deps.fetch(`${base}/chat/completions`, {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(ANSWER_TIMEOUT_MS),
      });
    } catch {
      return { ok: false, failure: 'error' };
    }
    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      return (res.status === 400 || res.status === 413) && OVERFLOW.test(detail)
        ? remember(key, { ok: false, failure: 'overflow' })
        : { ok: false, failure: 'error' };
    }
    const data = (await res.json().catch(() => null)) as {
      choices?: { message?: { content?: unknown } }[];
    } | null;
    const content = data?.choices?.[0]?.message?.content;
    if (typeof content !== 'string') return { ok: false, failure: 'malformed' };
    return remember(key, { ok: true, value: unwrap(content) });
  };

  /** Remote models see paper text only when the user allowed it (ADR-0008 point 5). */
  const documentTextAllowed = !remote || settings.shareDocumentText;
  const blocked = { ok: false, failure: 'blocked' } as const;

  return {
    async availability(): Promise<LlmAvailability> {
      if (!check.ok) return 'unavailable';
      if (!(await deps.permissions.contains(check.permission))) return 'downloadable';
      try {
        await probe();
        return 'available';
      } catch {
        return 'unavailable';
      }
    },
    async enable(onProgress) {
      if (!check.ok) throw new Error(check.reason);
      // First call, so the click still counts as a user gesture.
      const granted = await deps.permissions.request(check.permission);
      if (!granted) throw new Error(`Lemma needs your permission to reach ${where}.`);
      onProgress(0.5);
      await probe();
      onProgress(1);
    },
    async models() {
      return check.ok ? listModels().catch(() => []) : [];
    },
    async suggestRoles(input) {
      if (!documentTextAllowed) return null;
      const raw = await ask(rolePrompt(input), ROLE_SCHEMA);
      return raw.ok ? parseRoleSuggestion(raw.value) : null;
    },
    async explain(input) {
      if (!documentTextAllowed) return blocked;
      const raw = await ask(explainPrompt(input), EXPLANATION_SCHEMA);
      return raw.ok ? filterExplanation(raw.value) : raw;
    },
    async explainLogEntry(input) {
      if (!documentTextAllowed) return blocked;
      const raw = await ask(logPrompt(input), EXPLANATION_SCHEMA);
      return raw.ok ? filterExplanation(raw.value) : raw;
    },
    async askTopic(input) {
      const raw = await ask(topicPrompt(input), TOPIC_SCHEMA);
      return raw.ok ? parseTopicAnswer(raw.value) : raw;
    },
  };
}
