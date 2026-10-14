import type { Span } from '../model/types';
import { isRole, type Role } from '../structure/roles';
import { MODES, type DocSettings, type Mode } from './types';

/**
 * Per-document settings can travel with the project as comment lines at the
 * top of the main file:
 *
 *   % lemma: mode=template, profile=builtin/physics-article
 *   % lemma: disable=hygiene/manual-units notation/undefined-symbol
 *   % lemma: role[encoding scheme]=methods+results
 *
 * Unknown keys and malformed values are ignored (and reported), never guessed.
 */
export const MAGIC_PREFIX = '% lemma:';
const LINE = /^%\s*lemma:\s*(.*)$/;
/** Only the first lines of a file are searched, so the block stays at the top. */
const SEARCH_LINES = 40;

export interface MagicBlock {
  /** Whole lines covered by the block, including the trailing newline. */
  span: Span;
  settings: Partial<DocSettings>;
  problems: string[];
}

function splitPairs(body: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let cur = '';
  for (const ch of body) {
    if (ch === '[') depth++;
    if (ch === ']') depth = Math.max(0, depth - 1);
    if (ch === ',' && depth === 0) {
      out.push(cur);
      cur = '';
    } else cur += ch;
  }
  out.push(cur);
  return out.map((s) => s.trim()).filter((s) => s.length > 0);
}

/** Parses one magic-comment line's body into settings; returns problems for anything ignored. */
export function parseMagicLine(body: string, into: Partial<DocSettings>, problems: string[]): void {
  for (const pair of splitPairs(body)) {
    const eq = pair.indexOf('=');
    if (eq === -1) {
      problems.push(`Ignored "${pair}": expected key=value.`);
      continue;
    }
    const key = pair.slice(0, eq).trim();
    const value = pair.slice(eq + 1).trim();
    const roleKey = /^role\[(.+)\]$/.exec(key);
    if (key === 'mode') {
      if ((MODES as readonly string[]).includes(value)) into.mode = value as Mode;
      else problems.push(`Unknown mode "${value}".`);
    } else if (key === 'profile') {
      if (/^(?:builtin|custom)\/[a-z0-9-]+$/.test(value)) into.profileId = value;
      else problems.push(`Invalid profile id "${value}".`);
    } else if (key === 'disable') {
      into.disabledRules = [
        ...(into.disabledRules ?? []),
        ...value.split(/\s+/).filter((r) => /^[a-z]+\/[a-z0-9-]+$/.test(r)),
      ];
    } else if (roleKey?.[1] !== undefined) {
      const roles = value.split('+').map((r) => r.trim());
      const valid = roles.filter(isRole);
      if (valid.length !== roles.length) problems.push(`Unknown role in "${pair}".`);
      if (valid.length > 0) {
        into.roleOverrides = { ...(into.roleOverrides ?? {}), [roleKey[1].trim()]: valid };
      }
    } else {
      problems.push(`Unknown setting "${key}".`);
    }
  }
}

/** Finds the magic-comment block (consecutive `% lemma:` lines) near the top of the file. */
export function readMagicBlock(text: string): MagicBlock | null {
  const lines = text.split('\n').slice(0, SEARCH_LINES);
  let offset = 0;
  let start = -1;
  let end = -1;
  const settings: Partial<DocSettings> = {};
  const problems: string[] = [];
  for (const line of lines) {
    const m = LINE.exec(line.trim());
    if (m) {
      if (start === -1) start = offset;
      else if (end !== offset) break; // a second, separate block: ignore it
      parseMagicLine(m[1] ?? '', settings, problems);
      end = offset + line.length + 1;
    }
    offset += line.length + 1;
  }
  if (start === -1) return null;
  return { span: { start, end: Math.min(end, text.length) }, settings, problems };
}

/** Serialises settings as a magic-comment block (ending with a newline). */
export function writeMagicBlock(settings: DocSettings): string {
  const lines = [`${MAGIC_PREFIX} mode=${settings.mode}, profile=${settings.profileId}`];
  if (settings.disabledRules.length > 0) {
    lines.push(`${MAGIC_PREFIX} disable=${[...settings.disabledRules].sort().join(' ')}`);
  }
  for (const [heading, roles] of Object.entries(settings.roleOverrides).sort()) {
    lines.push(`${MAGIC_PREFIX} role[${heading}]=${roles.join('+')}`);
  }
  return lines.join('\n') + '\n';
}

export function mergeSettings(base: DocSettings, over: Partial<DocSettings>): DocSettings {
  return {
    mode: over.mode ?? base.mode,
    profileId: over.profileId ?? base.profileId,
    roleOverrides: { ...base.roleOverrides, ...(over.roleOverrides ?? {}) },
    disabledRules: [...new Set([...base.disabledRules, ...(over.disabledRules ?? [])])],
  };
}

export type { Role };
