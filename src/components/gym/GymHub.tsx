import { useEffect, useMemo, useState } from 'react';
import { dueReattempts } from '../../lib/gym/attempts';
import { pickMixedSet, type ProblemRef } from '../../lib/gym/mixed';
import { load, subscribe, type LearnerData } from '../../lib/store/store';
import { url } from '../../lib/url';

interface ProblemMeta extends ProblemRef {
  title: string;
  timeLimitMin: number;
}

interface DrillMeta {
  id: string;
  kind: 'code-reading' | 'ai-assisted';
  title: string;
  timeLimitMin: number;
}

const problemUrl = (id: string, mode: string) => `${url(`gym/problem/${id}/`)}?mode=${mode}`;

export function GymHub() {
  const [meta, setMeta] = useState<{ problems: ProblemMeta[]; drills: DrillMeta[] } | null>(null);
  const [data, setData] = useState<LearnerData | null>(null);
  const [mixed, setMixed] = useState<ProblemMeta[] | null>(null);
  const [count, setCount] = useState(2);
  const [error, setError] = useState('');

  useEffect(() => {
    const read = () => {
      const s = load(window.localStorage);
      setData(s.status === 'ok' ? s.data : null);
    };
    read();
    fetch(url('data/gym.json'))
      .then(async (r) => {
        if (!r.ok) throw new Error('Could not load the gym.');
        return (await r.json()) as { problems: ProblemMeta[]; drills: DrillMeta[] };
      })
      .then(setMeta)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'Could not load the gym.'));
    return subscribe(window, read);
  }, []);

  const byId = useMemo(() => new Map((meta?.problems ?? []).map((p) => [p.id, p])), [meta]);
  const due = useMemo(() => (data ? dueReattempts(data, new Date()) : []), [data]);

  const byPattern = useMemo(() => {
    const groups = new Map<string, ProblemMeta[]>();
    for (const p of meta?.problems ?? []) {
      const g = groups.get(p.pattern) ?? [];
      g.push(p);
      groups.set(p.pattern, g);
    }
    return [...groups.entries()];
  }, [meta]);

  if (error) return <p role="alert">{error}</p>;
  if (!meta) return <p>Loading the Interview Gym…</p>;

  return (
    <div data-testid="gym-hub">
      <h2>Re-attempts due</h2>
      {due.length === 0 ? (
        <p data-testid="no-reattempts">Nothing due. Problems you do not finish come back here.</p>
      ) : (
        <ul data-testid="reattempt-list">
          {due.map((id) => (
            <li key={id}>
              <a href={problemUrl(id, 'reattempt')}>{byId.get(id)?.title ?? id}</a>
            </li>
          ))}
        </ul>
      )}

      <h2>Approach practice and timed problems</h2>
      <p>
        Approach practice is untimed with the think-aloud checklist. Timed solo gives you 20 minutes
        for an easy problem and 40 for a medium one.
      </p>
      {byPattern.length === 0 && <p>No problems yet.</p>}
      {byPattern.map(([pattern, list]) => (
        <section key={pattern} aria-label={`Pattern ${pattern}`}>
          <h3>{pattern}</h3>
          <ul>
            {list.map((p) => (
              <li key={p.id}>
                {p.title} ({p.difficulty}){' '}
                <a href={problemUrl(p.id, 'approach')}>Approach practice</a> ·{' '}
                <a href={problemUrl(p.id, 'timed')}>Timed ({p.timeLimitMin} min)</a>
              </li>
            ))}
          </ul>
        </section>
      ))}

      <h2>Mixed set</h2>
      <p>One to three problems with the pattern hidden until you finish.</p>
      <p>
        <label>
          How many problems{' '}
          <select value={count} onChange={(e) => setCount(Number(e.target.value))}>
            {[1, 2, 3].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>{' '}
        <button
          type="button"
          onClick={() =>
            setMixed(pickMixedSet({ problems: meta.problems, data, count }) as ProblemMeta[])
          }
          data-testid="make-mixed"
        >
          Make a mixed set
        </button>
      </p>
      {mixed && (
        <ol data-testid="mixed-list">
          {mixed.map((p) => (
            <li key={p.id}>
              <a href={problemUrl(p.id, 'mixed')}>{p.title}</a>
            </li>
          ))}
        </ol>
      )}

      <h2>Drills</h2>
      <p>
        Code-reading drills: find a planted bug in a small multi-file program in 30 minutes.
        AI-assisted drills let you use an assistant, but you write a hypothesis before each prompt
        and verify with the tests.
      </p>
      <ul>
        {meta.drills.map((d) => (
          <li key={d.id}>
            <a href={url(`gym/drill/${d.id}/`)}>{d.title}</a> (
            {d.kind === 'code-reading' ? 'code reading' : 'AI-assisted'})
          </li>
        ))}
        {meta.drills.length === 0 && <li>No drills yet.</li>}
      </ul>

      <h2>Mock interviews and stories</h2>
      <ul>
        <li>
          <a href={url('gym/mock/')}>Mock interviews with Claude</a>
        </li>
        <li>
          <a href={url('gym/stories/')}>STAR stories</a>
        </li>
      </ul>
    </div>
  );
}
