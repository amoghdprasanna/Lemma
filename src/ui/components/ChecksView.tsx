import { useState } from 'react';
import { cardSummary, findCard } from '@/src/core/knowledge/cards';
import type { Diagnostic, Severity } from '@/src/core/rules/types';
import { useController, usePanelState } from '../context';
import { Icon, type IconName } from '../Icon';
import { InlineMarkdown } from '../markdown';
import { MascotAvatar } from '../Mascot';
import { Empty, Section, SEVERITY_LABEL } from './common';

const SEVERITY_ICON: Record<Severity, IconName> = {
  error: 'error',
  warning: 'warning',
  info: 'info',
  learn: 'book',
};

/**
 * One problem, as in an editor's Problems panel: severity, title and line on
 * one row, the message underneath, quick fixes always in reach. Expanding the
 * row shows why it matters and the less frequent actions.
 */
function DiagnosticItem({ d, openFile }: { d: Diagnostic; openFile: boolean }) {
  const c = useController();
  const { learnMode, ai } = usePanelState();
  const [open, setOpen] = useState<boolean | null>(null);
  const card = findCard(d.cardId);
  const explanation = ai.explanations[d.id];
  // Learn mode opens explanations by default; the row's own toggle wins.
  const expanded = open ?? learnMode;
  const detailId = `detail-${d.id}`;
  return (
    <li className="problem" data-severity={d.severity} data-open={expanded}>
      <div className="problem-row">
        <button
          type="button"
          className="problem-toggle"
          aria-expanded={expanded}
          aria-controls={detailId}
          onClick={() => setOpen(!expanded)}
        >
          <Icon name="chevron" className="chevron" />
          <Icon name={SEVERITY_ICON[d.severity]} className={`sev-icon sev-${d.severity}`} />
          <span className="sr-only">{SEVERITY_LABEL[d.severity]}: </span>
          <span className="problem-title">{d.title}</span>
        </button>
        {openFile ? (
          <button
            type="button"
            className="line-link"
            title="Go to this line in Overleaf"
            onClick={() => c.reveal(d.span.start, d.span.end)}
          >
            <span className="sr-only">Go to </span>Ln {d.line}
          </button>
        ) : (
          <span className="line-link">Ln {d.line}</span>
        )}
      </div>
      <p className="problem-message">{d.message}</p>
      {openFile && d.fixes.length > 0 && (
        <div className="quickfixes">
          {d.fixes.map((f, i) => (
            <button key={i} type="button" className="quickfix" onClick={() => c.previewFix(f)}>
              <Icon name="bulb" />
              {f.title}
            </button>
          ))}
        </div>
      )}
      {expanded && (
        <div className="problem-detail" id={detailId}>
          {card && (
            <div className="why">
              <p>
                <InlineMarkdown text={cardSummary(card)} />
              </p>
              {card.status === 'style-choice' && (
                <p className="muted">This is a style choice, not a hard rule.</p>
              )}
            </div>
          )}
          {explanation?.busy && (
            <p className="ai-text" aria-live="polite">
              <Icon name="sparkle" /> Thinking on this device…
            </p>
          )}
          {explanation && !explanation.busy && (
            <p className="ai-text">
              <Icon name="sparkle" />{' '}
              {explanation.text ??
                'No on-device explanation this time; the note above is the reference.'}
            </p>
          )}
          <div className="toolbar">
            {openFile && (
              <button
                type="button"
                className="tool"
                onClick={() => c.reveal(d.span.start, d.span.end)}
              >
                <Icon name="goto" /> Go to
              </button>
            )}
            <button type="button" className="tool" onClick={() => c.setTab('learn', d.cardId)}>
              <Icon name="book" /> Learn more
            </button>
            {ai.availability === 'available' && (
              <button type="button" className="tool" onClick={() => void c.explain(d)}>
                <Icon name="sparkle" /> Explain for my text
              </button>
            )}
            <button
              type="button"
              className="tool"
              onClick={() => void c.dismiss(d.id)}
              title="Hide this item for this document"
            >
              <Icon name="hide" /> Intentional
            </button>
          </div>
        </div>
      )}
    </li>
  );
}

type Filter = 'all' | 'error' | 'warning' | 'tips';

const FILTERS: { id: Filter; label: string; icon: IconName; match: (d: Diagnostic) => boolean }[] =
  [
    { id: 'all', label: 'All', icon: 'checks', match: () => true },
    { id: 'error', label: 'Errors', icon: 'error', match: (d) => d.severity === 'error' },
    { id: 'warning', label: 'Warnings', icon: 'warning', match: (d) => d.severity === 'warning' },
    {
      id: 'tips',
      label: 'Tips',
      icon: 'book',
      match: (d) => d.severity === 'info' || d.severity === 'learn',
    },
  ];

