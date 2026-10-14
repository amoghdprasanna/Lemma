import type { Role } from '../structure/roles';

/**
 * How structure is checked:
 * - template: against the chosen profile;
 * - adaptive: the paper's own outline is the structure; only universal gaps are flagged;
 * - freeform: no structure checks (hygiene, notation and citation checks still run).
 */
export type Mode = 'template' | 'adaptive' | 'freeform';

export const MODES: readonly Mode[] = ['adaptive', 'template', 'freeform'];

export interface DocSettings {
  mode: Mode;
  profileId: string;
  /** Normalised section heading -> roles the user assigned. */
  roleOverrides: Record<string, Role[]>;
  /** Rule IDs switched off for this document. */
  disabledRules: string[];
}

export const DEFAULT_PROFILE_ID = 'builtin/physics-article';

export const DEFAULT_SETTINGS: DocSettings = {
  mode: 'adaptive',
  profileId: DEFAULT_PROFILE_ID,
  roleOverrides: {},
  disabledRules: [],
};
