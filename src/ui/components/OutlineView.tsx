import { useState } from 'react';
import { rolesPresent, type StructureUnit } from '@/src/core/structure/infer';
import { ROLES, ROLE_INFO, type Role } from '@/src/core/structure/roles';
import { useController, usePanelState } from '../context';
import { Empty, RoleChip, Section } from './common';

const SOURCE_LABEL: Record<StructureUnit['source'], string> = {
  override: 'set by you',
  alias: 'from heading',
  keyword: 'guessed from heading',
  context: 'from LaTeX',
  llm: 'suggested on-device',
  none: 'role unknown',
};

function RoleEditor({ unit, onDone }: { unit: StructureUnit; onDone: () => void }) {
  const c = useController();
  const [roles, setRoles] = useState<Role[]>(unit.roles);
  const toggle = (r: Role) => {
    setRoles(roles.includes(r) ? roles.filter((x) => x !== r) : [...roles, r]);
  };
  return (
    <fieldset className="role-editor">
      <legend>Roles of “{unit.label}”</legend>
      {ROLES.map((r) => (
        <label key={r} title={ROLE_INFO[r].purpose}>
          <input type="checkbox" checked={roles.includes(r)} onChange={() => toggle(r)} />{' '}
          {ROLE_INFO[r].label}
        </label>
      ))}
      <div className="actions">
        <button
          type="button"
          className="primary"
          onClick={() => void c.setRoles(unit, roles).then(onDone)}
        >
          Save
        </button>
        {unit.source === 'override' && (
          <button type="button" onClick={() => void c.setRoles(unit, null).then(onDone)}>
            Back to automatic
          </button>
        )}
        <button type="button" onClick={onDone}>
          Cancel
        </button>
      </div>
    </fieldset>
  );
}

function UnitRow({ unit, file }: { unit: StructureUnit; file: string | null }) {
  const c = useController();
  const { ai, analysis } = usePanelState();
  const [editing, setEditing] = useState(false);
  const suggestion = ai.roleSuggestions[unit.key];
  const inOpenFile = file === null || file === analysis?.openPath;
  return (
    <li
      className={`unit depth-${String(Math.min(unit.depth, 3))}${unit.roles.length === 0 ? ' unit-unknown' : ''}`}
    >
      <div className="unit-head">
        <span className="unit-label">{unit.label}</span>
        <span className="chips">
          {unit.roles.map((r) => (
            <RoleChip key={r} role={r} />
          ))}
        </span>
      </div>
      <div className="unit-meta">
        <span className="muted">
          {SOURCE_LABEL[unit.source]}
          {unit.words > 0 && ` · ${String(unit.words)} words`}
          {!inOpenFile && file && ` · in ${file}`}
        </span>
        <span className="actions">
          {inOpenFile && (
            <button
              type="button"
              className="quiet"
              onClick={() => c.reveal(unit.span.start, unit.span.start)}
            >
              Go to
            </button>
          )}
          {unit.kind === 'section' && (
            <button
              type="button"
              className="quiet"
              aria-expanded={editing}
              onClick={() => setEditing(!editing)}
            >
              Roles…
            </button>
          )}
          {unit.kind === 'section' && ai.availability === 'available' && (
            <button type="button" className="quiet" onClick={() => void c.suggestRoles(unit)}>
              Suggest
            </button>
          )}
        </span>
      </div>
      {suggestion?.busy && <p className="muted">Thinking on this device…</p>}
      {suggestion && !suggestion.busy && (
        <p className="ai-text">
          {suggestion.suggestion ? (
            <>
              On-device suggestion:{' '}
              {suggestion.suggestion.roles.map((r) => ROLE_INFO[r].label).join(', ')}{' '}
              <button
                type="button"
                className="link"
                onClick={() => void c.setRoles(unit, suggestion.suggestion?.roles ?? [])}
              >
                use it
              </button>
            </>
          ) : (
            'No confident suggestion. Pick the roles yourself.'
          )}
        </p>
      )}
      {editing && <RoleEditor unit={unit} onDone={() => setEditing(false)} />}
    </li>
  );
}

export function OutlineView() {
  const c = useController();
  const { analysis: a } = usePanelState();
  if (!a) return <Empty>Waiting for the document…</Empty>;
  if (a.kind === 'bib')
    return <Empty>This is a bibliography file. Open a .tex file to see the outline.</Empty>;
  const present = rolesPresent(a.structure);
  const unknown = a.structure.filter(
    (u) => u.kind === 'section' && u.depth === 0 && u.roles.length === 0,
  );
  const missingFixes = new Map(
    a.diagnostics
      .filter((d) => d.ruleId === 'structure/required-role-missing')
      .flatMap((d) => d.fixes.map((f) => [f.title, f])),
  );

  return (
    <div>
      <p className="summary">
        {a.settings.mode === 'adaptive' && 'Adaptive mode: your outline is the structure.'}
        {a.settings.mode === 'template' && `Template mode: compared with “${a.profile.name}”.`}
        {a.settings.mode === 'freeform' && 'Freeform mode: no structure checks.'}{' '}
        <button type="button" className="link" onClick={() => c.setTab('settings')}>
          change
        </button>
      </p>
      {unknown.length > 0 && (
        <p className="hint">
          Lemma can’t tell what{' '}
          {unknown.length === 1 ? 'one section does' : `${String(unknown.length)} sections do`}.
          Assign roles with “Roles…” so the checks understand your structure.
        </p>
      )}
      <ul className="outline" aria-label="Paper outline">
        {a.structure.map((u, i) => (
          <UnitRow key={`${u.key}-${String(i)}`} unit={u} file={a.unitFiles[i] ?? null} />
        ))}
      </ul>
      {a.settings.mode === 'template' && (
        <Section title={`Expected by ${a.profile.name}`}>
          <ul className="checklist">
            {a.profile.sections.map((s) => {
              const ok = s.roles.some((r) => present.has(r));
              const fix = [...missingFixes.values()].find((f) =>
                s.roles.some((r) => f.title.includes(ROLE_INFO[r].label)),
              );
              return (
                <li key={s.id} className={ok ? 'ok' : s.required ? 'missing' : 'optional'}>
                  <span aria-hidden="true">{ok ? '✓' : s.required ? '✗' : '○'}</span>
                  <span>
                    {s.title} <span className="muted">{s.required ? 'required' : 'optional'}</span>
                  </span>
                  {!ok && fix && (
                    <button type="button" className="quiet" onClick={() => c.previewFix(fix)}>
                      Add skeleton
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
          {a.profile.lengthNote && <p className="muted">{a.profile.lengthNote}</p>}
        </Section>
      )}
    </div>
  );
}
