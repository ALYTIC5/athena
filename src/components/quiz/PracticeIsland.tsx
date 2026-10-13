import { useEffect, useState } from 'react';
import { load, update } from '../../lib/store/store';
import { url } from '../../lib/url';

interface Practice {
  id: string;
  kind: 'checklist' | 'rubric';
  title: string;
  steps?: { do: string; expect?: string }[];
  criteria?: { name: string; levels: { score: number; description: string }[] }[];
}

/** Checklists and rubrics are self-assessed; they are stored but never count as unaided evidence. */
export function PracticeIsland({ id }: { id: string }) {
  const [practice, setPractice] = useState<Practice | null | undefined>(undefined);
  const [done, setDone] = useState<string[]>([]);
  const [scores, setScores] = useState<Record<string, number>>({});
  const [notes, setNotes] = useState('');

  useEffect(() => {
    fetch(url(`data/practice/${id}.json`))
      .then(async (r) => (r.ok ? ((await r.json()) as Practice) : null))
      .then((p) => {
        setPractice(p);
        const stored = load(window.localStorage);
        if (stored.status === 'ok') {
          setDone(stored.data.checklists[id]?.done ?? []);
          setScores(stored.data.rubrics[id]?.scores ?? {});
          setNotes(stored.data.rubrics[id]?.notes ?? '');
        }
      })
      .catch(() => setPractice(null));
  }, [id]);

  if (practice === undefined) return <p>Loading…</p>;
  if (practice === null) return null;

  const saveChecklist = (next: string[]) => {
    setDone(next);
    try {
      update(window.localStorage, new Date(), (d) => ({
        ...d,
        checklists: {
          ...d.checklists,
          [id]: { updatedAt: new Date().toISOString(), done: next },
        },
      }));
    } catch {
      // corrupt data: Settings shows the recovery screen
    }
  };

  const saveRubric = (nextScores: Record<string, number>, nextNotes: string) => {
    setScores(nextScores);
    setNotes(nextNotes);
    try {
      update(window.localStorage, new Date(), (d) => ({
        ...d,
        rubrics: {
          ...d.rubrics,
          [id]: {
            updatedAt: new Date().toISOString(),
            scores: nextScores,
            ...(nextNotes ? { notes: nextNotes } : {}),
          },
        },
      }));
    } catch {
      // corrupt data: Settings shows the recovery screen
    }
  };

  if (practice.kind === 'checklist') {
    const steps = practice.steps ?? [];
    return (
      <section aria-label={practice.title} data-pagefind-ignore data-practice={id}>
        <h3>{practice.title}</h3>
        <p>
          <small>
            Self-assessed: {done.length} of {steps.length} done.
          </small>
        </p>
        <ul style={{ listStyle: 'none', paddingLeft: 0 }}>
          {steps.map((s, i) => {
            const key = String(i);
            return (
              <li key={key}>
                <label>
                  <input
                    type="checkbox"
                    checked={done.includes(key)}
                    onChange={() =>
                      saveChecklist(
                        done.includes(key) ? done.filter((x) => x !== key) : [...done, key],
                      )
                    }
                  />{' '}
                  <code>{s.do}</code>
                </label>
                {s.expect && (
                  <div>
                    <small>You should see: {s.expect}</small>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </section>
    );
  }

  return (
    <section aria-label={practice.title} data-pagefind-ignore data-practice={id}>
      <h3>{practice.title}</h3>
      <p>
        <small>Rate your own work against each criterion. This is self-assessed.</small>
      </p>
      {(practice.criteria ?? []).map((c) => (
        <fieldset key={c.name}>
          <legend>{c.name}</legend>
          {c.levels.map((l) => (
            <label key={l.score} style={{ display: 'block' }}>
              <input
                type="radio"
                name={`${id}-${c.name}`}
                checked={scores[c.name] === l.score}
                onChange={() => saveRubric({ ...scores, [c.name]: l.score }, notes)}
              />{' '}
              {l.score}: {l.description}
            </label>
          ))}
        </fieldset>
      ))}
      <label>
        Notes
        <br />
        <textarea
          rows={3}
          cols={60}
          value={notes}
          onChange={(e) => saveRubric(scores, e.target.value)}
        />
      </label>
    </section>
  );
}
