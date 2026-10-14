import type { BibEntry, DocumentModel, Span } from '../model/types';
import type { LineIndex } from '../model/text';
import type { Fix } from '../fixes/text-edit';
import type { Profile } from '../profiles/schema';
import type { DocSettings } from '../settings/types';
import type { StructureUnit } from '../structure/infer';

export type Severity = 'error' | 'warning' | 'info' | 'learn';
export type Category = 'structure' | 'hygiene' | 'notation' | 'citations';

export const SEVERITY_ORDER: Record<Severity, number> = { error: 0, warning: 1, info: 2, learn: 3 };

/** What Lemma knows beyond the open file (Phase 5 fills this from cached files). */
export interface ProjectContext {
  /** True when the open file is not the whole project (\input, fragments, uncached files). */
  partial: boolean;
  /** Labels defined in other known files of the project. */
  externalLabels: ReadonlySet<string>;
  /** Labels referenced from other known files of the project. */
  externalRefs: ReadonlySet<string>;
  /** Bibliography entries from known .bib files, or null if none are known. */
  bibEntries: readonly BibEntry[] | null;
}

export interface RuleContext {
  model: DocumentModel;
  profile: Profile;
  settings: DocSettings;
  structure: readonly StructureUnit[];
  project: ProjectContext;
  lines: LineIndex;
  /** Injected clock, so rules stay pure. */
  now: Date;
}

export interface Finding {
  message: string;
  span: Span;
  /** Overrides the rule's default severity for this finding. */
  severity?: Severity;
  fixes?: Fix[];
  /** Stable identity for dismissals; defaults to the text under `span`. */
  key?: string;
}

export interface Rule {
  id: string;
  category: Category;
  severity: Severity;
  /** Short name shown in settings. */
  title: string;
  /** Learning card explaining the convention. */
  cardId: string;
  check(ctx: RuleContext): Finding[];
}

export interface Diagnostic {
  /** Fingerprint, stable across unrelated edits; used for dismissals. */
  id: string;
  ruleId: string;
  category: Category;
  severity: Severity;
  title: string;
  message: string;
  span: Span;
  line: number;
  cardId: string;
  fixes: Fix[];
}
