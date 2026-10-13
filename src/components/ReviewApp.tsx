import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { normaliseOutput } from '../lib/quiz/scoring';
import { rateCard, addCustomCard } from '../lib/srs/apply';
import { previewIntervals, type RatingValue } from '../lib/srs/fsrs';
import {
  buildQueue,
  customCards,
  unlockedLessons,
  type ContentCard,
  type QueueItem,
} from '../lib/srs/queue';
import { load, subscribe, type LearnerData } from '../lib/store/store';
import { url } from '../lib/url';

const RATINGS: { value: RatingValue; label: string }[] = [
  { value: 1, label: 'Again' },
  { value: 2, label: 'Hard' },
  { value: 3, label: 'Good' },
  { value: 4, label: 'Easy' },
];

/** A card rated Again or in a short learning step comes back in this session if due this soon. */
const SESSION_WINDOW_MS = 20 * 60 * 1000;

function intervalText(days: number): string {
  if (days <= 0) return 'soon';
  return days === 1 ? '1 day' : `${days} days`;
}

interface CardViewProps {
  item: QueueItem;
  now: Date;
  scheduled: boolean;
  shortcuts: boolean;
  onRate(rating: RatingValue): void;
}

function CardView({ item, now, scheduled, shortcuts, onRate }: CardViewProps) {
  const [revealed, setRevealed] = useState(false);
  const [answer, setAnswer] = useState('');
  const group = useRef<HTMLDivElement>(null);
  const previews = useMemo(() => previewIntervals(item.schedule, now), [item, now]);

  useEffect(() => {
    if (revealed)
      group.current?.querySelector<HTMLButtonElement>('button[data-rating="3"]')?.focus();
  }, [revealed]);

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (!shortcuts) return;
    const n = Number(e.key);
    if (n >= 1 && n <= 4) {
      e.preventDefault();
      onRate(n as RatingValue);
    }
  };

  const predictOk =
    item.type === 'predict' && revealed
      ? normaliseOutput(answer) === normaliseOutput(item.expected ?? '')
      : null;

  return (
    <article
      className="athena-question"
      data-card={item.id}
      data-type={item.type}
      aria-label="Review card"
    >
      <p>
        <small>
          {item.isNew ? 'New card' : 'Review'} · {item.type}
          {item.custom ? ' · your card' : ''}
        </small>
      </p>

      {item.type === 'predict' ? (
        <pre aria-label="Code">
          <code>{item.front}</code>
        </pre>
      ) : (
        <p data-testid="card-front">{item.front}</p>
      )}

      {(item.type === 'predict' || item.type === 'explain') && (
        <label>
          {item.type === 'predict' ? 'Expected output' : 'Your answer, in your own words'}
          <br />
          <textarea
            rows={3}
            cols={50}
            value={answer}
            disabled={revealed}
            onChange={(e) => setAnswer(e.target.value)}
            spellCheck={false}
          />
        </label>
      )}

      {!revealed && (
        <p>
          <button type="button" onClick={() => setRevealed(true)} data-testid="show-answer">
            {item.type === 'predict' ? 'Check my answer' : 'Show answer'}
          </button>
        </p>
      )}

      {revealed && (
        <div data-testid="card-back">
          {item.type === 'predict' && (
            <p data-correct={predictOk}>
              <strong>{predictOk ? 'Correct.' : 'Not quite.'}</strong> Output:{' '}
              <code>{item.expected}</code>
            </p>
          )}
          <p>{item.back}</p>
          {scheduled ? (
            <div
              ref={group}
              role="group"
              aria-label="Rate how well you remembered"
              onKeyDown={onKeyDown}
              data-testid="rating-group"
            >
              {RATINGS.map((r) => (
                <button
                  key={r.value}
                  type="button"
                  data-rating={r.value}
                  onClick={() => onRate(r.value)}
                  style={{ marginInlineEnd: '0.5rem' }}
                >
                  {r.label}
                  {shortcuts ? ` (${r.value})` : ''}
                  <br />
                  <small>{intervalText(previews[r.value].days)}</small>
                </button>
              ))}
            </div>
          ) : (
            <p>
              <button type="button" onClick={() => onRate(3)} data-testid="next-practice">
                Next card
              </button>
            </p>
          )}
        </div>
      )}
    </article>
  );
}

