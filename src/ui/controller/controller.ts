import { parseLog, type LogEntry } from '@/src/core/compile-log/parse';
import { checkFix } from '@/src/core/fixes/guard';
import { diffEdits, type DiffHunk } from '@/src/core/fixes/diff';
import { normalizeEdits, type Fix, type TextEdit } from '@/src/core/fixes/text-edit';
import { cardSummary, findCard } from '@/src/core/knowledge/cards';
import { relatedCards } from '@/src/core/knowledge/search';
import { isDraftingRequest, MAX_QUESTION } from '@/src/core/llm/prompts';
import type { ProjectAnalysis, ProjectFile } from '@/src/core/project/project';
import { forkProfile } from '@/src/core/profiles/registry';
import { parseProfile, type Profile } from '@/src/core/profiles/schema';
import type { Diagnostic } from '@/src/core/rules/types';
import { writeMagicBlock } from '@/src/core/settings/magic-comment';
import type { DocSettings } from '@/src/core/settings/types';
import type { StructureUnit } from '@/src/core/structure/infer';
import type { Role } from '@/src/core/structure/roles';
import type { EditorPort, EditorSnapshot, EditorStatus } from '@/src/ports/editor';
import type { LlmAvailability, LlmPort, RoleSuggestion } from '@/src/ports/llm';
import type { StoragePort } from '@/src/ports/storage';
import type { Analyzer } from '@/src/worker/protocol';

export type Tab = 'outline' | 'checks' | 'notation' | 'learn' | 'log' | 'settings';

export interface Preview {
  title: string;
  edits: TextEdit[];
  hunks: DiffHunk[];
  /** Snapshot version the edits were computed against. */
  version: number;
  error: string | null;
}

/** A typed question in the Learn tab's chat and what came of it. */
export interface TopicState {
  id: number;
  question: string;
  /** Matching learning cards, best first. Shown whatever the model does. */
  cardIds: string[];
  /**
   * - busy: the on-device model is answering
   * - answered: `text` holds the model's answer
   * - off-topic: physics, judging results, or anything else outside LaTeX and writing
   * - refused: asked Lemma to write paper text (ADR-0003); the model never saw it
   * - notes-only: no model, or it gave no usable answer; the cards stand alone
   */
  status: 'busy' | 'answered' | 'off-topic' | 'refused' | 'notes-only';
  text: string | null;
}

export interface AiState {
  availability: LlmAvailability;
  progress: number | null;
  error: string | null;
  explanations: Record<string, { text: string | null; busy: boolean }>;
  roleSuggestions: Record<string, { suggestion: RoleSuggestion | null; busy: boolean }>;
  /** The Learn tab's chat, oldest first. Lives as long as the panel. */
  chat: TopicState[];
}

export interface PanelState {
  editor: EditorStatus;
  projectId: string | null;
  snapshot: EditorSnapshot | null;
  analysis: ProjectAnalysis | null;
  /** Snapshot version the current analysis was computed from. */
  analysisVersion: number | null;
  analyzing: boolean;
  /**
   * Debounced "busy" for the mascot: true once checking or the model has run
   * for THINK_DELAY_MS, and kept for at least THINK_MIN_MS so it never flickers.
   */
  thinking: boolean;
  storedSettings: Partial<DocSettings> | null;
  dismissed: string[];
  customProfiles: Profile[];
  learnMode: boolean;
  tab: Tab;
  focusCard: string | null;
  preview: Preview | null;
  applying: boolean;
  notice: string | null;
  log: { entries: LogEntry[]; source: 'overleaf' | 'pasted' | null; error: string | null };
  files: ProjectFile[];
  ai: AiState;
}

export interface ControllerDeps {
  editor: EditorPort;
  storage: StoragePort;
  analyzer: Analyzer;
  llm: LlmPort | null;
  projectId: string | null;
  now?: () => number;
}

