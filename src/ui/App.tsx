import { Mascot } from './Mascot';

export function App() {
  return (
    <div className="panel">
      <header className="panel-header">
        <Mascot />
        <div>
          <h1>Lemma</h1>
          <p className="tagline">Structure-first LaTeX assistant</p>
        </div>
      </header>
      <main className="panel-body" aria-labelledby="status-heading">
        <h2 id="status-heading">Not reading your paper yet</h2>
        <p>
          This is an early build. The outline, checks and learning notes will appear here in later
          versions.
        </p>
        <p className="privacy-note">
          Your document stays in this browser. Lemma makes no network requests.
        </p>
      </main>
    </div>
  );
}
