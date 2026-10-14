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
import { Icon, type IconName } from './Icon';
import { Mascot } from './Mascot';

const TABS: { id: Tab; label: string; icon: IconName }[] = [
  { id: 'checks', label: 'Checks', icon: 'checks' },
  { id: 'outline', label: 'Outline', icon: 'outline' },
  { id: 'notation', label: 'Notation', icon: 'notation' },
  { id: 'learn', label: 'Learn', icon: 'learn' },
  { id: 'log', label: 'Log', icon: 'log' },
  { id: 'settings', label: 'Settings', icon: 'settings' },
];

/** Editor connection and parse problems, shown as a strip under the tabs. */
function Notices() {
  const { editor, analysis } = usePanelState();
  if (editor.state === 'connecting')
    return <p className="notice">Connecting to the Overleaf editor…</p>;
  if (editor.state === 'unavailable') {
    return (
      <p className="notice notice-error" role="alert">
        <Icon name="error" /> Can’t read the Overleaf editor. {editor.reason}
      </p>
    );
  }
  if (!analysis?.parseError && !analysis?.partial) return null;
  return (
    <div className="notice notice-warning">
      {analysis.parseError && (
        <p>
          <Icon name="warning" /> Lemma could not fully parse this file.
        </p>
      )}
      {analysis.partial && (
        <details className="partial">
          <summary>Partial view: some project files are missing</summary>
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

/** Bottom bar, as in an editor: checking state, problem counts, AI state. */
function StatusBar() {
  const c = useController();
  const { analyzing, analysis, ai, editor } = usePanelState();
  const all = analysis?.diagnostics ?? [];
  const errors = all.filter((d) => d.severity === 'error').length;
  const warnings = all.filter((d) => d.severity === 'warning').length;
  return (
    <footer className="statusbar">
      <span className="status-item" aria-live="polite">
        {editor.state !== 'ready' ? (
          'Not connected'
        ) : analyzing ? (
          <>
            <span className="spinner" aria-hidden="true" /> Checking…
          </>
        ) : (
          <>
            <Icon name="check" /> Up to date
          </>
        )}
      </span>
      <button
        type="button"
        className="status-item"
        title="Show checks"
        onClick={() => c.setTab('checks')}
      >
        <Icon name="error" className="sev-error" />
        <span aria-hidden="true">{errors}</span>
        <Icon name="warning" className="sev-warning" />
        <span aria-hidden="true">{warnings}</span>
        <span className="sr-only">
          {errors} errors, {warnings} warnings
        </span>
      </button>
      <span className="statusbar-spacer" />
      <button
        type="button"
        className="status-item"
        title="On-device AI settings"
        onClick={() => c.setTab('settings')}
      >
        <Icon name="sparkle" />
        {ai.availability === 'available' ? 'AI on' : 'AI off'}
      </button>
    </footer>
  );
}

export function App() {
  const c = useController();
  const { tab, learnMode, notice, editor, analysis } = usePanelState();
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const problems = c.visibleDiagnostics().length;

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
      <header className="titlebar">
        <Mascot />
        <div className="titlebar-text">
          <h1>Lemma</h1>
          <p className="crumb">
            <Icon name="file" />
            <span className="crumb-file">
              {editor.state === 'ready' ? (editor.fileName ?? 'Open file') : 'No document'}
            </span>
            {analysis?.scope === 'project' && <span className="crumb-scope">project</span>}
          </p>
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
            title={t.label}
            onClick={() => c.setTab(t.id)}
            onKeyDown={(e) => onTabKey(e, i)}
          >
            <Icon name={t.icon} />
            <span className="tab-label">{t.label}</span>
            {t.id === 'checks' && problems > 0 && <span className="count">{problems}</span>}
          </button>
        ))}
      </nav>
      <Notices />
      <main
        className="panel-body"
        role="tabpanel"
        id={`panel-${tab}`}
        aria-labelledby={`tab-${tab}`}
        data-tab={tab}
      >
        {tab === 'checks' && <ChecksView />}
        {tab === 'outline' && <OutlineView />}
        {tab === 'notation' && <NotationView />}
        {tab === 'learn' && <LearnView />}
        {tab === 'log' && <LogView />}
        {tab === 'settings' && <SettingsView />}
      </main>
      <StatusBar />
      {notice && (
        <div className="toast" role="status">
          <span>{notice}</span>
          <button
            type="button"
            className="icon-button"
            aria-label="Dismiss message"
            onClick={() => c.dismissNotice()}
          >
            <Icon name="close" />
          </button>
        </div>
      )}
      <DiffPreview />
    </div>
  );
}