export function ReviewApp() {
  const [content, setContent] = useState<ContentCard[] | null>(null);
  const [data, setData] = useState<LearnerData | null>(null);
  const [corrupt, setCorrupt] = useState(false);
  const [queue, setQueue] = useState<QueueItem[] | null>(null);
  const [practice, setPractice] = useState<QueueItem[] | null>(null);
  const [reviewedNow, setReviewedNow] = useState(0);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const nowRef = useRef(new Date());

  const lessonOf = useMemo(() => {
    const map = new Map((content ?? []).map((c) => [c.id, c.lesson]));
    return (id: string) => map.get(id);
  }, [content]);

  const refresh = useCallback(() => {
    const stored = load(window.localStorage);
    if (stored.status === 'corrupt') {
      setCorrupt(true);
      return;
    }
    setCorrupt(false);
    if (stored.status === 'ok') setData(stored.data);
    else setData(null);
  }, []);

  useEffect(() => {
    refresh();
    fetch(url('data/cards.json'))
      .then(async (r) => {
        if (!r.ok) throw new Error('Could not load the cards.');
        return (await r.json()) as ContentCard[];
      })
      .then(setContent)
      .catch((e: unknown) =>
        setError(e instanceof Error ? e.message : 'Could not load the cards.'),
      );
    return subscribe(window, refresh);
  }, [refresh]);

  // Build the session once, when the cards and the learner data are both ready.
  const built = useMemo(() => {
    if (!content) return null;
    const stored = load(window.localStorage);
    const d = stored.status === 'ok' ? stored.data : null;
    if (!d) return { empty: true as const };
    return {
      empty: false as const,
      ...buildQueue({ content, data: d, now: nowRef.current }),
      data: d,
    };
  }, [content, data]);

  useEffect(() => {
    if (built && !built.empty && queue === null) setQueue(built.queue);
    if (built && built.empty && queue === null) setQueue([]);
  }, [built, queue]);

  if (error) return <p role="alert">{error}</p>;
  if (corrupt) {
    return (
      <p role="alert">
        Your saved data could not be read. Open <a href={url('settings/')}>Settings</a> to recover
        it.
      </p>
    );
  }
  if (!content || queue === null) return <p>Loading your review session…</p>;

  const settings = data?.settings;
  const shortcuts = settings?.shortcutsEnabled ?? true;

  const rate = (item: QueueItem, rating: RatingValue) => {
    const now = new Date();
    nowRef.current = now;
    try {
      const next = rateCard(window.localStorage, now, item, rating, lessonOf);
      setData(next);
      const state = next.cards[item.id]?.state;
      setQueue((q) => {
        const rest = (q ?? []).filter((c) => c.id !== item.id);
        if (state && new Date(state.due).getTime() - now.getTime() <= SESSION_WINDOW_MS) {
          return [...rest, { ...item, isNew: false, schedule: state }];
        }
        return rest;
      });
      setReviewedNow((n) => n + 1);
      setMessage('');
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Could not save your rating.');
    }
  };

  const startPractice = () => {
    if (!data) return;
    const unlocked = unlockedLessons(data);
    const extra: QueueItem[] = [
      ...content.filter((c) => unlocked.has(c.lesson)),
      ...customCards(data),
    ]
      .filter((c) => data.cards[c.id] && data.cards[c.id]?.state.state !== 'new')
      .map((c) => ({
        ...c,
        isNew: false,
        custom: c.lesson === 'custom',
        schedule: (data.cards[c.id] as NonNullable<LearnerData['cards'][string]>).state,
      }));
    setPractice(extra);
  };

  const onAddCard = (form: HTMLFormElement) => {
    const f = new FormData(form);
    const front = String(f.get('front') ?? '').trim();
    const back = String(f.get('back') ?? '').trim();
    if (!front || !back) {
      setMessage('A card needs a front and a back.');
      return;
    }
    const competencies = String(f.get('competencies') ?? '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    try {
      addCustomCard(window.localStorage, new Date(), { front, back, competencies });
      form.reset();
      setMessage('Card added. It is due now.');
      setQueue(null);
      refresh();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Could not add the card.');
    }
  };

  const active = practice ?? queue;
  const current = active[0];
  const counts = built && !built.empty ? built : undefined;

  return (
    <div>
      <p role="status" aria-live="polite" data-testid="review-status">
        {message ||
          (current
            ? `${active.length} card${active.length === 1 ? '' : 's'} left${practice ? ' (practice mode, no scheduling)' : ''}.`
            : '')}
      </p>

      {current ? (
        <CardView
          key={`${current.id}-${reviewedNow}-${practice ? 'p' : 's'}`}
          item={current}
          now={nowRef.current}
          scheduled={!practice}
          shortcuts={shortcuts}
          onRate={(rating) => {
            if (practice) setPractice((p) => (p ? p.slice(1) : p));
            else rate(current, rating);
          }}
        />
      ) : (
        <div data-testid="review-empty">
          <h2>
            {practice
              ? 'Practice finished'
              : reviewedNow > 0
                ? 'Session complete'
                : 'Nothing to review'}
          </h2>
          <p>
            {reviewedNow > 0
              ? `You rated ${reviewedNow} card${reviewedNow === 1 ? '' : 's'} today.`
              : 'Cards appear here after you master a lesson. Come back when reviews are due.'}
            {counts
              ? ` Done today: ${counts.done.reviews} reviews and ${counts.done.newCards} new cards.`
              : ''}
          </p>
          {practice && (
            <button type="button" onClick={() => setPractice(null)}>
              Back to today&apos;s reviews
            </button>
          )}
        </div>
      )}

      {!practice && (
        <p>
          <button type="button" onClick={startPractice} disabled={!data}>
            Practice more (no scheduling)
          </button>
        </p>
      )}

      <h2>Add your own card</h2>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onAddCard(e.currentTarget);
        }}
      >
        <p>
          <label>
            Front <input name="front" type="text" size={50} />
          </label>
        </p>
        <p>
          <label>
            Back <input name="back" type="text" size={50} />
          </label>
        </p>
        <p>
          <label>
            Competencies (optional, comma separated){' '}
            <input name="competencies" type="text" size={40} />
          </label>
        </p>
        <p>
          <button type="submit">Add card</button>
        </p>
      </form>
    </div>
  );
}
