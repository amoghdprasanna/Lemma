import { useEffect, useRef, useState } from 'react';
import { CARDS, findCard, type Card, type CardStatus } from '@/src/core/knowledge/cards';
import { MAX_QUESTION } from '@/src/core/llm/prompts';
import { useController, usePanelState } from '../context';
import type { TopicState } from '../controller/controller';
import { Icon } from '../Icon';
import { Markdown } from '../markdown';
import { MascotAvatar } from '../Mascot';

const STATUS_LABEL: Record<CardStatus, string> = {
  rule: 'Convention',
  'style-choice': 'Style choice',
  reference: 'Reference',
};

const SUGGESTIONS = [
  'When should I use \\eqref?',
  'What goes in a PRL abstract?',
  'How do I write units with siunitx?',
  'Where should a figure label go?',
];

function CardLink({ card }: { card: Card }) {
  const c = useController();
  return (
    <button type="button" className="card-link" onClick={() => c.setTab('learn', card.id)}>
      <Icon name="book" />
      <span className="card-link-title">{card.title}</span>
      <span className={`badge status-${card.status}`}>{STATUS_LABEL[card.status]}</span>
    </button>
  );
}

function Answer({ turn, aiOn }: { turn: TopicState; aiOn: boolean }) {
  switch (turn.status) {
    case 'busy':
      return (
        <p className="typing" aria-label="Thinking on this device">
          <span />
          <span />
          <span />
        </p>
      );
    case 'answered':
      return (
        <>
          <p className="answer">{turn.text}</p>
          <p className="answer-note">
            <Icon name="sparkle" /> On-device AI can be wrong. The notes are the checked source.
          </p>
        </>
      );
    case 'off-topic':
      return (
        <p className="answer">
          That’s outside what I cover. I explain LaTeX and how papers are written, not the physics
          itself.
        </p>
      );
    case 'refused':
      return (
        <p className="answer">
          I don’t write or rewrite text for your paper. Ask me how something is usually done
          instead, for example “What goes in a PRL abstract?”
        </p>
      );
    case 'notes-only':
      return (
        <p className="answer">
          {turn.cardIds.length === 0
            ? 'I have no notes on that. Try other words.'
            : aiOn
              ? 'No on-device answer this time. These notes cover it:'
              : 'These notes cover it:'}
        </p>
      );
  }
}

/** Chat about LaTeX and paper writing, answered from the notes (ADR-0007). */
function Chat() {
  const c = useController();
  const { ai } = usePanelState();
  const [question, setQuestion] = useState('');
  const endRef = useRef<HTMLLIElement>(null);
  const aiOn = ai.availability === 'available';
  const canEnable = ai.availability === 'downloadable' || ai.availability === 'downloading';
  const busy = ai.chat.some((t) => t.status === 'busy');

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' });
  }, [ai.chat]);

  const ask = (q: string) => {
    if (q.trim() === '' || busy) return;
    void c.askTopic(q);
    setQuestion('');
  };

  return (
    <section className="chat" aria-label="Ask about LaTeX or paper writing">
      <ol className="thread">
        {ai.chat.length === 0 && (
          <li className="chat-empty">
            <MascotAvatar size={40} />
            <h2>Ask about LaTeX or paper writing</h2>
            <p>
              I answer from Lemma’s notes{aiOn ? ', with Chrome’s on-device AI' : ''}. I won’t write
              your paper or judge the physics.
            </p>
            <div className="suggestions">
              {SUGGESTIONS.map((s) => (
                <button key={s} type="button" className="suggestion" onClick={() => ask(s)}>
                  {s}
                </button>
              ))}
            </div>
          </li>
        )}
        {ai.chat.map((turn) => {
          const cards = turn.cardIds.map(findCard).filter((x): x is Card => x !== undefined);
          return (
            <li key={turn.id} className="turn">
              <div className="bubble bubble-user">
                <span className="sr-only">You asked: </span>
                {turn.question}
              </div>
              <div className="bubble bubble-lemma" aria-live="polite">
                <MascotAvatar size={22} />
                <div className="bubble-body">
                  <span className="sr-only">Lemma: </span>
                  <Answer turn={turn} aiOn={aiOn} />
                  {cards.length > 0 && turn.status !== 'busy' && turn.status !== 'refused' && (
                    <ul className="note-links">
                      {cards.map((card) => (
                        <li key={card.id}>
                          <CardLink card={card} />
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </li>
          );
        })}
        <li ref={endRef} className="thread-end" aria-hidden="true" />
      </ol>
      <div className="composer-wrap">
        <form
          className="composer"
          onSubmit={(e) => {
            e.preventDefault();
            ask(question);
          }}
        >
          <label className="composer-input">
            <span className="sr-only">Your question</span>
            <textarea
              rows={1}
              value={question}
              maxLength={MAX_QUESTION}
              placeholder="Ask about LaTeX or paper writing…"
              onChange={(e) => setQuestion(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                  e.preventDefault();
                  ask(question);
                }
              }}
            />
          </label>
          <button
            type="submit"
            className="send"
            aria-label="Ask"
            title="Ask (Enter)"
            disabled={busy || question.trim() === ''}
          >
            <Icon name="send" />
          </button>
        </form>
        <p className="composer-note">
          {aiOn ? (
            <>
              <Icon name="sparkle" /> On-device AI · nothing leaves this computer
            </>
          ) : canEnable ? (
            <>
              Notes only.{' '}
              <button type="button" className="link" onClick={() => c.setTab('settings')}>
                Turn on on-device AI
              </button>{' '}
              for written answers.
            </>
          ) : (
            'Notes only: Chrome’s on-device AI isn’t available here.'
          )}
          {ai.chat.length > 0 && (
            <button type="button" className="link clear-chat" onClick={() => c.clearChat()}>
              Clear
            </button>
          )}
        </p>
      </div>
    </section>
  );
}

function NotesList() {
  const [query, setQuery] = useState('');
  const q = query.trim().toLowerCase();
  const list = CARDS.filter((x) => q === '' || `${x.title} ${x.body}`.toLowerCase().includes(q));
  return (
    <div className="notes">
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
            <CardLink card={x} />
          </li>
        ))}
      </ul>
      {list.length === 0 && <p className="empty">No notes match “{query}”.</p>}
    </div>
  );
}

export function LearnView() {
  const c = useController();
  const { focusCard } = usePanelState();
  const [view, setView] = useState<'ask' | 'notes'>('ask');
  const headingRef = useRef<HTMLHeadingElement>(null);
  const card = focusCard ? findCard(focusCard) : undefined;

  useEffect(() => {
    if (card) headingRef.current?.focus();
  }, [card]);

  if (card) {
    return (
      <article className="card">
        <button type="button" className="back" onClick={() => c.setTab('learn', null)}>
          <Icon name="chevron" className="chevron-back" /> All notes
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

  return (
    <div className="learn" data-view={view}>
      <div className="subtabs" role="group" aria-label="Learn">
        <button type="button" aria-pressed={view === 'ask'} onClick={() => setView('ask')}>
          <Icon name="sparkle" /> Ask Lemma
        </button>
        <button type="button" aria-pressed={view === 'notes'} onClick={() => setView('notes')}>
          <Icon name="book" /> Notes <span className="count">{CARDS.length}</span>
        </button>
      </div>
      {view === 'ask' ? <Chat /> : <NotesList />}
    </div>
  );
}
