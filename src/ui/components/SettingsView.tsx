import { useState } from 'react';
import { BUILTIN_PROFILES, findProfile } from '@/src/core/profiles/registry';
import type { Profile } from '@/src/core/profiles/schema';
import { RULES } from '@/src/core/rules/registry';
import type { Category } from '@/src/core/rules/types';
import type { Mode } from '@/src/core/settings/types';
import { readZip } from '@/src/adapters/zip/read-zip';
import { useController, usePanelState } from '../context';
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

function AiSettings() {
  const c = useController();
  const { ai } = usePanelState();
  const text: Record<typeof ai.availability, string> = {
    unsupported:
      'This browser does not offer Chrome’s built-in AI (Prompt API). Everything else in Lemma works without it.',
    unavailable:
      'Chrome’s on-device model is not available on this device (it needs 22 GB free disk and either a GPU with more than 4 GB memory or 16 GB RAM). Everything else works without it.',
    downloadable:
      'Chrome can download its on-device model (several GB, once). Lemma never starts the download unless you click below.',
    downloading: 'Chrome is downloading the on-device model.',
    available:
      'On-device explanations are on. Your text is processed by Chrome’s local model and never leaves this computer.',
  };
  return (
    <Section title="On-device AI explanations (optional)">
      <p>{text[ai.availability]}</p>
      <p className="muted">
        Used only to explain checks in terms of your text, suggest section roles and reword compile
        errors. It never writes your paper, and every answer is filtered. English only.
      </p>
      {ai.progress !== null && (
        <p>
          <progress value={ai.progress} max={1} aria-label="Model download progress" />{' '}
          {Math.round(ai.progress * 100)}%
        </p>
      )}
      {ai.error && <p className="error">{ai.error}</p>}
      {(ai.availability === 'downloadable' || ai.availability === 'downloading') &&
        ai.progress === null && (
          <button type="button" className="primary" onClick={() => void c.enableAi()}>
            Enable AI explanations
          </button>
        )}
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
          Lemma runs entirely in your browser. It makes no network requests, has no telemetry, and
          never writes your paper: fixes are mechanical edits or empty skeletons, always previewed
          and undoable.
        </p>
      </Section>
    </div>
  );
}
