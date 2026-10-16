import { useState } from 'react';
import { useController, usePanelState } from '../context';
import { Icon } from '../Icon';
import { aiFailureText, Empty } from './common';

export function LogView() {
  const c = useController();
  const { log, ai } = usePanelState();
  const [pasted, setPasted] = useState('');
  return (
    <div>
      <p className="summary">
        Lemma reads the compile log Overleaf already shows (no extra requests) and explains it.
      </p>
      <div className="actions">
        <button type="button" className="primary" onClick={() => void c.readLog()}>
          <Icon name="log" /> Read log from Overleaf
        </button>
      </div>
      {log.error && (
        <p className="hint" role="status">
          {log.error}
        </p>
      )}
      <details>
        <summary>Paste a log instead</summary>
        <label>
          <span className="sr-only">Compile log</span>
          <textarea
            rows={6}
            value={pasted}
            onChange={(e) => setPasted(e.target.value)}
            placeholder="Paste the raw log here"
          />
        </label>
        <button type="button" disabled={pasted.trim() === ''} onClick={() => c.pasteLog(pasted)}>
          Explain pasted log
        </button>
      </details>
      {log.source && log.entries.length === 0 && <Empty>No errors or warnings in this log.</Empty>}
      <ul className="problems">
        {log.entries.map((e, i) => {
          const explanation = ai.explanations[`log:${String(i)}`];
          const sev = e.level === 'error' ? 'error' : e.level === 'warning' ? 'warning' : 'info';
          return (
            <li key={i} className="problem" data-severity={sev} data-open="true">
              <div className="problem-row">
                <span className="problem-toggle">
                  <Icon name={sev} className={`sev-icon sev-${sev}`} />
                  <span className="sr-only">
                    {e.level === 'typesetting'
                      ? 'Layout'
                      : e.level === 'error'
                        ? 'Error'
                        : 'Warning'}
                    :{' '}
                  </span>
                  <span className="problem-title">
                    {e.translation?.title ?? 'Unrecognised message'}
                  </span>
                </span>
                {e.line !== null && (
                  <span className="line-link">
                    {e.file ? `${e.file}:` : 'Ln '}
                    {e.line}
                  </span>
                )}
              </div>
              {e.translation && (
                <p className="problem-message">
                  {e.translation.explanation} <strong>Likely cause:</strong> {e.translation.cause}
                </p>
              )}
              <pre className="raw">{e.raw}</pre>
              {explanation && (
                <p className="ai-text">
                  <Icon name="sparkle" />{' '}
                  {explanation.busy
                    ? 'Thinking…'
                    : (explanation.text ?? aiFailureText(explanation.failure))}
                </p>
              )}
              <div className="toolbar">
                <button
                  type="button"
                  className="tool"
                  onClick={() => c.setTab('learn', 'compile-errors')}
                >
                  <Icon name="book" /> Reading logs
                </button>
                {ai.availability === 'available' && ai.documentText && (
                  <button type="button" className="tool" onClick={() => void c.explainLogEntry(i)}>
                    <Icon name="sparkle" /> Explain with AI
                  </button>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
