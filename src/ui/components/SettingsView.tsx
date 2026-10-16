import { useState } from 'react';
import { BUILTIN_PROFILES, findProfile } from '@/src/core/profiles/registry';
import type { Profile } from '@/src/core/profiles/schema';
import { RULES } from '@/src/core/rules/registry';
import type { Category } from '@/src/core/rules/types';
import type { Mode } from '@/src/core/settings/types';
import { readZip } from '@/src/adapters/zip/read-zip';
import {
  checkServerUrl,
  findPreset,
  SERVER_PRESETS,
  type BackendKind,
  type BackendSettings,
  type ServerPresetId,
} from '@/src/core/llm/backend';
import { useController, usePanelState } from '../context';
import { InlineMarkdown } from '../markdown';
import { Empty, Section } from './common';
import { ProfileEditor } from './ProfileEditor';

const MODE_TEXT: Record<Mode, [string, string]> = {
  adaptive: [
    'Adaptive',
    'Your outline is the structure. Only gaps every paper must fill are flagged (recommended).',
  ],
  template: ['Template', 'Compare the paper with a profile and list missing parts.'],
  freeform: ['Freeform', 'No structure checks; LaTeX, notation and citation checks still run.'],
};

const CATEGORY: Record<Category, string> = {
  structure: 'Structure',
  hygiene: 'LaTeX hygiene',
  notation: 'Quantum-information notation',
  citations: 'Citations',
};

const BACKEND_TEXT: Record<BackendKind, [string, string]> = {
  chrome: ['Chrome built-in', 'Gemini Nano, if Chrome offers it on this device.'],
  server: [
    'A model server',
    'Ollama, LM Studio or llama.cpp on this computer (runs on 8 GB laptops), or OpenRouter.',
  ],
  off: ['Off', 'Checks, fixes and notes all work without AI.'],
};

function ChromeModel() {
  const c = useController();
  const { ai } = usePanelState();
  const text: Record<typeof ai.availability, string> = {
    unsupported:
      'This browser does not offer Chrome’s built-in AI (Prompt API). Try a model server instead.',
    unavailable:
      'Chrome’s on-device model is not available on this device (it needs 22 GB free disk and either a GPU with more than 4 GB memory or 16 GB RAM). A model server needs much less.',
    downloadable:
      'Chrome can download its on-device model (several GB, once). Lemma never starts the download unless you click below.',
    downloading: 'Chrome is downloading the on-device model.',
    available: 'On. Your text is processed by Chrome’s local model and never leaves this computer.',
  };
  return (
    <>
      <p>{text[ai.availability]}</p>
      {ai.progress !== null && (
        <p>
          <progress value={ai.progress} max={1} aria-label="Model download progress" />{' '}
          {Math.round(ai.progress * 100)}%
        </p>
      )}
      {(ai.availability === 'downloadable' || ai.availability === 'downloading') &&
        ai.progress === null && (
          <button type="button" className="primary" onClick={() => void c.enableAi()}>
            Enable AI explanations
          </button>
        )}
    </>
  );
}

