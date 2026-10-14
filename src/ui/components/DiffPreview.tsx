import { useEffect, useRef, type ReactNode } from 'react';
import type { DiffLine } from '@/src/core/fixes/diff';
import { useController, usePanelState } from '../context';

/** For a removed/added pair, marks the part that differs so short changes in long lines stand out. */
function highlight(line: DiffLine, partner: DiffLine | undefined): ReactNode {
  if (!partner || line.text === '' || partner.text === '') return line.text || ' ';
  const a = line.text;
  const b = partner.text;
  let head = 0;
  while (head < a.length && head < b.length && a[head] === b[head]) head++;
  let tail = 0;
  while (
    tail < a.length - head &&
    tail < b.length - head &&
    a[a.length - 1 - tail] === b[b.length - 1 - tail]
  )
    tail++;
  return (
    <>
      {a.slice(0, head)}
      <mark>{a.slice(head, a.length - tail)}</mark>
      {a.slice(a.length - tail)}
    </>
  );
}

/** Modal diff preview. The document only changes when the user presses Apply. */
export function DiffPreview() {
  const c = useController();
  const { preview, applying } = usePanelState();
  const applyRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!preview) return;
    applyRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') c.closePreview();
      if (e.key === 'Tab' && dialogRef.current) {
        const focusable = dialogRef.current.querySelectorAll<HTMLElement>('button');
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
    };
  }, [preview, c]);

  if (!preview) return null;
  return (
    <div className="overlay">
      <div
        ref={dialogRef}
        className="dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="preview-title"
      >
        <h2 id="preview-title">{preview.title}</h2>
        <p className="muted">
          Review the change. It is applied as one step you can undo in Overleaf.
        </p>
        <div className="diff" role="group" aria-label="Proposed change">
          {preview.hunks.map((h, i) => {
            const removed = h.lines.filter((l) => l.type === 'remove');
            const added = h.lines.filter((l) => l.type === 'add');
            const pair = (l: DiffLine) =>
              removed.length === added.length
                ? l.type === 'remove'
                  ? added[removed.indexOf(l)]
                  : l.type === 'add'
                    ? removed[added.indexOf(l)]
                    : undefined
                : undefined;
            return (
              <div className="hunk" key={i}>
                {h.lines.map((l, j) => (
                  <div key={j} className={`diff-line diff-${l.type}`}>
                    <span className="diff-num" aria-hidden="true">
                      {l.line}
                    </span>
                    <span className="diff-mark">
                      {l.type === 'add' ? '+' : l.type === 'remove' ? '−' : ' '}
                    </span>
                    <span className="sr-only">
                      {l.type === 'add' ? 'added: ' : l.type === 'remove' ? 'removed: ' : ''}
                    </span>
                    <code>{highlight(l, pair(l))}</code>
                  </div>
                ))}
              </div>
            );
          })}
        </div>
        {preview.error && (
          <p className="error" role="alert">
            {preview.error}
          </p>
        )}
        <div className="dialog-actions">
          <button type="button" onClick={() => c.closePreview()}>
            Cancel
          </button>
          <button
            ref={applyRef}
            type="button"
            className="primary"
            disabled={applying}
            onClick={() => void c.applyPreview()}
          >
            {applying ? 'Applying…' : 'Apply'}
          </button>
        </div>
      </div>
    </div>
  );
}
