import { useState } from 'react';
import { cardSummary, findCard } from '@/src/core/knowledge/cards';
import type { Diagnostic } from '@/src/core/rules/types';
import { useController, usePanelState } from '../context';
import { Empty, Section, SeverityBadge } from './common';

function DiagnosticItem({ d, openFile }: { d: Diagnostic; openFile: boolean }) {
  const c = useController();
  const { learnMode, ai } = usePanelState();
  const [expanded, setExpanded] = useState(false);
  const card = findCard(d.cardId);
  const explanation = ai.explanations[d.id];
  const showWhy = expanded || learnMode;
  return (
    <li className={`diag diag-${d.severity}`}>
      <div className="diag-head">
        <SeverityBadge severity={d.severity} />
        <span className="diag-title">{d.title}</span>
        <span className="muted">line {d.line}</span>
      </div>
      <p className="diag-message">{d.message}</p>
      {showWhy && card && (
        <div className="why">
          <p>{cardSummary(card)}</p>
          {card.status === 'style-choice' && (
            <p className="muted">This is a style choice, not a hard rule.</p>
          )}
          {explanation?.busy && (
            <p className="muted" aria-live="polite">
              Thinking on this device…
            </p>
          )}
          {explanation && !explanation.busy && (
            <p className="ai-text">
              {explanation.text ??
                'No on-device explanation this time; the note above is the reference.'}
            </p>
          )}
        </div>
      )}
      <div className="actions">
        {openFile && (
          <button type="button" onClick={() => c.reveal(d.span.start, d.span.end)}>
            Go to
          </button>
        )}
        {openFile &&
          d.fixes.map((f, i) => (
            <button key={i} type="button" className="primary" onClick={() => c.previewFix(f)}>
              {f.title}
            </button>
          ))}
        <button type="button" aria-expanded={showWhy} onClick={() => setExpanded(!expanded)}>
          Why?
        </button>
        <button type="button" onClick={() => c.setTab('learn', d.cardId)}>
          Learn more
        </button>
        {ai.availability === 'available' && (
          <button
            type="button"
            onClick={() => {
              setExpanded(true);
              void c.explain(d);
            }}
          >
            Explain for my text
          </button>
        )}
        <button
          type="button"
          className="quiet"
          onClick={() => void c.dismiss(d.id)}
          title="Hide this item for this document"
        >
          Intentional
        </button>
      </div>
    </li>
  );
}

export function ChecksView() {
  const c = useController();
  const state = usePanelState();
  const a = state.analysis;
  if (!a) return <Empty>Waiting for the document…</Empty>;
  const visible = c.visibleDiagnostics();
  const hidden = a.diagnostics.length - visible.length;
  const byRule = new Map<string, Diagnostic[]>();
  for (const d of visible)
    if (d.fixes.length > 0) byRule.set(d.ruleId, [...(byRule.get(d.ruleId) ?? []), d]);
  const bulk = [...byRule.entries()].filter(([, ds]) => ds.length > 1);

  return (
    <div>
      <p className="summary" aria-live="polite">
        {visible.length === 0
          ? 'Nothing to fix here.'
          : `${String(visible.length)} item${visible.length === 1 ? '' : 's'}`}
        {hidden > 0 &&
          !state.learnMode &&
          ` · ${String(hidden)} learning note${hidden === 1 ? '' : 's'} hidden in Write mode`}
        {state.dismissed.length > 0 && (
          <>
            {' · '}
            <button type="button" className="link" onClick={() => void c.restoreDismissed()}>
              show {state.dismissed.length} dismissed
            </button>
          </>
        )}
      </p>
      {bulk.length > 0 && (
        <div className="actions bulk">
          {bulk.map(([rule, ds]) => (
            <button key={rule} type="button" onClick={() => c.previewAll(ds)}>
              Fix all {ds.length}: {ds[0]?.title}
            </button>
          ))}
        </div>
      )}
      <ul className="diags">
        {visible.map((d) => (
          <DiagnosticItem key={d.id} d={d} openFile />
        ))}
      </ul>
      {a.otherFiles.length > 0 && (
        <Section title="In other files">
          <p className="muted">Open a file in Overleaf to go to these items and fix them.</p>
          {a.otherFiles.map((f) => {
            const ds = state.learnMode
              ? f.diagnostics
              : f.diagnostics.filter((d) => d.severity === 'error' || d.severity === 'warning');
            if (ds.length === 0) return null;
            return (
              <details key={f.path}>
                <summary>
                  {f.path} ({ds.length})
                </summary>
                <ul className="diags">
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
