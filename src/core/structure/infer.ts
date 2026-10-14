import type { DocumentModel, Span } from '../model/types';
import { normalizeHeading, proseOf, wordCount } from '../model/text';
import type { Profile } from '../profiles/schema';
import { COMMON_ALIASES, ROLE_KEYWORDS, type Role } from './roles';

export type RoleSource = 'override' | 'alias' | 'keyword' | 'context' | 'llm' | 'none';

/**
 * One part of the paper as Lemma sees it: front matter, the abstract, a
 * section, the bibliography, or the headingless body of a Letter.
 */
export interface StructureUnit {
  /** Stable key: normalised heading for sections, a fixed id otherwise. */
  key: string;
  label: string;
  kind: 'front' | 'abstract' | 'section' | 'body' | 'acknowledgments' | 'bibliography';
  span: Span;
  roles: Role[];
  source: RoleSource;
  /** Index into model.sections, for sections. */
  sectionIndex: number | null;
  /** Nesting depth relative to the top sectioning level (0 = top). */
  depth: number;
  inAppendix: boolean;
  words: number;
}

function profileAliases(profile: Profile): Map<string, Role[]> {
  const map = new Map<string, Role[]>();
  for (const s of profile.sections) {
    const names = [...s.aliases, ...s.title.split('/').map((t) => t.trim())];
    for (const n of names) map.set(normalizeHeading(n), s.roles);
  }
  return map;
}

export function rolesForHeading(
  heading: string,
  profile: Profile,
): { roles: Role[]; source: RoleSource } {
  const key = normalizeHeading(heading);
  const fromProfile = profileAliases(profile).get(key);
  if (fromProfile) return { roles: [...fromProfile], source: 'alias' };
  const common = COMMON_ALIASES[key];
  if (common) return { roles: [...common], source: 'alias' };
  for (const [re, roles] of ROLE_KEYWORDS) {
    if (re.test(key)) return { roles: [...roles], source: 'keyword' };
  }
  return { roles: [], source: 'none' };
}

/** Infers which roles each part of the paper fills. Pure. */
export function inferStructure(
  model: DocumentModel,
  profile: Profile,
  overrides: Record<string, Role[]> = {},
): StructureUnit[] {
  if (model.kind !== 'tex') return [];
  const units: StructureUnit[] = [];
  const count = (span: Span) => wordCount(proseOf(model, span));

  const frontMacros = model.macros.filter((m) =>
    ['title', 'author', 'affiliation', 'maketitle'].includes(m.name),
  );
  const firstFront = frontMacros[0];
  const lastFront = frontMacros[frontMacros.length - 1];
  if (firstFront && lastFront && (model.title !== null || model.authorCount > 0)) {
    units.push({
      key: '@front',
      label: model.title ? `Title: ${model.title}` : 'Title & authors',
      kind: 'front',
      span: { start: firstFront.span.start, end: lastFront.span.end },
      roles: ['front-matter'],
      source: 'context',
      sectionIndex: null,
      depth: 0,
      inAppendix: false,
      words: 0,
    });
  }

  if (model.abstract) {
    units.push({
      key: '@abstract',
      label: 'Abstract',
      kind: 'abstract',
      span: model.abstract.span,
      roles: ['summary'],
      source: 'context',
      sectionIndex: null,
      depth: 0,
      inAppendix: false,
      words: count(model.abstract.contentSpan),
    });
  }

  const topLevel = Math.min(...model.sections.map((s) => s.level), 99);
  const bodySections = model.sections.filter((s) => !s.inAppendix);
  if (bodySections.length === 0) {
    // A Letter or short note with no headings: the body fills the main roles.
    const start = model.abstract ? model.abstract.span.end : model.bodySpan.start;
    const end =
      model.sections[0]?.headingSpan.start ?? model.bibliography?.span.start ?? model.bodySpan.end;
    const span = { start: Math.max(start, model.bodySpan.start), end: Math.max(start, end) };
    const words = count(span);
    if (words > 0) {
      units.push({
        key: '@body',
        label: 'Main text (no section headings)',
        kind: 'body',
        span,
        roles: ['motivation', 'methods', 'results', 'interpretation', 'outlook'],
        source: 'context',
        sectionIndex: null,
        depth: 0,
        inAppendix: false,
        words,
      });
    }
  }

  for (const s of model.sections) {
    const key = normalizeHeading(s.title);
    const depth = s.level - topLevel;
    const override = overrides[key];
    let roles: Role[];
    let source: RoleSource;
    if (override) {
      roles = [...override];
      source = 'override';
    } else if (s.inAppendix && depth === 0) {
      roles = ['supplementary'];
      source = 'context';
    } else {
      const r = rolesForHeading(s.title, profile);
      // Subsections only get roles from an explicit alias: they usually belong to their parent.
      if (depth > 0 && r.source === 'keyword') {
        roles = [];
        source = 'none';
      } else {
        ({ roles, source } = r);
      }
    }
    units.push({
      key,
      label: s.title || '(untitled)',
      kind: 'section',
      span: s.span,
      roles,
      source,
      sectionIndex: s.index,
      depth,
      inAppendix: s.inAppendix,
      words: count(s.bodySpan),
    });
  }

  const ackEnv = model.environments.find((e) => /^acknowledge?ments$/.test(e.name));
  if (ackEnv) {
    units.push({
      key: '@acknowledgments',
      label: 'Acknowledgments',
      kind: 'acknowledgments',
      span: ackEnv.span,
      roles: ['acknowledgments'],
      source: 'context',
      sectionIndex: null,
      depth: 0,
      inAppendix: false,
      words: count(ackEnv.contentSpan),
    });
  }

  if (model.bibliography) {
    units.push({
      key: '@bibliography',
      label: 'References',
      kind: 'bibliography',
      span: model.bibliography.span,
      roles: ['references'],
      source: 'context',
      sectionIndex: null,
      depth: 0,
      inAppendix: false,
      words: 0,
    });
  }

  return units.sort((a, b) => a.span.start - b.span.start);
}

export function rolesPresent(units: readonly StructureUnit[]): Set<Role> {
  return new Set(units.flatMap((u) => u.roles));
}

/** Index of the first profile section filled by any of `roles`, or -1. */
export function profilePosition(profile: Profile, roles: readonly Role[]): number {
  return profile.sections.findIndex((s) => s.roles.some((r) => roles.includes(r)));
}