/** Server settings are a draft until Connect, so typing never sends a request. */
function ServerModel() {
  const c = useController();
  const { ai } = usePanelState();
  const [draft, setDraft] = useState<BackendSettings>(ai.backend);
  const preset = findPreset(draft.preset);
  const url = checkServerUrl(draft.baseUrl);
  const remote = url.ok && url.remote;
  const saved = ai.backend;
  const connected =
    ai.availability === 'available' && JSON.stringify(draft) === JSON.stringify(saved);
  const set = (patch: Partial<BackendSettings>) => setDraft({ ...draft, ...patch });

  return (
    <>
      <label className="field">
        Server{' '}
        <select
          value={draft.preset}
          onChange={(e) => {
            const p = findPreset(e.target.value as ServerPresetId);
            set({ preset: p.id, baseUrl: p.baseUrl, model: '' });
          }}
        >
          {SERVER_PRESETS.map((p) => (
            <option key={p.id} value={p.id}>
              {p.label}
            </option>
          ))}
        </select>
      </label>
      <p className="muted">
        <InlineMarkdown text={preset.setup} />
      </p>
      <label className="field">
        Address{' '}
        <input
          type="url"
          value={draft.baseUrl}
          spellCheck={false}
          onChange={(e) => set({ baseUrl: e.target.value })}
        />
      </label>
      {!url.ok && <p className="error">{url.reason}</p>}
      <label className="field">
        Model{' '}
        <input
          type="text"
          list="lemma-models"
          value={draft.model}
          placeholder={preset.exampleModel}
          spellCheck={false}
          onChange={(e) => set({ model: e.target.value })}
        />
        <datalist id="lemma-models">
          {ai.models.map((m) => (
            <option key={m} value={m} />
          ))}
        </datalist>
      </label>
      {remote && (
        <>
          <label className="field">
            API key{' '}
            <input
              type="password"
              value={draft.apiKey}
              autoComplete="off"
              onChange={(e) => set({ apiKey: e.target.value })}
            />
          </label>
          <p className="muted">
            Stored unencrypted in this browser’s extension storage. Ask Lemma questions never
            include your paper.
          </p>
          <label className="inline">
            <input
              type="checkbox"
              checked={draft.shareDocumentText}
              onChange={(e) => set({ shareDocumentText: e.target.checked })}
            />{' '}
            Send snippets of my paper and compile log to {preset.label.replace(' (remote)', '')}{' '}
            (for “Explain for my text”, role suggestions and log explanations)
          </label>
        </>
      )}
      <div className="actions">
        <button
          type="button"
          className="primary"
          disabled={!url.ok || ai.progress !== null}
          onClick={() => void c.connectBackend(draft)}
        >
          {ai.progress !== null ? 'Connecting…' : connected ? 'Reconnect' : 'Connect'}
        </button>
      </div>
      {connected && (
        <p>
          Connected{saved.model ? ` to ${saved.model}` : ''}.{' '}
          {remote
            ? `Requests go to ${url.url.host} under your key.`
            : 'Your text stays on this computer.'}
        </p>
      )}
      {!connected && ai.availability === 'unavailable' && !ai.error && (
        <p className="error">Can’t use this server right now. Press Connect to see why.</p>
      )}
    </>
  );
}

function AiSettings() {
  const c = useController();
  const { ai } = usePanelState();
  return (
    <Section title="AI explanations (optional)">
      <fieldset className="radios">
        <legend className="sr-only">Which model answers</legend>
        {(Object.keys(BACKEND_TEXT) as BackendKind[]).map((k) => (
          <label key={k}>
            <input
              type="radio"
              name="ai-backend"
              checked={ai.backend.kind === k}
              onChange={() => void c.setBackend({ ...ai.backend, kind: k })}
            />{' '}
            <strong>{BACKEND_TEXT[k][0]}</strong>{' '}
            <span className="muted">{BACKEND_TEXT[k][1]}</span>
          </label>
        ))}
      </fieldset>
      {ai.backend.kind === 'chrome' && <ChromeModel />}
      {ai.backend.kind === 'server' && <ServerModel key={JSON.stringify(ai.backend)} />}
      {ai.error && <p className="error">{ai.error}</p>}
      <p className="muted">
        Used to explain checks in terms of your text, suggest section roles, reword compile errors
        and answer questions in Learn. It never writes your paper, and every answer is filtered.
        English only.
      </p>
    </Section>
  );
}

function ProjectFiles() {
  const c = useController();
  const { files, analysis } = usePanelState();
  const [error, setError] = useState<string | null>(null);
  return (
    <Section title="Project files">
      <p className="muted">
        Overleaf shows one file at a time. Lemma remembers each file you open (until you close the
        browser), or you can import the project zip from Overleaf’s menu (“Download as source”).
        Files stay in this browser.
      </p>
      {files.length === 0 ? (
        <Empty>No files yet.</Empty>
      ) : (
        <ul className="plain">
          {files.map((f) => (
            <li key={f.path}>
              {f.path}
              {f.path === analysis?.mainPath && <span className="muted"> (main)</span>}
            </li>
          ))}
        </ul>
      )}
      {analysis && analysis.missingFiles.length > 0 && (
        <p className="hint">Not seen yet: {analysis.missingFiles.join(', ')}</p>
      )}
      <div className="actions">
        <label className="button">
          Import project zip…
          <input
            type="file"
            accept=".zip,application/zip"
            className="sr-only"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              setError(null);
              void file
                .arrayBuffer()
                .then((buf) => readZip(buf))
                .then((entries) => c.importFiles(entries))
                .catch((err: unknown) =>
                  setError(err instanceof Error ? err.message : String(err)),
                );
              e.target.value = '';
            }}
          />
        </label>
        <button type="button" onClick={() => void c.forgetFiles()}>
          Forget other files
        </button>
      </div>
      {error && <p className="error">{error}</p>}
    </Section>
  );
}