const OPEN_FILE = '(open file)';
const keys = (projectId: string | null) => ({
  doc: `doc:${projectId ?? 'unknown'}`,
  files: `files:${projectId ?? 'unknown'}`,
});

const THINK_DELAY_MS = 250;
const MAX_CHAT = 30;
const THINK_MIN_MS = 900;

function isBusy(s: PanelState): boolean {
  return (
    s.analyzing ||
    s.ai.chat.some((t) => t.status === 'busy') ||
    Object.values(s.ai.explanations).some((e) => e.busy) ||
    Object.values(s.ai.roleSuggestions).some((r) => r.busy)
  );
}

interface DocRecord {
  settings: Partial<DocSettings> | null;
  dismissed: string[];
}

export class PanelController {
  private state: PanelState;
  private readonly listeners = new Set<() => void>();
  private readonly cleanups: (() => void)[] = [];
  private persistFilesTimer: ReturnType<typeof setTimeout> | null = null;
  private thinkStartTimer: ReturnType<typeof setTimeout> | null = null;
  private thinkMinTimer: ReturnType<typeof setTimeout> | null = null;
  private nextTurnId = 1;

  constructor(private readonly deps: ControllerDeps) {
    this.state = {
      editor: { state: 'connecting' },
      projectId: deps.projectId,
      snapshot: null,
      analysis: null,
      analysisVersion: null,
      analyzing: false,
      thinking: false,
      storedSettings: null,
      dismissed: [],
      customProfiles: [],
      learnMode: false,
      tab: 'checks',
      focusCard: null,
      preview: null,
      applying: false,
      notice: null,
      log: { entries: [], source: null, error: null },
      files: [],
      ai: {
        availability: 'unsupported',
        progress: null,
        error: null,
        explanations: {},
        roleSuggestions: {},
        chat: [],
      },
    };
  }

  // ------------------------------------------------------------ store plumbing

  getState = (): PanelState => this.state;

