import { useRef, type KeyboardEvent } from 'react';
import { ChecksView } from './components/ChecksView';
import { DiffPreview } from './components/DiffPreview';
import { LearnView } from './components/LearnView';
import { LogView } from './components/LogView';
import { NotationView } from './components/NotationView';
import { OutlineView } from './components/OutlineView';
import { SettingsView } from './components/SettingsView';
import { useController, usePanelState } from './context';
import type { Tab } from './controller/controller';
import { Mascot } from './Mascot';

const TABS: { id: Tab; label: string }[] = [
  { id: 'checks', label: 'Checks' },
  { id: 'outline', label: 'Outline' },
  { id: 'notation', label: 'Notation' },
  { id: 'learn', label: 'Learn' },
  { id: 'log', label: 'Log' },
  { id: 'settings', label: 'Settings' },
];

function Status() {
  const { editor, analysis, analyzing } = usePanelState();
  if (editor.state === 'connecting')
    return <p className="status">Connecting to the Overleaf editor…</p>;
  if (editor.state === 'unavailable') {
    return (
      <p className="status status-error" role="alert">
        Can’t read the Overleaf editor. {editor.reason}
      </p>
    );
  }
  return (
    <div className="status" aria-live="polite">
      <span>
        {editor.fileName ?? 'Open file'}
        {analyzing && <span className="muted"> · checking…</span>}
      </span>
      {analysis?.parseError && (
        <span className="status-error"> Lemma could not fully parse this file.</span>
      )}
      {analysis?.partial && (
        <details className="partial">
          <summary>Partial view</summary>
          <ul className="plain">
            {analysis.partialReasons.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

export function App() {
  const c = useController();
  const { tab, learnMode, notice } = usePanelState();
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const onTabKey = (e: KeyboardEvent, i: number) => {
    const next =
      e.key === 'ArrowRight'
        ? i + 1
        : e.key === 'ArrowLeft'
          ? i - 1
          : e.key === 'Home'
            ? 0
            : e.key === 'End'
              ? TABS.length - 1
              : null;
    if (next === null) return;
    e.preventDefault();
    const j = (next + TABS.length) % TABS.length;
    const t = TABS[j];
    if (t) c.setTab(t.id);
    tabRefs.current[j]?.focus();
  };

  return (
    <div className="panel">
      <header className="panel-header">
        <Mascot />
        <div className="title">
          <h1>Lemma</h1>
          <Status />
        </div>
        <div className="segmented" role="group" aria-label="Detail level">
          <button
            type="button"
            aria-pressed={!learnMode}
            title="Only errors and warnings"
            onClick={() => c.setLearnMode(false)}
          >
            Write
          </button>
          <button
            type="button"
            aria-pressed={learnMode}
            title="Also learning notes, with explanations expanded"
            onClick={() => c.setLearnMode(true)}
          >
            Learn
          </button>
        </div>
      </header>
      <nav className="tabs" role="tablist" aria-label="Lemma views">
        {TABS.map((t, i) => (
          <button
            key={t.id}
            ref={(el) => {
              tabRefs.current[i] = el;
            }}
            type="button"
            role="tab"
            id={`tab-${t.id}`}
            aria-selected={tab === t.id}
            aria-controls={`panel-${t.id}`}
            tabIndex={tab === t.id ? 0 : -1}
            onClick={() => c.setTab(t.id)}
            onKeyDown={(e) => onTabKey(e, i)}
          >
            {t.label}
          </button>
        ))}
      </nav>
      <main
        className="panel-body"
        role="tabpanel"
        id={`panel-${tab}`}
        aria-labelledby={`tab-${tab}`}
      >
        {tab === 'checks' && <ChecksView />}
        {tab === 'outline' && <OutlineView />}
        {tab === 'notation' && <NotationView />}
        {tab === 'learn' && <LearnView />}
        {tab === 'log' && <LogView />}
        {tab === 'settings' && <SettingsView />}
      </main>
      {notice && (
        <div className="toast" role="status">
          <span>{notice}</span>
          <button
            type="button"
            className="quiet"
            aria-label="Dismiss message"
            onClick={() => c.dismissNotice()}
          >
            ×
          </button>
        </div>
      )}
      <DiffPreview />
    </div>
  );
}
