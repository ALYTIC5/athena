import { useEffect, useState } from 'react';
import { buildQueue, type ContentCard } from '../lib/srs/queue';
import { load, subscribe } from '../lib/store/store';
import { url } from '../lib/url';

let cardsPromise: Promise<ContentCard[]> | undefined;

function loadCards(): Promise<ContentCard[]> {
  cardsPromise ??= fetch(url('data/cards.json'))
    .then(async (r) => (r.ok ? ((await r.json()) as ContentCard[]) : []))
    .catch(() => []);
  return cardsPromise;
}

/** Number of cards in today's session (due reviews and new cards within the daily caps). */
export function useDueCount(): number | null {
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    let alive = true;
    const compute = () => {
      void loadCards().then((cards) => {
        if (!alive) return;
        const stored = load(window.localStorage);
        if (stored.status !== 'ok') return setCount(0);
        setCount(buildQueue({ content: cards, data: stored.data, now: new Date() }).dueCount);
      });
    };
    compute();
    const off = subscribe(window, compute);
    const timer = setInterval(compute, 60000);
    return () => {
      alive = false;
      off();
      clearInterval(timer);
    };
  }, []);

  return count;
}

export function DueBadge() {
  const count = useDueCount();
  if (count === null) return null;
  return (
    <a href={url('review/')} className="athena-due-badge" data-testid="due-badge">
      Review: {count} due
    </a>
  );
}
