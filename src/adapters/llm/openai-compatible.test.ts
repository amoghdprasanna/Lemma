import { describe, expect, it, vi } from 'vitest';
import { DEFAULT_BACKEND, type BackendSettings } from '@/src/core/llm/backend';
import { openAiCompatible, unwrap, type ServerDeps } from './openai-compatible';

const OLLAMA: BackendSettings = { ...DEFAULT_BACKEND, kind: 'server', model: 'qwen3:4b' };
const OPENROUTER: BackendSettings = {
  ...DEFAULT_BACKEND,
  kind: 'server',
  preset: 'openrouter',
  baseUrl: 'https://openrouter.ai/api/v1',
  model: 'some/model',
  apiKey: 'sk-test',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

const answer = (content: string) => json({ choices: [{ message: { content } }] });

/** A scripted server: model list, chat replies, and a record of every request. */
function server(
  opts: {
    models?: string[] | (() => Response);
    reply?: () => Response;
    granted?: boolean;
    grant?: boolean;
  } = {},
) {
  const requests: { url: string; init: RequestInit | undefined; body: Record<string, unknown> }[] =
    [];
  const order: string[] = [];
  let granted = opts.granted ?? true;
  const deps: ServerDeps = {
    fetch: vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      order.push(`fetch ${url}`);
      const body =
        typeof init?.body === 'string' ? (JSON.parse(init.body) as Record<string, unknown>) : {};
      requests.push({ url, init, body });
      if (url.endsWith('/models')) {
        const m = opts.models ?? ['qwen3:4b', 'gemma3:4b'];
        return Promise.resolve(
          typeof m === 'function' ? m() : json({ data: m.map((id) => ({ id })) }),
        );
      }
      return Promise.resolve(
        opts.reply?.() ?? answer('{"onTopic":true,"answer":"Use \\\\eqref."}'),
      );
    }),
    permissions: {
      contains: () => Promise.resolve(granted),
      request: (origin) => {
        order.push(`request ${origin}`);
        granted = opts.grant ?? true;
        return Promise.resolve(granted);
      },
    },
  };
  return { deps, requests, order };
}

const topic = {
  question: 'When should I use eqref?',
  notes: [{ title: 'Why', text: 'It prints (3).' }],
};
const explainInput = { title: 't', card: 'c', message: 'm', snippet: '\\ref{eq:a}' };

