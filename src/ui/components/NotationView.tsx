import { usePanelState, useController } from '../context';
import { Empty, Section } from './common';

/** Everything the paper defines, at a glance: the author's own conventions. */
export function NotationView() {
  const c = useController();
  const { analysis: a } = usePanelState();
  if (!a) return <Empty>Waiting for the document…</Empty>;
  const n = a.notation;
  const traceForms = Object.entries(n.traceForms);
  return (
    <div>
      <p className="summary">
        Your paper’s notation, collected from the text. Lemma only lists what you wrote.
      </p>
      <Section title="Symbols introduced in the text">
        {n.symbols.length === 0 ? (
          <Empty>No “where $X$ is …” style introductions found yet.</Empty>
        ) : (
          <dl className="sheet">
            {n.symbols.map((s) => (
              <div key={s.symbol}>
                <dt>
                  <code className="math">{s.symbol}</code>
                </dt>
                <dd>
                  {s.context} <span className="muted">line {s.line}</span>
                </dd>
              </div>
            ))}
          </dl>
        )}
      </Section>
      <Section title="Acronyms">
        {n.acronyms.length === 0 ? (
          <Empty>No acronyms found.</Empty>
        ) : (
          <dl className="sheet">
            {n.acronyms.map((x) => (
              <div key={x.acronym}>
                <dt>{x.acronym}</dt>
                <dd>
                  {x.expansion ?? (
                    <em>not spelled out{x.known ? ` (usually “${x.known}”)` : ''}</em>
                  )}{' '}
                  <span className="muted">
                    {x.uses} use{x.uses === 1 ? '' : 's'}, line {x.line}
                  </span>
                </dd>
              </div>
            ))}
          </dl>
        )}
      </Section>
      <Section title="Macros you define">
        {n.macros.length === 0 ? (
          <Empty>No \newcommand or \DeclareMathOperator definitions.</Empty>
        ) : (
          <dl className="sheet">
            {n.macros.map((m) => (
              <div key={m.name}>
                <dt>
                  <code>\{m.name}</code>
                </dt>
                <dd>
                  {m.body !== null ? (
                    <code>{m.body}</code>
                  ) : (
                    <span className="muted">(complex definition)</span>
                  )}{' '}
                  <span className="muted">line {m.line}</span>
                </dd>
              </div>
            ))}
          </dl>
        )}
      </Section>
      <Section title="Conventions">
        <ul className="plain">
          <li>
            Kets: {n.kets.macro} with macros, {n.kets.manual} by hand
            {n.kets.macro > 0 && n.kets.manual > 0 && ' (mixed)'}{' '}
            <button
              type="button"
              className="link"
              onClick={() => c.setTab('learn', 'ket-notation')}
            >
              about
            </button>
          </li>
          <li>
            Trace:{' '}
            {traceForms.length === 0
              ? 'not used'
              : traceForms.map(([f, k]) => `${f} ×${String(k)}`).join(', ')}{' '}
            <button
              type="button"
              className="link"
              onClick={() => c.setTab('learn', 'trace-notation')}
            >
              about
            </button>
          </li>
          <li>
            Adjoint/conjugate: ^\dagger ×{n.adjoint.dagger}, ^* ×{n.adjoint.star}{' '}
            <button
              type="button"
              className="link"
              onClick={() => c.setTab('learn', 'dagger-vs-star')}
            >
              about
            </button>
          </li>
          <li>Packages: {n.packages.length === 0 ? 'none' : n.packages.join(', ')}</li>
        </ul>
      </Section>
    </div>
  );
}