  subscribe = (fn: () => void): (() => void) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };

  private set(patch: Partial<PanelState>) {
    this.state = this.withThinking({ ...this.state, ...patch });
    for (const l of this.listeners) l();
  }

  /** Starts or stops the thinking debounce; the timers call set() again when they fire. */
  private withThinking(next: PanelState): PanelState {
    if (isBusy(next)) {
      if (!next.thinking && this.thinkStartTimer === null) {
        this.thinkStartTimer = setTimeout(() => {
          this.thinkStartTimer = null;
          this.thinkMinTimer = setTimeout(() => {
            this.thinkMinTimer = null;
            this.set({});
          }, THINK_MIN_MS);
          this.set({ thinking: true });
        }, THINK_DELAY_MS);
      }
      return next;
    }
    if (this.thinkStartTimer !== null) {
      clearTimeout(this.thinkStartTimer);
      this.thinkStartTimer = null;
    }
    return next.thinking && this.thinkMinTimer === null ? { ...next, thinking: false } : next;
  }

  private setAi(patch: Partial<AiState>) {
    this.set({ ai: { ...this.state.ai, ...patch } });
  }

  // ------------------------------------------------------------ lifecycle

  async start(): Promise<void> {
    const { storage, editor, llm } = this.deps;
    const k = keys(this.state.projectId);
    const [doc, profiles, prefs, files] = await Promise.all([
      storage.get<DocRecord>('local', k.doc),
      storage.get<unknown[]>('local', 'profiles'),
      storage.get<{ learnMode?: boolean; tab?: Tab }>('local', 'prefs'),
      storage.get<ProjectFile[]>('session', k.files),
    ]);
    this.set({
      storedSettings: doc?.settings ?? null,
      dismissed: doc?.dismissed ?? [],
      customProfiles: (profiles ?? []).map(parseProfile).filter((p): p is Profile => p !== null),
      learnMode: prefs?.learnMode ?? false,
      tab: prefs?.tab ?? 'checks',
      files: files ?? [],
    });
    this.cleanups.push(
      editor.onStatus((s) => {
        this.set({ editor: s });
      }),
      editor.onSnapshot((s) => {
        this.onSnapshot(s);
      }),
    );
    editor.requestSnapshot();
    if (llm) {
      const availability = await llm.availability();
      this.setAi({ availability });
    }
  }

  dispose(): void {
    for (const c of this.cleanups) c();
    for (const t of [this.thinkStartTimer, this.thinkMinTimer]) if (t !== null) clearTimeout(t);
    this.deps.editor.dispose();
    this.deps.analyzer.dispose();
  }

  private onSnapshot(s: EditorSnapshot) {
    const path = s.fileName ?? OPEN_FILE;
    const files = [
      ...this.state.files.filter((f) => f.path !== path && !this.sameFile(f.path, path)),
      { path, text: s.text },
    ];
    this.set({ snapshot: s, files });
    this.persistFiles();
    void this.analyze();
  }

  /** Overleaf reports only the file name; match it against a cached path from a zip import. */
  private sameFile(cached: string, name: string) {
    return cached !== name && cached.endsWith(`/${name}`);
  }

  private openPath(): string {
    const s = this.state.snapshot;
    const name = s?.fileName ?? OPEN_FILE;
    return this.state.files.find((f) => this.sameFile(f.path, name))?.path ?? name;
  }

  private persistFiles() {
    if (this.persistFilesTimer) clearTimeout(this.persistFilesTimer);
    this.persistFilesTimer = setTimeout(() => {
      void this.deps.storage.set('session', keys(this.state.projectId).files, this.state.files);
    }, 1000);
  }

  async analyze(): Promise<void> {
    const snapshot = this.state.snapshot;
    if (!snapshot) return;
    this.set({ analyzing: true });
    const result = await this.deps.analyzer.run({
      files: this.state.files,
      openPath: this.openPath(),
      base: {
        storedSettings: this.state.storedSettings,
        customProfiles: this.state.customProfiles,
        dismissed: this.state.dismissed,
        now: (this.deps.now ?? Date.now)(),
      },
    });
    if (result === null) return; // superseded by a newer analysis
    this.set({ analysis: result, analysisVersion: snapshot.version, analyzing: false });
  }

  // ------------------------------------------------------------ UI prefs

  setTab(tab: Tab, focusCard: string | null = null): void {
    this.set({ tab, focusCard });
    void this.savePrefs();
  }

  setLearnMode(learnMode: boolean): void {
    this.set({ learnMode });
    void this.savePrefs();
  }

  private savePrefs() {
    return this.deps.storage.set('local', 'prefs', {
      learnMode: this.state.learnMode,
      tab: this.state.tab,
    });
  }

  dismissNotice(): void {
    this.set({ notice: null });
  }

  // ------------------------------------------------------------ diagnostics

  /** Diagnostics visible in the current mode: Write shows errors and warnings only. */
  visibleDiagnostics(): Diagnostic[] {
    const all = this.state.analysis?.diagnostics ?? [];
    return this.state.learnMode
      ? all
      : all.filter((d) => d.severity === 'error' || d.severity === 'warning');
  }

  reveal(start: number, end: number): void {
    this.deps.editor.reveal(start, end);
  }

  async dismiss(id: string): Promise<void> {
    this.set({ dismissed: [...new Set([...this.state.dismissed, id])] });
    await this.saveDoc();
    await this.analyze();
  }

  async restoreDismissed(): Promise<void> {
    this.set({ dismissed: [] });
    await this.saveDoc();
    await this.analyze();
  }

  private saveDoc() {
    const record: DocRecord = {
      settings: this.state.storedSettings,
      dismissed: this.state.dismissed,
    };
    return this.deps.storage.set('local', keys(this.state.projectId).doc, record);
  }

  // ------------------------------------------------------------ previews and edits

  /** Opens a diff preview. Nothing changes in the document until applyPreview(). */
  previewFix(fix: Fix): void {
    const snapshot = this.state.snapshot;
    const version = this.state.analysisVersion;
    if (!snapshot || version === null) return;
    const guard = checkFix(fix, snapshot.text);
    const edits = normalizeEdits(fix.edits);
    if (!guard.ok || edits === null) {
      this.set({ notice: `Lemma refused this fix: ${guard.ok ? 'edits overlap' : guard.reason}` });
      return;
    }
    this.set({
      preview: {
        title: fix.title,
        edits,
        hunks: diffEdits(snapshot.text, edits),
        version,
        error: null,
      },
    });
  }

  /** Combines the first fix of each diagnostic (non-overlapping) into one preview. */
  previewAll(diagnostics: readonly Diagnostic[]): void {
    const edits: TextEdit[] = [];
    let count = 0;
    for (const d of diagnostics) {
      const fix = d.fixes[0];
      if (!fix) continue;
      const merged = normalizeEdits([...edits, ...fix.edits]);
      if (merged === null) continue;
      edits.splice(0, edits.length, ...merged);
      count++;
    }
    if (count === 0) return;
    this.previewFix({ title: `Apply ${String(count)} fix${count === 1 ? '' : 'es'}`, edits });
  }

  closePreview(): void {
    this.set({ preview: null });
  }

  async applyPreview(): Promise<void> {
    const p = this.state.preview;
    if (!p || this.state.applying) return;
    this.set({ applying: true });
    const r = await this.deps.editor.applyEdits(
      p.edits.map((e) => ({ from: e.start, to: e.end, insert: e.insert })),
      p.version,
    );
    if (r.ok) {
      this.set({
        applying: false,
        preview: null,
        notice: 'Applied. Use Undo in Overleaf (Ctrl/Cmd+Z) to revert.',
      });
    } else {
      this.set({
        applying: false,
        preview: {
          ...p,
          error:
            r.error === 'stale'
              ? 'The document changed since this preview was made. Lemma is re-checking; try again in a moment.'
              : r.message || 'The editor did not accept the change.',
        },
      });
      this.deps.editor.requestSnapshot();
    }
  }

  // ------------------------------------------------------------ settings

  currentSettings(): DocSettings | null {
    return this.state.analysis?.settings ?? null;
  }

  /**
   * Changes document settings. When they live in the document's magic comment,
   * this opens a preview of the comment edit; otherwise they are saved in this
   * browser straight away.
   */
  async updateSettings(patch: Partial<DocSettings>): Promise<void> {
    const a = this.state.analysis;
    const current = this.currentSettings();
    if (!a || !current) return;
    const next: DocSettings = { ...current, ...patch };
    if (a.settingsSource === 'magic-comment' && a.magic) {
      this.previewSettingsEdit(next);
      return;
    }
    this.set({ storedSettings: next });
    await this.saveDoc();
    await this.analyze();
  }

  async setRoles(unit: StructureUnit, roles: Role[] | null): Promise<void> {
    const current = this.currentSettings();
    if (!current) return;
    const overrides = Object.fromEntries(
      Object.entries(current.roleOverrides).filter(([k]) => k !== unit.key),
    );
    if (roles !== null) overrides[unit.key] = roles;
    await this.updateSettings({ roleOverrides: overrides });
  }

  async toggleRule(ruleId: string, enabled: boolean): Promise<void> {
    const current = this.currentSettings();
    if (!current) return;
    const disabled = new Set(current.disabledRules);
    if (enabled) disabled.delete(ruleId);
    else disabled.add(ruleId);
    await this.updateSettings({ disabledRules: [...disabled].sort() });
  }

  /** Writes (or rewrites) the `% lemma:` block at the top of the main file, via preview. */
  previewSettingsEdit(settings: DocSettings | null = this.currentSettings()): void {
    const a = this.state.analysis;
    if (!a || !settings) return;
    if (!a.isMain) {
      this.set({
        notice: `Settings comments go in the main file (${a.mainPath ?? 'the file with \\documentclass'}). Open it in Overleaf first.`,
      });
      return;
    }
    const span = a.magic?.span ?? { start: 0, end: 0 };
    this.previewFix({
      title: a.magic
        ? 'Update the Lemma settings comment'
        : 'Save settings as a comment at the top of this file',
      edits: [
        { kind: 'settings', start: span.start, end: span.end, insert: writeMagicBlock(settings) },
      ],
    });
  }

  /** Removes the magic comment (via preview) and keeps the settings in this browser instead. */
  async moveSettingsToBrowser(): Promise<void> {
    const a = this.state.analysis;
    if (!a?.magic) return;
    this.set({ storedSettings: a.settings });
    await this.saveDoc();
    this.previewFix({
      title: 'Remove the Lemma settings comment (settings stay in this browser)',
      edits: [{ kind: 'settings', start: a.magic.span.start, end: a.magic.span.end, insert: '' }],
    });
  }

  // ------------------------------------------------------------ profiles

  async saveProfile(profile: Profile): Promise<boolean> {
    const parsed = parseProfile(profile);
    if (!parsed?.id.startsWith('custom/')) {
      this.set({
        notice:
          'This profile is not valid; check that every part has a title and at least one role.',
      });
      return false;
    }
    const customProfiles = [...this.state.customProfiles.filter((p) => p.id !== parsed.id), parsed];
    this.set({ customProfiles });
    await this.deps.storage.set('local', 'profiles', customProfiles);
    await this.analyze();
    return true;
  }

  async fork(source: Profile, name: string): Promise<Profile> {
    const copy = forkProfile(source, name, this.state.customProfiles);
    await this.saveProfile(copy);
    return copy;
  }

  async deleteProfile(id: string): Promise<void> {
    const customProfiles = this.state.customProfiles.filter((p) => p.id !== id);
    this.set({ customProfiles });
    await this.deps.storage.set('local', 'profiles', customProfiles);
    if (this.currentSettings()?.profileId === id)
      await this.updateSettings({ profileId: 'builtin/physics-article' });
    else await this.analyze();
  }

  // ------------------------------------------------------------ compile log

  async readLog(): Promise<void> {
    const text = await this.deps.editor.readCompileLog();
    if (text === null || text.trim() === '') {
      this.set({
        log: {
          entries: [],
          source: null,
          error:
            "Lemma couldn't find a compile log on the page. In Overleaf, open the logs (the button next to Recompile) and choose the raw log view, then try again, or paste the log below.",
        },
      });
      return;
    }
    this.set({ log: { entries: parseLog(text), source: 'overleaf', error: null } });
  }

  pasteLog(text: string): void {
    this.set({ log: { entries: parseLog(text), source: 'pasted', error: null } });
  }

  // ------------------------------------------------------------ multi-file

  async importFiles(files: { path: string; text: string }[]): Promise<void> {
    const byPath = new Map(this.state.files.map((f) => [f.path, f]));
    for (const f of files) byPath.set(f.path, f);
    // The open file's live text wins over a stale zip copy.
    const snapshot = this.state.snapshot;
    if (snapshot) byPath.set(this.openPath(), { path: this.openPath(), text: snapshot.text });
    this.set({
      files: [...byPath.values()],
      notice: `Imported ${String(files.length)} file(s). They stay in this browser.`,
    });
    this.persistFiles();
    await this.analyze();
  }

  async forgetFiles(): Promise<void> {
    const snapshot = this.state.snapshot;
    this.set({ files: snapshot ? [{ path: this.openPath(), text: snapshot.text }] : [] });
    await this.deps.storage.remove('session', keys(this.state.projectId).files);
    await this.analyze();
  }

  // ------------------------------------------------------------ on-device AI

  /** Must be called from a click: may start the model download. */
  async enableAi(): Promise<void> {
    const llm = this.deps.llm;
    if (!llm) return;
    this.setAi({ progress: 0, error: null });
    try {
      await llm.enable((fraction) => {
        this.setAi({ progress: fraction });
      });
      this.setAi({ availability: await llm.availability(), progress: null });
    } catch (e) {
      this.setAi({ progress: null, error: e instanceof Error ? e.message : String(e) });
    }
  }

  async explain(d: Diagnostic): Promise<void> {
    const llm = this.deps.llm;
    const snapshot = this.state.snapshot;
    if (!llm || this.state.ai.availability !== 'available' || !snapshot) return;
    const card = findCard(d.cardId);
    const set = (v: { text: string | null; busy: boolean }) => {
      this.setAi({ explanations: { ...this.state.ai.explanations, [d.id]: v } });
    };
    set({ text: null, busy: true });
    const text = await llm.explain({
      title: card?.title ?? d.title,
      card: card ? `${cardSummary(card)} ${card.body.slice(0, 600)}` : '',
      message: d.message,
      snippet: snapshot.text.slice(Math.max(0, d.span.start - 200), d.span.end + 200),
    });
    set({ text, busy: false });
  }

  async suggestRoles(unit: StructureUnit): Promise<void> {
    const llm = this.deps.llm;
    const snapshot = this.state.snapshot;
    if (!llm || this.state.ai.availability !== 'available' || !snapshot) return;
    const set = (v: { suggestion: RoleSuggestion | null; busy: boolean }) => {
      this.setAi({ roleSuggestions: { ...this.state.ai.roleSuggestions, [unit.key]: v } });
    };
    set({ suggestion: null, busy: true });
    const suggestion = await llm.suggestRoles({
      heading: unit.label,
      excerpt: snapshot.text.slice(unit.span.start, unit.span.start + 800),
    });
    set({ suggestion, busy: false });
  }

  async explainLogEntry(index: number): Promise<void> {
    const llm = this.deps.llm;
    const entry = this.state.log.entries[index];
    if (!llm || !entry || this.state.ai.availability !== 'available') return;
    const key = `log:${String(index)}`;
    this.setAi({
      explanations: { ...this.state.ai.explanations, [key]: { text: null, busy: true } },
    });
    const text = await llm.explainLogEntry({
      message: entry.raw,
      curated: entry.translation
        ? `${entry.translation.explanation} ${entry.translation.cause}`
        : null,
    });
    this.setAi({ explanations: { ...this.state.ai.explanations, [key]: { text, busy: false } } });
  }

  /**
   * Answers a typed question about LaTeX or paper writing from the curated
   * notes, with the on-device model when it is on, and adds it to the chat.
   * Requests to write paper text are refused before the model sees them
   * (ADR-0003, ADR-0007).
   */
  async askTopic(question: string): Promise<void> {
    const q = question.trim().slice(0, MAX_QUESTION);
    if (q === '') return;
    const cards = relatedCards(q);
    const id = this.nextTurnId++;
    const base = { id, question: q, cardIds: cards.map((card) => card.id), text: null };
    const put = (turn: TopicState) => {
      const others = this.state.ai.chat.filter((t) => t.id !== id);
      this.setAi({ chat: [...others, turn].slice(-MAX_CHAT) });
    };
    if (isDraftingRequest(q)) {
      put({ ...base, status: 'refused' });
      return;
    }
    const llm = this.deps.llm;
    if (!llm || this.state.ai.availability !== 'available') {
      put({ ...base, status: 'notes-only' });
      return;
    }
    put({ ...base, status: 'busy' });
    const answer = await llm.askTopic({
      question: q,
      notes: cards.map((card) => ({
        title: card.title,
        text: `${cardSummary(card)} ${card.body.slice(0, 600)}`,
      })),
    });
    if (!this.state.ai.chat.some((t) => t.id === id)) return; // the chat was cleared meanwhile
    put(
      answer === null
        ? { ...base, status: 'notes-only' }
        : answer.kind === 'off-topic'
          ? { ...base, status: 'off-topic' }
          : { ...base, status: 'answered', text: answer.text },
    );
  }

  clearChat(): void {
    this.setAi({ chat: [] });
  }
}
