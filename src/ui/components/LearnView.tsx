import { useEffect, useRef, useState } from 'react';
import { CARDS, findCard, type CardStatus } from '@/src/core/knowledge/cards';
import { useController, usePanelState } from '../context';
import { Markdown } from '../markdown';

const STATUS_LABEL: Record<CardStatus, string> = {
  rule: 'Convention',
  'style-choice': 'Style choice',
  reference: 'Reference',
};

export function LearnView() {
  const c = useController();
  const { focusCard } = usePanelState();
  const [query, setQuery] = useState('');
  const headingRef = useRef<HTMLHeadingElement>(null);
  const card = focusCard ? findCard(focusCard) : undefined;

  useEffect(() => {
    if (card) headingRef.current?.focus();
  }, [card]);

  if (card) {
    return (
      <article className="card">
        <button type="button" className="link" onClick={() => c.setTab('learn', null)}>
          ← All notes
        </button>
        <h2 ref={headingRef} tabIndex={-1}>
          {card.title}
        </h2>
        <span className={`badge status-${card.status}`}>{STATUS_LABEL[card.status]}</span>
        <Markdown source={card.body} />
        <h3>Sources</h3>
        <ul className="sources">
          {card.sources.map((s) => (
            <li key={s.url}>
              <a href={s.url} target="_blank" rel="noreferrer noopener">
                {s.title}
              </a>
            </li>
          ))}
        </ul>
      </article>
    );
  }

  const q = query.trim().toLowerCase();
  const list = CARDS.filter((x) => q === '' || `${x.title} ${x.body}`.toLowerCase().includes(q));
  return (
    <div>
      <label className="search">
        <span className="sr-only">Search notes</span>
        <input
          type="search"
          placeholder="Search notes"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </label>
      <ul className="cards">
        {list.map((x) => (
          <li key={x.id}>
            <button type="button" className="card-link" onClick={() => c.setTab('learn', x.id)}>
              <span>{x.title}</span>
              <span className={`badge status-${x.status}`}>{STATUS_LABEL[x.status]}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
