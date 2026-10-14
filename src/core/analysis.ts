import { buildModel } from './model/build';
import { LineIndex } from './model/text';
import type { DocumentModel, Span } from './model/types';
import { findAcronyms, KNOWN_ACRONYMS } from './notation/acronyms';
import { findAdjoints, findKets, findTraces, symbolIntroductions } from './notation/math';
import { findProfile } from './profiles/registry';
import type { Profile } from './profiles/schema';
import { RULES } from './rules/registry';
import { runRules, type EngineResult } from './rules/engine';
import type { Diagnostic, ProjectContext, Rule } from './rules/types';
import { mergeSettings, readMagicBlock } from './settings/magic-comment';
import { DEFAULT_SETTINGS, type DocSettings } from './settings/types';
import { inferStructure, type StructureUnit } from './structure/infer';

export interface AnalyzeInput {
  text: string;
  fileName: string | null;
  /** Settings saved in extension storage for this project (used when no magic comment). */
  storedSettings?: Partial<DocSettings> | null;
  customProfiles?: readonly Profile[];
  dismissed?: readonly string[];
  project?: Partial<ProjectContext>;
  /** Epoch milliseconds; injected so analysis stays pure. */
  now?: number;
  rules?: readonly Rule[];
  /** Pre-built model (multi-file analysis builds a flattened one). */
  model?: DocumentModel;
}

export interface NotationSheet {
  symbols: { symbol: string; context: string; line: number }[];
  acronyms: {
    acronym: string;
    expansion: string | null;
    known: string | null;
    uses: number;
    line: number;
  }[];
  macros: { name: string; body: string | null; line: number }[];
  kets: { manual: number; macro: number };
  traceForms: Record<string, number>;
  adjoint: { dagger: number; star: number };
  packages: string[];
}

export interface AnalysisResult {
  fileName: string | null;
  kind: 'tex' | 'bib';
  isMain: boolean;
  parseError: string | null;
  settings: DocSettings;
  settingsSource: 'magic-comment' | 'storage' | 'default';
  magic: { span: Span; problems: string[] } | null;
  profile: Profile;
  structure: StructureUnit[];
  diagnostics: Diagnostic[];
  rejectedFixes: EngineResult['rejectedFixes'];
  ruleErrors: EngineResult['ruleErrors'];
  notation: NotationSheet;
  partial: boolean;
  partialReasons: string[];
  stats: { words: number; sections: number; labels: number; citations: number; lines: number };
}

export function resolveSettings(
  text: string,
  stored: Partial<DocSettings> | null | undefined,
): Pick<AnalysisResult, 'settings' | 'settingsSource' | 'magic'> {
  const block = readMagicBlock(text);
  if (block) {
    return {
      settings: mergeSettings(DEFAULT_SETTINGS, block.settings),
      settingsSource: 'magic-comment',
      magic: { span: block.span, problems: block.problems },
    };
  }
  if (stored)
    return {
      settings: mergeSettings(DEFAULT_SETTINGS, stored),
      settingsSource: 'storage',
      magic: null,
    };
  return { settings: DEFAULT_SETTINGS, settingsSource: 'default', magic: null };
}

function notationSheet(model: DocumentModel, lines: LineIndex): NotationSheet {
  const kets = findKets(model);
  const traceForms: Record<string, number> = {};
  for (const t of findTraces(model)) traceForms[t.form] = (traceForms[t.form] ?? 0) + 1;
  const adj = findAdjoints(model);
  return {
    symbols: symbolIntroductions(model).map((s) => ({
      symbol: s.symbol,
      context: s.context,
      line: lines.locate(s.span.start).line,
    })),
    acronyms: findAcronyms(model)
      .filter((a) => a.definitions.length > 0 || a.acronym in KNOWN_ACRONYMS)
      .map((a) => ({
        acronym: a.acronym,
        expansion: a.definitions[0]?.expansion ?? null,
        known: KNOWN_ACRONYMS[a.acronym] ?? null,
        uses: a.uses.length,
        line: lines.locate((a.definitions[0]?.span ?? a.uses[0] ?? { start: 0 }).start).line,
      }))
      .sort((x, y) => x.acronym.localeCompare(y.acronym)),
    macros: model.macroDefinitions.map((d) => ({
      name: d.name,
      body: d.body,
      line: lines.locate(d.span.start).line,
    })),
    kets: {
      manual: kets.filter((k) => k.style === 'manual').length,
      macro: kets.filter((k) => k.style === 'macro').length,
    },
    traceForms,
    adjoint: {
      dagger: adj.filter((a) => a.mark === 'dagger').length,
      star: adj.filter((a) => a.mark === 'star').length,
    },
    packages: model.packages.map((p) => p.name),
  };
}

/** The whole analysis pipeline: parse, resolve settings, infer structure, run rules. Pure. */
export function analyze(input: AnalyzeInput): AnalysisResult {
  const model = input.model ?? buildModel(input.text, input.fileName);
  const lines = new LineIndex(model.text);
  const resolved = resolveSettings(model.text, input.storedSettings);
  const profile = findProfile(resolved.settings.profileId, input.customProfiles ?? []);
  const structure = inferStructure(model, profile, resolved.settings.roleOverrides);

  const partialReasons: string[] = [];
  if (model.kind === 'tex' && !model.isMain)
    partialReasons.push('This file is part of a larger document.');
  if (model.inputs.length > 0 && input.project?.partial !== false) {
    partialReasons.push(
      `It includes ${String(model.inputs.length)} other file(s) Lemma has not read (${model.inputs
        .slice(0, 3)
        .map((i) => i.path)
        .join(', ')}${model.inputs.length > 3 ? ', …' : ''}).`,
    );
  }
  const project: ProjectContext = {
    partial: input.project?.partial ?? partialReasons.length > 0,
    externalLabels: input.project?.externalLabels ?? new Set(),
    externalRefs: input.project?.externalRefs ?? new Set(),
    bibEntries: input.project?.bibEntries ?? null,
  };
  if (!project.partial) partialReasons.length = 0;

  const engine = runRules(
    {
      model,
      profile,
      settings: resolved.settings,
      structure,
      project,
      lines,
      now: new Date(input.now ?? 0),
    },
    input.rules ?? RULES,
    new Set(input.dismissed ?? []),
  );

  return {
    fileName: model.fileName,
    kind: model.kind,
    isMain: model.isMain,
    parseError: model.parseError,
    ...resolved,
    profile,
    structure,
    diagnostics: engine.diagnostics,
    rejectedFixes: engine.rejectedFixes,
    ruleErrors: engine.ruleErrors,
    notation: notationSheet(model, lines),
    partial: project.partial,
    partialReasons,
    stats: {
      words: structure.reduce((n, u) => n + (u.depth === 0 ? u.words : 0), 0),
      sections: model.sections.length,
      labels: model.labels.length,
      citations: model.cites.length,
      lines: model.text.split('\n').length,
    },
  };
}
