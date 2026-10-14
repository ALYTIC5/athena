import { useEffect, useRef, useState } from 'react';
import { STAR_SECONDS, formatClock } from '../../lib/gym/timer';
import { load, update } from '../../lib/store/store';

type Story = {
  id: string;
  title: string;
  situation: string;
  task: string;
  action: string;
  result: string;
  learned: string;
};

const SLOTS = 6;
const FIELDS: { key: keyof Omit<Story, 'id'>; label: string }[] = [
  { key: 'title', label: 'Title' },
  { key: 'situation', label: 'Situation' },
  { key: 'task', label: 'Task' },
  { key: 'action', label: 'Action (what you did)' },
  { key: 'result', label: 'Result' },
  { key: 'learned', label: 'What you learned' },
];

const blank = (i: number): Story => ({
  id: `story-${i + 1}`,
  title: '',
  situation: '',
  task: '',
  action: '',
  result: '',
  learned: '',
});

/** A builder for six STAR stories with a 2-minute delivery timer. */
export function StarStories() {
  const [stories, setStories] = useState<Story[]>(() =>
    Array.from({ length: SLOTS }, (_, i) => blank(i)),
  );
  const [message, setMessage] = useState('');
  const [active, setActive] = useState(0);
  const [left, setLeft] = useState(STAR_SECONDS * 1000);
  const [running, setRunning] = useState(false);
  const started = useRef(0);

  useEffect(() => {
    const s = load(window.localStorage);
    if (s.status === 'ok') {
      setStories((cur) =>
        cur.map((b) => {
          const saved = s.data.stories.find((x) => x.id === b.id);
          return saved
            ? {
                id: saved.id,
                title: saved.title,
                situation: saved.situation,
                task: saved.task,
                action: saved.action,
                result: saved.result,
                learned: saved.learned,
              }
            : b;
        }),
      );
    }
  }, []);

  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => {
      const remaining = Math.max(0, STAR_SECONDS * 1000 - (Date.now() - started.current));
      setLeft(remaining);
      if (remaining === 0) {
        setRunning(false);
        setMessage('Time. Stop where you are and note what you would cut.');
      }
    }, 250);
    return () => clearInterval(t);
  }, [running]);

  const save = (i: number) => {
    const story = stories[i] as Story;
    if (!story.title.trim()) {
      setMessage('Give the story a title first.');
      return;
    }
    try {
      update(window.localStorage, new Date(), (d) => {
        const others = d.stories.filter((x) => x.id !== story.id);
        return {
          ...d,
          stories: [...others, { ...story, updatedAt: new Date().toISOString() }],
        };
      });
      setMessage(`Saved: ${story.title}`);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Could not save the story.');
    }
  };

  const edit = (i: number, key: keyof Omit<Story, 'id'>, value: string) =>
    setStories((all) => all.map((s, j) => (j === i ? { ...s, [key]: value } : s)));

  const story = stories[active] as Story;

  return (
    <div>
      <p>
        Build six stories for behavioural questions. Write the facts, then practise saying each one
        out loud within two minutes.
      </p>
      <p role="tablist" aria-label="Stories">
        {stories.map((s, i) => (
          <button
            key={s.id}
            type="button"
            role="tab"
            aria-selected={i === active}
            onClick={() => setActive(i)}
            style={{ marginInlineEnd: '0.5rem' }}
          >
            Story {i + 1}
            {s.title ? `: ${s.title}` : ''}
          </button>
        ))}
      </p>

      <section aria-label={`Story ${active + 1}`}>
        {FIELDS.map((f) => (
          <p key={f.key}>
            <label>
              {f.label}
              <br />
              {f.key === 'title' ? (
                <input
                  type="text"
                  size={60}
                  value={story.title}
                  onChange={(e) => edit(active, 'title', e.target.value)}
                />
              ) : (
                <textarea
                  rows={3}
                  cols={60}
                  value={story[f.key]}
                  onChange={(e) => edit(active, f.key, e.target.value)}
                />
              )}
            </label>
          </p>
        ))}
        <p>
          <button type="button" onClick={() => save(active)}>
            Save story
          </button>
        </p>
      </section>

      <section aria-label="Delivery timer">
        <h2>Delivery timer</h2>
        <p role="timer" aria-live="off" data-testid="star-clock">
          {formatClock(left)}
        </p>
        <p>
          <button
            type="button"
            onClick={() => {
              started.current = Date.now();
              setLeft(STAR_SECONDS * 1000);
              setRunning(true);
              setMessage('');
            }}
            disabled={running}
            data-testid="star-start"
          >
            Start 2-minute timer
          </button>{' '}
          <button
            type="button"
            onClick={() => {
              setRunning(false);
              setLeft(STAR_SECONDS * 1000);
            }}
          >
            Reset
          </button>
        </p>
      </section>

      <p role="status" aria-live="polite" data-testid="star-status">
        {message}
      </p>
    </div>
  );
}
