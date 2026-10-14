import { DEFAULT_PROFILE_ID } from '../settings/types';
import { parseProfile, type Profile } from './schema';

const modules = import.meta.glob<{ default: unknown }>('./builtin/*.json', { eager: true });

/** Built-in profiles, default first. Invalid JSON fails loudly at startup (and in tests). */
export const BUILTIN_PROFILES: readonly Profile[] = Object.entries(modules)
  .map(([path, mod]) => {
    const profile = parseProfile(mod.default);
    if (profile === null) throw new Error(`Invalid built-in profile: ${path}`);
    return profile;
  })
  .sort((a, b) =>
    a.id === DEFAULT_PROFILE_ID
      ? -1
      : b.id === DEFAULT_PROFILE_ID
        ? 1
        : a.name.localeCompare(b.name),
  );

export function defaultProfile(): Profile {
  const p = BUILTIN_PROFILES.find((x) => x.id === DEFAULT_PROFILE_ID);
  if (!p) throw new Error('Default profile missing');
  return p;
}

export function findProfile(id: string, custom: readonly Profile[] = []): Profile {
  return [...BUILTIN_PROFILES, ...custom].find((p) => p.id === id) ?? defaultProfile();
}

/** Copies a profile as an editable custom profile with a unique id. */
export function forkProfile(source: Profile, name: string, existing: readonly Profile[]): Profile {
  const base =
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'profile';
  let id = `custom/${base}`;
  for (let n = 2; existing.some((p) => p.id === id); n++) id = `custom/${base}-${String(n)}`;
  return { ...structuredClone(source), id, name };
}