export function ChecksView() {
  const c = useController();
  const state = usePanelState();
  const [filter, setFilter] = useState<Filter>('all');
  const a = state.analysis;
  if (!a) return <Empty>Waiting for the document…</Empty>;
  const all = a.diagnostics;
  const visible = c.visibleDiagnostics();
  // Tips stay hidden until "Show tips" is on; choosing the Tips filter turns it on.
  const active = filter === 'tips' && !state.learnMode ? 'all' : filter;
  const shown = visible.filter(FILTERS.find((f) => f.id === active)?.match ?? (() => true));
  const byRule = new Map<string, Diagnostic[]>();
  for (const d of shown)
    if (d.fixes.length > 0) byRule.set(d.ruleId, [...(byRule.get(d.ruleId) ?? []), d]);
  const bulk = [...byRule.entries()].filter(([, ds]) => ds.length > 1);
  const file =
    state.editor.state === 'ready' ? (state.editor.fileName ?? 'this file') : 'this file';
  const serious = visible.filter((d) => d.severity === 'error' || d.severity === 'warning').length;

  return (
    <div className="checks">
      <div className="view-head">
        <h2 className="view-title" aria-live="polite">
          {serious === 0
            ? `${file} looks good`
            : `${String(serious)} ${serious === 1 ? 'thing' : 'things'} to look at`}
        </h2>
        <div className="filters" role="group" aria-label="Filter checks">
          {FILTERS.map((f) => {
            const n = all.filter(f.match).length;
            return (
              <button
                key={f.id}
                type="button"
                className="filter"
                aria-pressed={active === f.id}
                disabled={n === 0 && f.id !== 'all'}
                onClick={() => {
                  if (f.id === 'tips' && !state.learnMode) c.setLearnMode(true);
                  setFilter(f.id);
                }}
              >
                {f.id !== 'all' && (
                  <Icon name={f.icon} className={`sev-${f.id === 'tips' ? 'learn' : f.id}`} />
                )}
                {f.label}
                <span className="filter-count">{f.id === 'all' ? visible.length : n}</span>
              </button>
            );
          })}
        </div>
        {bulk.length > 0 && (
          <div className="quickfixes">
            {bulk.map(([rule, ds]) => (
              <button
                key={rule}
                type="button"
                className="quickfix"
                onClick={() => c.previewAll(ds)}
              >
                <Icon name="bulb" />
                Fix all {ds.length}: {ds[0]?.title}
              </button>
            ))}
          </div>
        )}
      </div>
      {shown.length === 0 && (
        <div className="all-clear">
          <MascotAvatar size={64} expression="happy" />
          <p className="all-clear-title">
            {active === 'all'
              ? 'All clear.'
              : `No ${FILTERS.find((f) => f.id === active)?.label.toLowerCase() ?? 'items'} here.`}
          </p>
          <p>
            {active === 'all'
              ? 'Lemma checks again as you type.'
              : 'Pick another filter to see the rest.'}
          </p>
        </div>
      )}
      <ul className="problems">
        {shown.map((d) => (
          <DiagnosticItem key={d.id} d={d} openFile />
        ))}
      </ul>
      {state.dismissed.length > 0 && (
        <p className="footnote">
          You marked {state.dismissed.length} {state.dismissed.length === 1 ? 'item' : 'items'} as
          intentional.{' '}
          <button type="button" className="link" onClick={() => void c.restoreDismissed()}>
            Show them again
          </button>
        </p>
      )}
      {a.otherFiles.length > 0 && (
        <Section title="In other files">
          <p className="muted">Open a file in Overleaf to go to these items and fix them.</p>
          {a.otherFiles.map((f) => {
            const ds = state.learnMode
              ? f.diagnostics
              : f.diagnostics.filter((d) => d.severity === 'error' || d.severity === 'warning');
            if (ds.length === 0) return null;
            return (
              <details key={f.path} className="file-group">
                <summary>
                  <Icon name="chevron" className="chevron" />
                  <Icon name="file" />
                  <span className="file-name">{f.path}</span>
                  <span className="count">{ds.length}</span>
                </summary>
                <ul className="problems">
                  {ds.map((d) => (
                    <DiagnosticItem key={d.id} d={d} openFile={false} />
                  ))}
                </ul>
              </details>
            );
          })}
        </Section>
      )}
    </div>
  );
}
