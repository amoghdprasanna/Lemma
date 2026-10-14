import { afterEach, describe, expect, it, vi } from 'vitest';
import { geminiNano } from './gemini-nano';

/** A scripted stand-in for Chrome's LanguageModel global. */
function installLanguageModel(
  answer: string,
  opts: { availability?: string; window?: number } = {},
) {
  const prompts: { input: string; options: unknown }[] = [];
  const session = {
    contextUsage: 100,
    contextWindow: opts.window ?? 4096,
    prompt: vi.fn((input: string, options: unknown) => {
      prompts.push({ input, options });
      return Promise.resolve(answer);
    }),
    measureContextUsage: (input: string) => Promise.resolve(Math.ceil(input.length / 4)),
    clone: () => Promise.resolve(session),
    destroy: vi.fn(),
  };
  const lm = {
    availability: vi.fn(() => Promise.resolve(opts.availability ?? 'downloadable')),
    create: vi.fn((o: { monitor?: (m: EventTarget) => void; initialPrompts?: unknown[] }) => {
      const monitor = new EventTarget();
      o.monitor?.(monitor);
      const e = Object.assign(new Event('downloadprogress'), { loaded: 0.4 });
      monitor.dispatchEvent(e);
      return Promise.resolve(session);
    }),
  };
  (globalThis as { LanguageModel?: unknown }).LanguageModel = lm;
  return { lm, session, prompts };
}

describe('geminiNano', () => {
  afterEach(() => {
    delete (globalThis as { LanguageModel?: unknown }).LanguageModel;
  });

  it('reports unsupported when the browser has no Prompt API', async () => {
    await expect(geminiNano().availability()).resolves.toBe('unsupported');
  });

  it('passes availability through and only creates a session on enable', async () => {
    const { lm } = installLanguageModel('{"explanation":"ok"}');
    const llm = geminiNano();
    await expect(llm.availability()).resolves.toBe('downloadable');
    expect(lm.create).not.toHaveBeenCalled();
    const progress: number[] = [];
    await llm.enable((p) => progress.push(p));
    expect(progress).toEqual([0.4, 1]);
    const opts = lm.create.mock.calls[0]?.[0] as {
      initialPrompts: { role: string; content: string }[];
    };
    expect(opts.initialPrompts[0]?.content).toMatch(/Never write, rewrite/);
  });

  it('returns nothing before it is enabled', async () => {
    installLanguageModel('{"explanation":"ok"}');
    const llm = geminiNano();
    await expect(
      llm.explain({ title: 't', card: 'c', message: 'm', snippet: 's' }),
    ).resolves.toBeNull();
  });

  it('explains with structured output, filters, and caches by prompt', async () => {
    const { session, prompts } = installLanguageModel(
      '{"explanation":"Your label comes before the caption."}',
    );
    const llm = geminiNano();
    await llm.enable(() => undefined);
    const input = {
      title: 'Captions',
      card: 'Put label after caption.',
      message: 'm',
      snippet: '\\label{x}\\caption{y}',
    };
    await expect(llm.explain(input)).resolves.toBe('Your label comes before the caption.');
    await llm.explain(input);
    expect(session.prompt).toHaveBeenCalledTimes(1);
    expect(prompts[0]?.options).toMatchObject({
      responseConstraint: { required: ['explanation'] },
    });
    expect(session.destroy).toHaveBeenCalled();
  });

  it('drops drafted content and malformed role labels', async () => {
    installLanguageModel('{"explanation":"Here is a revised abstract: We study…"}');
    const llm = geminiNano();
    await llm.enable(() => undefined);
    await expect(
      llm.explain({ title: 't', card: 'c', message: 'm', snippet: 's' }),
    ).resolves.toBeNull();
    await expect(llm.explainLogEntry({ message: 'x', curated: null })).resolves.toBeNull();
    await expect(llm.suggestRoles({ heading: 'h', excerpt: 'e' })).resolves.toBeNull();
  });

  it('returns valid role labels', async () => {
    installLanguageModel('{"roles":["methods"],"confidence":0.7}');
    const llm = geminiNano();
    await llm.enable(() => undefined);
    await expect(
      llm.suggestRoles({ heading: 'Encoding scheme', excerpt: 'We encode' }),
    ).resolves.toEqual({ roles: ['methods'], confidence: 0.7 });
  });

  it('skips prompts that would overflow the context window', async () => {
    const { session } = installLanguageModel('{"explanation":"ok"}', { window: 120 });
    const llm = geminiNano();
    await llm.enable(() => undefined);
    await expect(
      llm.explain({ title: 't', card: 'c'.repeat(800), message: 'm', snippet: 's' }),
    ).resolves.toBeNull();
    expect(session.prompt).not.toHaveBeenCalled();
  });
});
