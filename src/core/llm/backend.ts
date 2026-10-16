/**
 * Which model answers (docs/adr/0008-ai-backends.md). Pure: the presets, the
 * stored settings and the address rules that the CSP mirrors.
 */

export type BackendKind = 'chrome' | 'server' | 'off';

export type ServerPresetId = 'ollama' | 'lmstudio' | 'llamacpp' | 'openrouter';

export interface ServerPreset {
  id: ServerPresetId;
  label: string;
  baseUrl: string;
  /** Hosted elsewhere: paper text stays off it unless the user allows it. */
  remote: boolean;
  /** A model to suggest when the server cannot list its own. */
  exampleModel: string;
  /** One line on getting it running. */
  setup: string;
}

export const SERVER_PRESETS: readonly ServerPreset[] = [
  {
    id: 'ollama',
    label: 'Ollama',
    baseUrl: 'http://localhost:11434/v1',
    remote: false,
    exampleModel: 'qwen3:4b',
    setup:
      'Install Ollama, run `ollama pull qwen3:4b`, and allow Lemma once with `OLLAMA_ORIGINS="chrome-extension://*"` (see the README).',
  },
  {
    id: 'lmstudio',
    label: 'LM Studio',
    baseUrl: 'http://localhost:1234/v1',
    remote: false,
    exampleModel: 'qwen3-4b',
    setup: 'In LM Studio, download a model, then start the server from the Developer tab.',
  },
  {
    id: 'llamacpp',
    label: 'llama.cpp server',
    baseUrl: 'http://localhost:8080/v1',
    remote: false,
    exampleModel: 'default',
    setup: 'Run `llama-server -hf <model>`; it serves one model on port 8080.',
  },
  {
    id: 'openrouter',
    label: 'OpenRouter (remote)',
    baseUrl: 'https://openrouter.ai/api/v1',
    remote: true,
    exampleModel: 'google/gemma-3-12b-it',
    setup: 'Create a key at openrouter.ai. Requests go to OpenRouter under your account.',
  },
];

export function findPreset(id: ServerPresetId): ServerPreset {
  const preset = SERVER_PRESETS.find((p) => p.id === id);
  if (!preset) throw new Error(`Unknown server preset ${id}`);
  return preset;
}

export interface BackendSettings {
  kind: BackendKind;
  preset: ServerPresetId;
  /** Chat-completions base, ending before `/chat/completions`. */
  baseUrl: string;
  model: string;
  /** Only for remote servers. Kept in this browser's extension storage, unencrypted. */
  apiKey: string;
  /** Remote only: also send snippets of the paper and the log (ADR-0008 point 5). */
  shareDocumentText: boolean;
}

export const DEFAULT_BACKEND: BackendSettings = {
  kind: 'chrome',
  preset: 'ollama',
  baseUrl: findPreset('ollama').baseUrl,
  model: '',
  apiKey: '',
  shareDocumentText: false,
};

/** Hosts a server may live on. The extension-page CSP lists the same ones (wxt.config.ts). */
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1']);
const REMOTE_ORIGINS = new Set(['https://openrouter.ai']);

export type UrlCheck =
  { ok: true; url: URL; remote: boolean; permission: string } | { ok: false; reason: string };

/** Accepts only the addresses ADR-0008 allows, and names the host permission to request. */
export function checkServerUrl(raw: string): UrlCheck {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return { ok: false, reason: 'That is not a web address.' };
  }
  if (url.username !== '' || url.password !== '')
    return { ok: false, reason: 'Put the API key in its own field, not in the address.' };
  if ((url.protocol === 'http:' || url.protocol === 'https:') && LOCAL_HOSTS.has(url.hostname))
    return { ok: true, url, remote: false, permission: `${url.protocol}//${url.hostname}/*` };
  if (REMOTE_ORIGINS.has(url.origin))
    return { ok: true, url, remote: true, permission: `${url.origin}/*` };
  return {
    ok: false,
    reason: 'Lemma only connects to a server on this computer (localhost) or to OpenRouter.',
  };
}

/** Stored settings, repaired: unknown fields dropped, a bad address reset to its preset's. */
export function parseBackend(raw: unknown): BackendSettings {
  if (typeof raw !== 'object' || raw === null) return DEFAULT_BACKEND;
  const r = raw as Partial<Record<keyof BackendSettings, unknown>>;
  const kind = r.kind === 'server' || r.kind === 'off' ? r.kind : 'chrome';
  const preset = SERVER_PRESETS.some((p) => p.id === r.preset)
    ? (r.preset as ServerPresetId)
    : DEFAULT_BACKEND.preset;
  const baseUrl =
    typeof r.baseUrl === 'string' && checkServerUrl(r.baseUrl).ok
      ? r.baseUrl
      : findPreset(preset).baseUrl;
  return {
    kind,
    preset,
    baseUrl,
    model: typeof r.model === 'string' ? r.model.trim() : '',
    apiKey: typeof r.apiKey === 'string' ? r.apiKey.trim() : '',
    shareDocumentText: r.shareDocumentText === true,
  };
}

/** True when answers come from a server on another computer. */
export function isRemote(b: BackendSettings): boolean {
  const url = checkServerUrl(b.baseUrl);
  return b.kind === 'server' && url.ok && url.remote;
}

/** Short name for the status bar. */
export function backendLabel(b: BackendSettings): string {
  if (b.kind === 'chrome') return 'Chrome';
  if (b.kind === 'off') return 'off';
  return findPreset(b.preset).label.replace(' (remote)', '');
}