export function SettingsView() {
  const c = useController();
  const { analysis: a, customProfiles } = usePanelState();
  const [editing, setEditing] = useState<Profile | null>(null);
  if (!a) return <Empty>Waiting for the document…</Empty>;
  const s = a.settings;
  const profiles = [...BUILTIN_PROFILES, ...customProfiles];
  const active = findProfile(s.profileId, customProfiles);

  if (editing) {
    return (
      <Section title={`Edit profile: ${editing.name}`}>
        <ProfileEditor profile={editing} onClose={() => setEditing(null)} />
      </Section>
    );
  }

  return (
    <div>
      <Section title="Structure mode">
        <fieldset className="radios">
          <legend className="sr-only">Structure mode</legend>
          {(Object.keys(MODE_TEXT) as Mode[]).map((m) => (
            <label key={m}>
              <input
                type="radio"
                name="mode"
                checked={s.mode === m}
                onChange={() => void c.updateSettings({ mode: m })}
              />{' '}
              <strong>{MODE_TEXT[m][0]}</strong> <span className="muted">{MODE_TEXT[m][1]}</span>
            </label>
          ))}
        </fieldset>
      </Section>

      <Section title="Profile">
        <label>
          <span className="sr-only">Profile</span>
          <select
            value={active.id}
            onChange={(e) => void c.updateSettings({ profileId: e.target.value })}
          >
            {profiles.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
        <p className="muted">{active.description}</p>
        <div className="actions">
          <button
            type="button"
            onClick={() =>
              void c.fork(active, `${active.name} (my copy)`).then((p) => {
                void c.updateSettings({ profileId: p.id });
                setEditing(p);
              })
            }
          >
            Copy and edit
          </button>
          {active.id.startsWith('custom/') && (
            <>
              <button type="button" onClick={() => setEditing(active)}>
                Edit
              </button>
              <button
                type="button"
                className="quiet"
                onClick={() => void c.deleteProfile(active.id)}
              >
                Delete
              </button>
            </>
          )}
        </div>
      </Section>

      <Section title="Where these settings live">
        {a.settingsSource === 'magic-comment' ? (
          <>
            <p>
              In the document: a <code>% lemma:</code> comment at the top of{' '}
              {a.mainPath ?? 'the main file'}, so they travel with the project.
            </p>
            <button type="button" onClick={() => void c.moveSettingsToBrowser()}>
              Keep them in this browser instead
            </button>
          </>
        ) : (
          <>
            <p>In this browser only{a.settingsSource === 'default' ? ' (defaults)' : ''}.</p>
            <button type="button" onClick={() => c.previewSettingsEdit()}>
              Save as a comment in the document…
            </button>
          </>
        )}
        {a.magic && a.magic.problems.length > 0 && (
          <p className="error">Ignored in the settings comment: {a.magic.problems.join(' ')}</p>
        )}
      </Section>

      <Section title="Checks">
        {(Object.keys(CATEGORY) as Category[]).map((cat) => (
          <fieldset key={cat} className="rules">
            <legend>{CATEGORY[cat]}</legend>
            {RULES.filter((r) => r.category === cat).map((r) => (
              <label key={r.id} className="inline">
                <input
                  type="checkbox"
                  checked={!s.disabledRules.includes(r.id)}
                  onChange={(e) => void c.toggleRule(r.id, e.target.checked)}
                />{' '}
                {r.title}
              </label>
            ))}
          </fieldset>
        ))}
      </Section>

      <ProjectFiles />
      <AiSettings />

      <Section title="Privacy">
        <p className="muted">
          Lemma runs on your computer and has no telemetry. Its only network requests go to a model
          server you connect above; with a remote one, your paper is sent only if you allow it.
          Lemma never writes your paper: fixes are mechanical edits or empty skeletons, always
          previewed and undoable.
        </p>
      </Section>
    </div>
  );
}