describe('openAiCompatible', () => {
  it('needs a click before it touches the network', async () => {
    const s = server({ granted: false });
    const llm = openAiCompatible(OLLAMA, s.deps);
    await expect(llm.availability()).resolves.toBe('downloadable');
    expect(s.order).toEqual([]);
  });

  it('asks for permission first on enable, then checks the server', async () => {
    const s = server({ granted: false });
    const llm = openAiCompatible(OLLAMA, s.deps);
    const progress: number[] = [];
    const enabling = llm.enable((p) => progress.push(p));
    expect(s.order).toEqual(['request http://localhost/*']); // synchronously, inside the click
    await enabling;
    expect(s.order[1]).toBe('fetch http://localhost:11434/v1/models');
    expect(progress).toEqual([0.5, 1]);
    await expect(llm.availability()).resolves.toBe('available');
  });

  it.each([
    ['permission is denied', server({ granted: false, grant: false }), /needs your permission/],
    ['Ollama refuses the origin', server({ models: () => json({}, 403) }), /OLLAMA_ORIGINS/],
    [
      'the model is missing',
      server({ models: ['llama3.2:3b', 'phi4-mini'] }),
      /no model “qwen3:4b”/,
    ],
  ])('explains when %s', async (_label, s, message) => {
    await expect(openAiCompatible(OLLAMA, s.deps).enable(() => undefined)).rejects.toThrow(message);
  });

  it('explains when the server is down', async () => {
    const s = server();
    s.deps.fetch = () => Promise.reject(new TypeError('fetch failed'));
    const llm = openAiCompatible(OLLAMA, s.deps);
    await expect(llm.enable(() => undefined)).rejects.toThrow(
      'Can’t reach Ollama at localhost:11434. Is it running?',
    );
    await expect(llm.availability()).resolves.toBe('unavailable');
  });

  it('uses the only model a server offers when none is chosen', async () => {
    const s = server({ models: ['model.gguf'] });
    const llm = openAiCompatible({ ...OLLAMA, preset: 'llamacpp', model: '' }, s.deps);
    await llm.enable(() => undefined);
    await llm.askTopic(topic);
    expect(s.requests.at(-1)?.body.model).toBe('model.gguf');
  });

  it('refuses addresses outside ADR-0008', async () => {
    const s = server();
    const llm = openAiCompatible({ ...OLLAMA, baseUrl: 'https://example.com/v1' }, s.deps);
    await expect(llm.availability()).resolves.toBe('unavailable');
    await expect(llm.enable(() => undefined)).rejects.toThrow(/only connects/);
    await expect(llm.askTopic(topic)).resolves.toEqual({ ok: false, failure: 'not-ready' });
    expect(s.order).toEqual([]);
  });

  it('sends the same prompts and schema as the Chrome model, and filters the answer', async () => {
    const s = server();
    const llm = openAiCompatible(OLLAMA, s.deps);
    await llm.enable(() => undefined);
    await expect(llm.askTopic(topic)).resolves.toEqual({
      ok: true,
      value: { kind: 'answer', text: 'Use \\eqref.' },
    });
    const req = s.requests.at(-1);
    expect(req?.url).toBe('http://localhost:11434/v1/chat/completions');
    expect(req?.body).toMatchObject({
      model: 'qwen3:4b',
      stream: false,
      response_format: {
        type: 'json_schema',
        json_schema: { schema: { required: ['onTopic', 'answer'] } },
      },
    });
    const messages = req?.body.messages as { role: string; content: string }[];
    expect(messages[0]?.content).toMatch(/Never write, rewrite/);
    expect(messages[1]?.content).toContain('It prints (3).');
    expect(req?.body.provider).toBeUndefined();
    expect(req?.body.chat_template_kwargs).toEqual({ enable_thinking: false });
    expect(new Headers(req?.init?.headers).get('Authorization')).toBeNull();
  });

  it('caches answers by model and prompt', async () => {
    const s = server();
    const llm = openAiCompatible(OLLAMA, s.deps);
    await llm.enable(() => undefined);
    await llm.askTopic(topic);
    await llm.askTopic(topic);
    expect(s.requests.filter((r) => r.url.endsWith('/chat/completions'))).toHaveLength(1);
  });

  it('drops drafted answers like the Chrome model does', async () => {
    const s = server({
      reply: () => answer('{"explanation":"Here is a revised abstract: We study…"}'),
    });
    const llm = openAiCompatible(OLLAMA, s.deps);
    await llm.enable(() => undefined);
    await expect(llm.explain(explainInput)).resolves.toMatchObject({
      ok: false,
      failure: 'drafted',
    });
  });

  it('reports overflow, errors and garbled replies', async () => {
    let reply = () => json({ error: { message: 'context length exceeded' } }, 400);
    const s = server({ reply: () => reply() });
    const llm = openAiCompatible(OLLAMA, s.deps);
    await llm.enable(() => undefined);
    await expect(llm.askTopic(topic)).resolves.toEqual({ ok: false, failure: 'overflow' });
    reply = () => json({ error: 'boom' }, 500);
    await expect(llm.askTopic({ ...topic, question: 'b' })).resolves.toEqual({
      ok: false,
      failure: 'error',
    });
    reply = () => json({ choices: [] });
    await expect(llm.askTopic({ ...topic, question: 'c' })).resolves.toEqual({
      ok: false,
      failure: 'malformed',
    });
  });

  it('keeps paper text away from a remote model unless allowed', async () => {
    const s = server({ models: ['some/model'] });
    const llm = openAiCompatible(OPENROUTER, s.deps);
    await llm.enable(() => undefined);
    await expect(llm.explain(explainInput)).resolves.toEqual({ ok: false, failure: 'blocked' });
    await expect(llm.explainLogEntry({ message: 'x', curated: null })).resolves.toEqual({
      ok: false,
      failure: 'blocked',
    });
    await expect(llm.suggestRoles({ heading: 'h', excerpt: 'e' })).resolves.toBeNull();
    expect(s.requests.filter((r) => r.url.endsWith('/chat/completions'))).toHaveLength(0);

    // Topic questions carry no paper text, so they go, with OpenRouter's privacy routing.
    await llm.askTopic(topic);
    const req = s.requests.at(-1);
    expect(req?.body.provider).toEqual({ data_collection: 'deny', require_parameters: true });
    expect(req?.body.chat_template_kwargs).toBeUndefined();
    expect(new Headers(req?.init?.headers).get('Authorization')).toBe('Bearer sk-test');

    const allowed = openAiCompatible({ ...OPENROUTER, shareDocumentText: true }, s.deps);
    await allowed.enable(() => undefined);
    s.deps.fetch = vi.fn(() => Promise.resolve(answer('{"explanation":"Use \\\\eqref."}')));
    await expect(allowed.explain(explainInput)).resolves.toEqual({
      ok: true,
      value: 'Use \\eqref.',
    });
  });

  it('asks for the key before calling a remote server', async () => {
    const s = server();
    await expect(
      openAiCompatible({ ...OPENROUTER, apiKey: '' }, s.deps).enable(() => undefined),
    ).rejects.toThrow(/API key/);
  });

  it('lists models for the picker', async () => {
    const s = server();
    await expect(openAiCompatible(OLLAMA, s.deps).models?.()).resolves.toEqual([
      'qwen3:4b',
      'gemma3:4b',
    ]);
  });
});

describe('unwrap', () => {
  it('strips think blocks and code fences around JSON', () => {
    expect(unwrap('<think>hmm</think>\n```json\n{"a":1}\n```')).toBe('{"a":1}');
    expect(unwrap('{"a":1}')).toBe('{"a":1}');
  });
});
