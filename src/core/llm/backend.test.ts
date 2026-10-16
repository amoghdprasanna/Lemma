import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  backendLabel,
  checkServerUrl,
  DEFAULT_BACKEND,
  isRemote,
  parseBackend,
  SERVER_PRESETS,
} from './backend';

describe('checkServerUrl', () => {
  it.each([
    ['http://localhost:11434/v1', false, 'http://localhost/*'],
    ['http://127.0.0.1:8080/v1', false, 'http://127.0.0.1/*'],
    ['https://localhost/v1', false, 'https://localhost/*'],
    ['https://openrouter.ai/api/v1', true, 'https://openrouter.ai/*'],
  ])('accepts %s', (raw, remote, permission) => {
    expect(checkServerUrl(raw)).toMatchObject({ ok: true, remote, permission });
  });

  it.each([
    'https://example.com/v1',
    'http://192.168.1.20:11434/v1',
    'http://openrouter.ai/api/v1',
    'http://localhost.evil.com/v1',
    'http://user:key@localhost:11434/v1',
    'file:///etc/passwd',
    'not a url',
  ])('rejects %s', (raw) => {
    expect(checkServerUrl(raw).ok).toBe(false);
  });

  it('accepts every preset', () => {
    for (const p of SERVER_PRESETS) expect(checkServerUrl(p.baseUrl).ok, p.id).toBe(true);
  });

  it('matches the CSP and optional host permissions in wxt.config.ts', () => {
    const config = readFileSync('wxt.config.ts', 'utf8');
    for (const p of SERVER_PRESETS) {
      const check = checkServerUrl(p.baseUrl);
      if (!check.ok) throw new Error(p.id);
      expect(config, p.id).toContain(`'${check.permission}'`);
      const csp = check.remote
        ? check.url.origin
        : `${check.url.protocol}//${check.url.hostname}:*`;
      expect(config, p.id).toContain(`'${csp}'`);
    }
  });
});

describe('parseBackend', () => {
  it('defaults to Chrome’s model', () => {
    expect(parseBackend(undefined)).toEqual(DEFAULT_BACKEND);
    expect(parseBackend('junk')).toEqual(DEFAULT_BACKEND);
  });

  it('repairs what it reads', () => {
    expect(
      parseBackend({
        kind: 'server',
        preset: 'lmstudio',
        baseUrl: 'https://example.com/v1',
        model: ' qwen3-4b ',
        apiKey: 7,
        shareDocumentText: 'yes',
        extra: true,
      }),
    ).toEqual({
      kind: 'server',
      preset: 'lmstudio',
      baseUrl: 'http://localhost:1234/v1',
      model: 'qwen3-4b',
      apiKey: '',
      shareDocumentText: false,
    });
  });

  it('knows which backends are remote and names them', () => {
    const local = { ...DEFAULT_BACKEND, kind: 'server' as const };
    const remote = {
      ...local,
      preset: 'openrouter' as const,
      baseUrl: 'https://openrouter.ai/api/v1',
    };
    expect(isRemote(local)).toBe(false);
    expect(isRemote(remote)).toBe(true);
    expect(isRemote({ ...remote, kind: 'chrome' })).toBe(false);
    expect(backendLabel(local)).toBe('Ollama');
    expect(backendLabel(remote)).toBe('OpenRouter');
    expect(backendLabel(DEFAULT_BACKEND)).toBe('Chrome');
  });
});
