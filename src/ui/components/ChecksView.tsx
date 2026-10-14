import { useState } from 'react';
import { cardSummary, findCard } from '@/src/core/knowledge/cards';
import type { Diagnostic, Severity } from '@/src/core/rules/types';
import { useController, usePanelState } from '../context';
import { Icon, type IconName } from '../Icon';
import { InlineMarkdown } from '../markdown';
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
    <div className="checks">
      <div className="view-head">
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
      {visible.length === 0 && (
        <div className="all-clear">
          <Icon name="check" />
          <p>No errors or warnings in this file.</p>
        </div>
      )}
      <ul className="problems">
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
