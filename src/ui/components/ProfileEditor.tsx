import { useState } from 'react';
import type { Profile, ProfileSection } from '@/src/core/profiles/schema';
import { ROLES, ROLE_INFO, type Role } from '@/src/core/structure/roles';
import { useController } from '../context';

/**
 * Edit a custom structure profile: rename, add, remove, reorder and merge
 * parts, mark them required or optional, and choose the roles each fills.
 */
export function ProfileEditor({ profile, onClose }: { profile: Profile; onClose: () => void }) {
  const c = useController();
  const [draft, setDraft] = useState<Profile>(structuredClone(profile));
  const setSections = (sections: ProfileSection[]) => {
    setDraft({ ...draft, sections });
  };
  const update = (i: number, patch: Partial<ProfileSection>) => {
    setSections(draft.sections.map((s, j) => (j === i ? { ...s, ...patch } : s)));
  };
  const move = (i: number, by: number) => {
    const s = [...draft.sections];
    const [item] = s.splice(i, 1);
    if (item) s.splice(i + by, 0, item);
    setSections(s);
  };
  const merge = (i: number) => {
    const a = draft.sections[i];
    const b = draft.sections[i + 1];
    if (!a || !b) return;
    const merged: ProfileSection = {
      ...a,
      title: `${a.title} / ${b.title}`,
      roles: [...new Set([...a.roles, ...b.roles])],
      aliases: [...new Set([...a.aliases, ...b.aliases])],
      required: a.required || b.required,
    };
    setSections([...draft.sections.slice(0, i), merged, ...draft.sections.slice(i + 2)]);
  };
  const add = () => {
    setSections([
      ...draft.sections,
      {
        id: `part-${String(Date.now())}`,
        title: 'New part',
        roles: ['results'],
        required: false,
        aliases: [],
        purpose: '',
      },
    ]);
  };
  const toggleRole = (i: number, r: Role) => {
    const roles = draft.sections[i]?.roles ?? [];
    const next = roles.includes(r) ? roles.filter((x) => x !== r) : [...roles, r];
    if (next.length > 0) update(i, { roles: next });
  };

  return (
    <div className="profile-editor">
      <label>
        Name{' '}
        <input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
      </label>
      <ol className="profile-parts">
        {draft.sections.map((s, i) => (
          <li key={s.id}>
            <div className="part-row">
              <label>
                <span className="sr-only">Title of part {i + 1}</span>
                <input value={s.title} onChange={(e) => update(i, { title: e.target.value })} />
              </label>
              <label className="inline">
                <input
                  type="checkbox"
                  checked={s.required}
                  onChange={(e) => update(i, { required: e.target.checked })}
                />{' '}
                required
              </label>
            </div>
            <details>
              <summary>Roles: {s.roles.map((r) => ROLE_INFO[r].label).join(', ')}</summary>
              <div className="role-grid">
                {ROLES.map((r) => (
                  <label key={r} className="inline">
                    <input
                      type="checkbox"
                      checked={s.roles.includes(r)}
                      onChange={() => toggleRole(i, r)}
                    />{' '}
                    {ROLE_INFO[r].label}
                  </label>
                ))}
              </div>
              <label>
                Other headings that mean this part (comma-separated)
                <input
                  value={s.aliases.join(', ')}
                  onChange={(e) =>
                    update(i, {
                      aliases: e.target.value
                        .split(',')
                        .map((x) => x.trim().toLowerCase())
                        .filter((x) => x !== ''),
                    })
                  }
                />
              </label>
            </details>
            <div className="actions">
              <button
                type="button"
                className="quiet"
                disabled={i === 0}
                onClick={() => move(i, -1)}
                aria-label={`Move ${s.title} up`}
              >
                ↑
              </button>
              <button
                type="button"
                className="quiet"
                disabled={i === draft.sections.length - 1}
                onClick={() => move(i, 1)}
                aria-label={`Move ${s.title} down`}
              >
                ↓
              </button>
              <button
                type="button"
                className="quiet"
                disabled={i === draft.sections.length - 1}
                onClick={() => merge(i)}
              >
                Merge with next
              </button>
              <button
                type="button"
                className="quiet"
                disabled={draft.sections.length === 1}
                onClick={() => setSections(draft.sections.filter((_, j) => j !== i))}
              >
                Remove
              </button>
            </div>
          </li>
        ))}
      </ol>
      <div className="actions">
        <button type="button" onClick={add}>
          Add part
        </button>
        <button
          type="button"
          className="primary"
          onClick={() =>
            void c.saveProfile(draft).then((ok) => {
              if (ok) onClose();
            })
          }
        >
          Save profile
        </button>
        <button type="button" onClick={onClose}>
          Cancel
        </button>
      </div>
    </div>
  );
}
