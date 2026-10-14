import { useState } from 'react';
import { useController, usePanelState } from '../context';
import { Empty } from './common';

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
          Read log from Overleaf
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
      <ul className="diags">
        {log.entries.map((e, i) => {
          const explanation = ai.explanations[`log:${String(i)}`];
          return (
            <li
              key={i}
              className={`diag diag-${e.level === 'error' ? 'error' : e.level === 'warning' ? 'warning' : 'info'}`}
            >
              <div className="diag-head">
                <span
                  className={`badge badge-${e.level === 'error' ? 'error' : e.level === 'warning' ? 'warning' : 'info'}`}
                >
                  {e.level === 'typesetting' ? 'Layout' : e.level === 'error' ? 'Error' : 'Warning'}
                </span>
                <span className="diag-title">{e.translation?.title ?? 'Unrecognised message'}</span>
                {e.line !== null && (
                  <span className="muted">
                    {e.file ?? ''} line {e.line}
                  </span>
                )}
              </div>
              {e.translation && (
                <p className="diag-message">
                  {e.translation.explanation} <strong>Likely cause:</strong> {e.translation.cause}
                </p>
              )}
              <pre className="raw">{e.raw}</pre>
              {explanation && (
                <p className="ai-text">
                  {explanation.busy
                    ? 'Thinking on this device…'
                    : (explanation.text ?? 'No on-device explanation this time.')}
                </p>
              )}
              <div className="actions">
                <button type="button" onClick={() => c.setTab('learn', 'compile-errors')}>
                  Reading logs
                </button>
                {ai.availability === 'available' && (
                  <button type="button" onClick={() => void c.explainLogEntry(i)}>
                    Explain on-device
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
