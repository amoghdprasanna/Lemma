import { describe, expect, it, vi } from 'vitest';
import { fakeLlm } from '@/src/adapters/llm/fake';
import { memoryStorage } from '@/src/adapters/storage/storage';
import { findCard } from '@/src/core/knowledge/cards';
import { defaultProfile } from '@/src/core/profiles/registry';
import type {
  ApplyResult,
  EditOp,
  EditorPort,
  EditorSnapshot,
  EditorStatus,
} from '@/src/ports/editor';
import { inlineAnalyzer } from '@/src/worker/protocol';
import { PanelController } from './controller';

/** An editor that holds text, versions it, and applies edits like the page hook. */
function fakeEditor(initial: string, fileName = 'main.tex') {
  let text = initial;
  let version = 1;
  const snaps = new Set<(s: EditorSnapshot) => void>();
  const statuses = new Set<(s: EditorStatus) => void>();
  const revealed: [number, number][] = [];
  const emit = () => {
    for (const s of snaps) s({ text, version, fileName, docId: 'd' });
  };
  const port: EditorPort = {
    onStatus: (cb) => {
      statuses.add(cb);
      cb({ state: 'ready', fileName, docId: 'd' });
      return () => statuses.delete(cb);
    },
    onSnapshot: (cb) => {
      snaps.add(cb);
      return () => snaps.delete(cb);
    },
    requestSnapshot: emit,
    applyEdits(edits: EditOp[], v: number): Promise<ApplyResult> {
      if (v !== version) return Promise.resolve({ ok: false, error: 'stale', message: '' });
      for (const e of [...edits].sort((a, b) => b.from - a.from))
        text = text.slice(0, e.from) + e.insert + text.slice(e.to);
      version++;
      emit();
      return Promise.resolve({ ok: true });
    },
    reveal: (a, b) => revealed.push([a, b]),
    readCompileLog: () => Promise.resolve('! Undefined control sequence.\nl.4 \\foo\n'),
    dispose: () => undefined,
  };
  return {
    port,
    revealed,
    get text() {
      return text;
    },
    type(s: string) {
      text += s;
      version++;
      emit();
    },
  };
}

const DOC = String.raw`\documentclass{article}
\usepackage{amsmath}
\begin{document}
\section{Results}
\begin{equation} x = 1 \label{eq:a} \end{equation}
By Eq.~(\ref{eq:a}) and $$ y $$.
\bibliography{refs}
\end{document}
`;

async function setup(text = DOC, llm = fakeLlm({ availability: 'downloadable' })) {
  const editor = fakeEditor(text);
  const storage = memoryStorage();
  const c = new PanelController({
    editor: editor.port,
    storage,
    analyzer: inlineAnalyzer(),
    llm,
    projectId: 'p1',
    now: () => 0,
  });
  await c.start();
  await vi.waitFor(() => {
    expect(c.getState().analysis).not.toBeNull();
  });
  return { c, editor, storage, llm };
}

