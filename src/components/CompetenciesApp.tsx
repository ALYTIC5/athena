import { useEffect, useMemo, useState } from 'react';
import { computeAll } from '../lib/competency/levels';
import {
  LEVEL_NAMES,
  type CompetencyDef,
  type CompetencyResult,
  type ContentIndex,
} from '../lib/competency/types';
import { load, subscribe, update, type LearnerData } from '../lib/store/store';
import { url } from '../lib/url';

const TRACK_NAMES: Record<string, string> = {
  sec: 'Security hygiene',
  git: 'Git and GitHub',
  wri: 'Technical writing',
  py: 'Python',
  sql: 'SQL and PostgreSQL',
  api: 'APIs and webhooks',
  ai: 'Agents and LLM APIs',
  ops: 'Docker, CI and cloud',
  rag: 'Retrieval',
  eval: 'Evals',
  com: 'Communication',
  int: 'Interview fundamentals',
  sys: 'System design',
  ts: 'TypeScript (not core)',
  el: 'Electives (not core)',
};

export function CompetenciesApp() {
  const [defs, setDefs] = useState<CompetencyDef[] | null>(null);
  const [index, setIndex] = useState<ContentIndex | null>(null);
  const [data, setData] = useState<LearnerData | null>(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const now = useMemo(() => new Date(), []);

  useEffect(() => {
    const read = () => {
      const s = load(window.localStorage);
      setData(s.status === 'ok' ? s.data : null);
    };
    read();
    Promise.all([
      fetch(url('data/competencies.json')).then((r) => r.json() as Promise<CompetencyDef[]>),
      fetch(url('data/content-index.json')).then((r) => r.json() as Promise<ContentIndex>),
    ])
      .then(([d, i]) => {
        setDefs(d);
        setIndex(i);
      })
      .catch((e: unknown) =>
        setError(e instanceof Error ? e.message : 'Could not load competencies.'),
      );
    return subscribe(window, read);
  }, []);

  const results = useMemo<Map<string, CompetencyResult> | null>(() => {
    if (!defs || !index) return null;
    const learner = data ?? null;
    if (!learner) {
      return new Map(
        defs.map((d) => [
          d.id,
          { level: 0, evidence: [], rusty: false, overconfident: [] } as CompetencyResult,
        ]),
      );
    }
    return computeAll(defs, index, learner, now);
  }, [defs, index, data, now]);

  if (error) return <p role="alert">{error}</p>;
  if (!defs || !results) return <p>Loading competencies…</p>;

  const tracks = [...new Set(defs.map((d) => d.track))];
  const overconfident = defs
    .map((d) => ({ def: d, ids: results.get(d.id)?.overconfident ?? [] }))
    .filter((x) => x.ids.length > 0);

  const rate = (id: string, level: number) => {
    try {
      update(window.localStorage, new Date(), (d) => ({
        ...d,
        selfRatings: {
          ...d.selfRatings,
          [id]: { updatedAt: new Date().toISOString(), level: level as 0 | 1 | 2 | 3 | 4 | 5 },
        },
      }));
      setMessage('Self-rating saved.');
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Could not save your rating.');
    }
  };

  return (
    <div data-testid="competencies">
      <p>
        Levels are computed from your evidence: what you answer, what you build without hints, and
        how your explain-backs score. Your own rating sits beside the computed level. A card overdue
        by more than two weeks, or with recent lapses, marks a competency as rusty; the level does
        not drop.
      </p>
      <p role="status" aria-live="polite" data-testid="comp-status">
        {message}
      </p>

      <section aria-label="Overconfident">
        <h2>Overconfident</h2>
        {overconfident.length === 0 ? (
          <p data-testid="overconfident-empty">
            None. These are questions you answered &quot;certain&quot; and got wrong in the last 30
            days.
          </p>
        ) : (
          <ul data-testid="overconfident-list">
            {overconfident.map(({ def, ids }) => (
              <li key={def.id}>
                {def.title} ({def.id}): {ids.length} question{ids.length === 1 ? '' : 's'}
              </li>
            ))}
          </ul>
        )}
      </section>

      {tracks.map((track) => (
        <section key={track} aria-label={TRACK_NAMES[track] ?? track}>
          <h2>{TRACK_NAMES[track] ?? track}</h2>
          <table>
            <thead>
              <tr>
                <th scope="col">Competency</th>
                <th scope="col">Computed level</th>
                <th scope="col">Your rating</th>
                <th scope="col">Evidence</th>
              </tr>
            </thead>
            <tbody>
              {defs
                .filter((d) => d.track === track)
                .map((d) => {
                  const r = results.get(d.id) as CompetencyResult;
                  const own = data?.selfRatings[d.id]?.level;
                  return (
                    <tr key={d.id} data-competency={d.id} data-level={r.level}>
                      <th scope="row">
                        {d.title}
                        <br />
                        <small>
                          <code>{d.id}</code>
                        </small>
                        {r.rusty && (
                          <>
                            {' '}
                            <strong data-testid="rusty">Rusty</strong>
                          </>
                        )}
                      </th>
                      <td>
                        {r.level} · {LEVEL_NAMES[r.level]}
                      </td>
                      <td>
                        <label>
                          <span className="athena-sr-only">Your rating for {d.title}</span>
                          <select
                            value={own ?? ''}
                            onChange={(e) => rate(d.id, Number(e.target.value))}
                          >
                            <option value="">Not rated</option>
                            {[0, 1, 2, 3, 4, 5].map((n) => (
                              <option key={n} value={n}>
                                {n} · {LEVEL_NAMES[n as 0 | 1 | 2 | 3 | 4 | 5]}
                              </option>
                            ))}
                          </select>
                        </label>
                        {own !== undefined && own > r.level && (
                          <div>Your rating is above the evidence.</div>
                        )}
                      </td>
                      <td>
                        {r.evidence.length === 0 ? (
                          <small>No evidence yet.</small>
                        ) : (
                          <ul>
                            {r.evidence.map((e, i) => (
                              <li key={i}>
                                <small>{e}</small>
                              </li>
                            ))}
                          </ul>
                        )}
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </section>
      ))}
    </div>
  );
}
