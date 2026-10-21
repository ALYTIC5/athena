import { useEffect, useState } from 'react';
import { checklistKey } from '../../lib/labs/progress';
import { load, subscribe, type LearnerData } from '../../lib/store/store';
import { url } from '../../lib/url';

interface LabInfo {
  slug: string;
  name: string;
  summary: string;
  milestones: { id: string; title: string; hours: string; weeks: number[]; checks: number }[];
}

/** The milestones of one lab (or of both), with progress read from the learner store. */
export function LabsApp({ lab }: { lab?: string }) {
  const [labs, setLabs] = useState<LabInfo[] | null>(null);
  const [data, setData] = useState<LearnerData | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    const read = () => {
      const stored = load(window.localStorage);
      setData(stored.status === 'ok' ? stored.data : null);
    };
    read();
    fetch(url('data/labs.json'))
      .then((r) => r.json() as Promise<LabInfo[]>)
      .then(setLabs)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'Could not load the labs.'));
    return subscribe(window, read);
  }, []);

  if (error) return <p role="alert">{error}</p>;
  if (!labs) return <p>Loading…</p>;
  const shown = labs.filter((l) => !lab || l.slug === lab);

  return (
    <div data-testid="labs">
      {shown.map((l) => (
        <section key={l.slug} aria-labelledby={`lab-${l.slug}`}>
          {lab ? null : (
            <>
              <h2 id={`lab-${l.slug}`}>
                <a href={url(`labs/${l.slug}/`)}>{l.name}</a>
              </h2>
              <p>{l.summary}</p>
              <p>
                <a href={url(`labs/${l.slug}/contract/`)}>Contract</a>
              </p>
            </>
          )}
          <ul style={{ listStyle: 'none', paddingLeft: 0 }}>
            {l.milestones.map((m) => {
              const record = data?.labs[m.id];
              const ticked = data?.checklists[checklistKey(m.id)]?.done.length ?? 0;
              const done = record?.done === true;
              const weeks =
                m.weeks.length > 0
                  ? `Week${m.weeks.length > 1 ? 's' : ''} ${m.weeks.join(', ')}`
                  : '';
              return (
                <li key={m.id} data-milestone={m.id} style={{ marginBottom: '0.9rem' }}>
                  <a href={url(`labs/${m.id}/`)}>
                    <code>{m.id}</code>: {m.title}
                  </a>
                  <br />
                  <small>
                    {weeks}
                    {m.hours ? ` · about ${m.hours}` : ''}
                    {' · '}
                    <strong>{done ? 'Done' : 'Not done'}</strong>
                    {m.checks > 0 ? ` · ${ticked} of ${m.checks} checks ticked` : ''}
                    {record?.evidenceUrl ? (
                      <>
                        {' · '}
                        <a href={record.evidenceUrl} rel="noopener noreferrer" target="_blank">
                          evidence link
                        </a>
                      </>
                    ) : null}
                  </small>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