describe('PanelController', () => {
  it('analyses snapshots and hides info/learn items in Write mode', async () => {
    const { c } = await setup();
    const ids = c.getState().analysis?.diagnostics.map((d) => d.ruleId) ?? [];
    expect(ids).toEqual(expect.arrayContaining(['hygiene/eqref', 'hygiene/display-dollars']));
    expect(
      c.visibleDiagnostics().every((d) => d.severity === 'error' || d.severity === 'warning'),
    ).toBe(true);
    c.setLearnMode(true);
    expect(c.visibleDiagnostics().length).toBe(c.getState().analysis?.diagnostics.length);
  });

  it('previews a fix as a diff and applies it only on request', async () => {
    const { c, editor } = await setup();
    const d = c.getState().analysis?.diagnostics.find((x) => x.ruleId === 'hygiene/eqref');
    const fix = d?.fixes[0];
    if (!fix) throw new Error('no fix');
    c.previewFix(fix);
    const preview = c.getState().preview;
    expect(
      preview?.hunks
        .flatMap((h) => h.lines)
        .some((l) => l.type === 'add' && l.text.includes('\\eqref{eq:a}')),
    ).toBe(true);
    expect(editor.text).toBe(DOC); // nothing applied yet
    await c.applyPreview();
    expect(editor.text).toContain('By Eq.~\\eqref{eq:a}');
    expect(c.getState().preview).toBeNull();
    expect(c.getState().notice).toMatch(/Undo/);
  });

  it('refuses stale previews instead of applying them to changed text', async () => {
    const { c, editor } = await setup();
    const fix = c
      .getState()
      .analysis?.diagnostics.find((x) => x.ruleId === 'hygiene/display-dollars')?.fixes[0];
    if (!fix) throw new Error('no fix');
    c.previewFix(fix);
    editor.type('% typing');
    await c.applyPreview();
    expect(c.getState().preview?.error).toMatch(/changed/);
    expect(editor.text).toContain('$$ y $$');
  });

  it('refuses fixes that would insert prose', async () => {
    const { c } = await setup();
    c.previewFix({
      title: 'evil',
      edits: [{ kind: 'mechanical', start: 0, end: 0, insert: 'We prove the Riemann hypothesis.' }],
    });
    expect(c.getState().preview).toBeNull();
    expect(c.getState().notice).toMatch(/refused/);
  });

  it('applies all fixes of a rule together', async () => {
    const { c, editor } = await setup();
    const all = c.getState().analysis?.diagnostics.filter((d) => d.fixes.length > 0) ?? [];
    c.previewAll(all);
    await c.applyPreview();
    expect(editor.text).toContain('\\eqref{eq:a}');
    expect(editor.text).toContain('\\[ y \\]');
  });

  it('remembers dismissals per project', async () => {
    const { c, storage } = await setup();
    const d = c.getState().analysis?.diagnostics[0];
    if (!d) throw new Error('no diagnostic');
    await c.dismiss(d.id);
    expect(c.getState().analysis?.diagnostics.some((x) => x.id === d.id)).toBe(false);
    expect(storage.dump()['local:doc:p1']).toMatchObject({ dismissed: [d.id] });
    await c.restoreDismissed();
    expect(c.getState().analysis?.diagnostics.some((x) => x.id === d.id)).toBe(true);
  });

  it('stores settings in the browser, or edits the magic comment via preview', async () => {
    const { c, storage } = await setup();
    await c.updateSettings({ mode: 'template' });
    expect(c.getState().analysis?.settings.mode).toBe('template');
    expect(storage.dump()['local:doc:p1']).toMatchObject({ settings: { mode: 'template' } });

    c.previewSettingsEdit();
    expect(c.getState().preview?.edits[0]).toMatchObject({ kind: 'settings', start: 0, end: 0 });
    await c.applyPreview();
    await vi.waitFor(() => {
      expect(c.getState().analysis?.settingsSource).toBe('magic-comment');
    });
    // Now changes go through the document.
    await c.updateSettings({ mode: 'freeform' });
    expect(c.getState().preview?.edits[0]?.insert).toContain('mode=freeform');
  });

  it('assigns roles and saves custom profiles', async () => {
    const { c } = await setup();
    const unit = c.getState().analysis?.structure.find((u) => u.kind === 'section');
    if (!unit) throw new Error('no section');
    await c.setRoles(unit, ['methods']);
    expect(c.getState().analysis?.structure.find((u) => u.key === unit.key)?.roles).toEqual([
      'methods',
    ]);
    const copy = await c.fork(defaultProfile(), 'QEC theory');
    expect(copy.id).toBe('custom/qec-theory');
    await c.updateSettings({ profileId: copy.id });
    expect(c.getState().analysis?.profile.name).toBe('QEC theory');
    await c.deleteProfile(copy.id);
    expect(c.getState().analysis?.profile.id).toBe('builtin/physics-article');
  });

  it('translates the compile log from the page or from a paste', async () => {
    const { c } = await setup();
    await c.readLog();
    expect(c.getState().log.entries[0]?.translation?.title).toBe('Unknown command \\foo');
    c.pasteLog("LaTeX Warning: Citation `x' on page 1 undefined on input line 3.");
    expect(c.getState().log).toMatchObject({ source: 'pasted' });
  });

  it('imports project files and analyses across them', async () => {
    const main = String.raw`\documentclass{article}
\begin{document}
\input{intro}
\end{document}
`;
    const { c } = await setup(main);
    await c.importFiles([
      { path: 'intro.tex', text: '\\section{Introduction}\nSee~\\ref{nowhere}.' },
    ]);
    const a = c.getState().analysis;
    expect(a?.scope).toBe('project');
    expect(
      a?.otherFiles.find((f) => f.path === 'intro.tex')?.diagnostics.map((d) => d.ruleId),
    ).toContain('hygiene/undefined-ref');
    await c.forgetFiles();
    expect(c.getState().files.map((f) => f.path)).toEqual(['main.tex']);
  });

  it('only uses AI after the user enables it, and falls back cleanly', async () => {
    const { c, llm } = await setup(
      DOC,
      fakeLlm({ availability: 'downloadable', explanation: 'Use \\eqref for equations.' }),
    );
    const d = c.getState().analysis?.diagnostics[0];
    if (!d) throw new Error('no diagnostic');
    await c.explain(d);
    expect(llm.calls).toEqual([]); // not enabled: nothing happens
    await c.enableAi();
    expect(c.getState().ai.availability).toBe('available');
    await c.explain(d);
    expect(c.getState().ai.explanations[d.id]).toEqual({
      text: 'Use \\eqref for equations.',
      busy: false,
      failure: null,
    });
  });

  it('drops AI output that drafts paper content', async () => {
    const { c } = await setup(
      DOC,
      fakeLlm({ availability: 'available', explanation: 'Here is a revised abstract: We study…' }),
    );
    const d = c.getState().analysis?.diagnostics[0];
    if (!d) throw new Error('no diagnostic');
    await c.explain(d);
    expect(c.getState().ai.explanations[d.id]).toMatchObject({ text: null, failure: 'drafted' });
  });

  it('answers topic questions from the notes, with or without the model', async () => {
    const { c, llm } = await setup();
    await c.askTopic('When should I use \\eqref?');
    expect(c.getState().ai.chat.at(-1)).toMatchObject({ status: 'notes-only', cardIds: ['eqref'] });
    expect(llm.calls).toEqual([]); // model not enabled
    await c.enableAi();
    await c.askTopic('When should I use \\eqref?');
    expect(c.getState().ai.chat).toHaveLength(2);
    expect(c.getState().ai.chat.at(-1)).toMatchObject({
      status: 'answered',
      text: 'Use \\eqref for equations.',
    });
  });

  it('sends each matching note whole, once', async () => {
    const { c, llm } = await setup(DOC, fakeLlm({ availability: 'available' }));
    await c.askTopic('When should I use \\eqref?');
    const notes = llm.topicInputs.at(-1)?.notes ?? [];
    expect(notes[0]?.text).toBe(findCard('eqref')?.body);
  });

  it('says why the model gave no answer', async () => {
    const { c } = await setup(
      DOC,
      fakeLlm({
        availability: 'available',
        topic: '{"onTopic":true,"answer":"Here is a revised abstract: We study…"}',
      }),
    );
    await c.askTopic('When should I use \\eqref?');
    expect(c.getState().ai.chat.at(-1)).toMatchObject({
      status: 'notes-only',
      failure: 'drafted',
      cardIds: ['eqref'],
    });
  });

  it('refuses to write paper text without asking the model', async () => {
    const { c, llm } = await setup(DOC, fakeLlm({ availability: 'available' }));
    await c.askTopic('Write my abstract');
    expect(c.getState().ai.chat.at(-1)?.status).toBe('refused');
    expect(llm.calls).toEqual([]);
  });

  it('passes on physics questions the model marks off-topic', async () => {
    const { c } = await setup(
      DOC,
      fakeLlm({ availability: 'available', topic: '{"onTopic":false,"answer":""}' }),
    );
    await c.askTopic('What is a density matrix?');
    expect(c.getState().ai.chat.at(-1)?.status).toBe('off-topic');
    c.clearChat();
    expect(c.getState().ai.chat).toEqual([]);
  });

  it('thinks while the model is slow, without flickering on quick work', async () => {
    let release: () => void = () => undefined;
    const slow = fakeLlm({ availability: 'available' });
    const askTopic = slow.askTopic.bind(slow);
    slow.askTopic = (input) =>
      new Promise((resolve) => {
        release = () => {
          resolve(askTopic(input));
        };
      });
    const { c } = await setup(DOC, slow);
    await vi.waitFor(() => {
      expect(c.getState().thinking).toBe(false);
    });
    const pending = c.askTopic('When should I use \\eqref?');
    expect(c.getState().thinking).toBe(false); // debounced
    await vi.waitFor(() => {
      expect(c.getState().thinking).toBe(true);
    });
    release();
    await pending;
    expect(c.getState().thinking).toBe(true); // held for a minimum time
    await vi.waitFor(
      () => {
        expect(c.getState().thinking).toBe(false);
      },
      { timeout: 2000 },
    );
  });

  it('reveals ranges in the editor', async () => {
    const { c, editor } = await setup();
    c.reveal(10, 20);
    expect(editor.revealed).toEqual([[10, 20]]);
  });
});
