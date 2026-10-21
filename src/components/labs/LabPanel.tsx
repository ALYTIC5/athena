import { useEffect, useState, type FormEvent } from 'react';
import { checklistKey, parseEvidenceUrl, toggleItem } from '../../lib/labs/progress';
import { load, subscribe, update } from '../../lib/store/store';

interface Props {
  milestone: string;
  /** The id of the element that holds the rendered milestone text, whose task items become checkboxes. */
  bodyId: string;
}

const CORRUPT = 'Your saved data is corrupt. Open Settings to recover it.';

/**
 * Progress for one lab milestone: the markdown task items become tickable checkboxes, and the
 * learner records an evidence link (a commit or CI run URL) and marks the milestone done.
 * Everything is self-assessed and stored only in this browser.
 */
export function LabPanel({ milestone, bodyId }: Props) {
  const [ticked, setTicked] = useState(0);
  const [total, setTotal] = useState(0);
  const [evidence, setEvidence] = useState('');
  const [saved, setSaved] = useState('');
  const [done, setDone] = useState(false);
  const [status, setStatus] = useState('');

  useEffect(() => {
    const body = document.getElementById(bodyId);
    const boxes = body
      ? Array.from(body.querySelectorAll<HTMLInputElement>('input[type="checkbox"]'))
      : [];
    setTotal(boxes.length);

    const read = () => {
      const stored = load(window.localStorage);
      const mine = stored.status === 'ok' ? stored.data : null;
      const list = mine?.checklists[checklistKey(milestone)]?.done ?? [];
      setTicked(list.length);
      setDone(mine?.labs[milestone]?.done === true);
      setSaved(mine?.labs[milestone]?.evidenceUrl ?? '');
      boxes.forEach((box, i) => {
        box.checked = list.includes(String(i));
      });
    };

    const removers = boxes.map((box, i) => {
      box.disabled = false;
      box.setAttribute('aria-label', box.closest('li')?.textContent?.trim() ?? `Check ${i + 1}`);
      const onChange = () => {
        try {
          update(window.localStorage, new Date(), (d) => ({
            ...d,
            checklists: {
              ...d.checklists,
              [checklistKey(milestone)]: {
                updatedAt: new Date().toISOString(),
                done: toggleItem(d.checklists[checklistKey(milestone)]?.done ?? [], i, box.checked),
              },
            },
          }));
        } catch {
          setStatus(CORRUPT);
        }
      };
      box.addEventListener('change', onChange);
      return () => box.removeEventListener('change', onChange);
    });

    read();
    const unsubscribe = subscribe(window, read);
    return () => {
      removers.forEach((remove) => remove());
      unsubscribe();
    };
  }, [bodyId, milestone]);

  const writeLab = (next: { done: boolean; evidenceUrl?: string }) => {
    const now = new Date().toISOString();
    update(window.localStorage, new Date(), (d) => ({
      ...d,
      labs: {
        ...d.labs,
        [milestone]: {
          updatedAt: now,
          done: next.done,
          ...(next.evidenceUrl ? { evidenceUrl: next.evidenceUrl } : {}),
          ...(next.done ? { at: now } : {}),
        },
      },
    }));
  };

  const saveEvidence = (event: FormEvent) => {
    event.preventDefault();
    const parsed = parseEvidenceUrl(evidence);
    if (!parsed.ok) {
      setStatus(parsed.error);
      return;
    }
    try {
      writeLab({ done, evidenceUrl: parsed.url });
      setEvidence('');
      setStatus('Evidence link saved.');
    } catch {
      setStatus(CORRUPT);
    }
  };

  const toggleDone = (next: boolean) => {
    if (next && saved === '') {
      setStatus('Save an evidence link before you mark this milestone done.');
      return;
    }
    try {
      writeLab({ done: next, ...(saved ? { evidenceUrl: saved } : {}) });
      setStatus(next ? 'Milestone marked done.' : 'Milestone marked not done.');
    } catch {
      setStatus(CORRUPT);
    }
  };

  return (
    <section
      aria-label="Your progress on this milestone"
      data-pagefind-ignore
      data-lab-panel={milestone}
    >
      <h2>Your progress</h2>
      <p>
        <small>
          Self-assessed, and stored only in this browser. {ticked} of {total} checks ticked.
        </small>
      </p>
      <form onSubmit={saveEvidence}>
        <label htmlFor={`evidence-${milestone}`}>Evidence link (a commit, CI run or report)</label>
        <br />
        <input
          id={`evidence-${milestone}`}
          type="url"
          inputMode="url"
          autoComplete="off"
          placeholder="https://github.com/you/your-repo/commit/…"
          value={evidence}
          onChange={(e) => setEvidence(e.target.value)}
          style={{ width: '100%', maxWidth: '36rem' }}
        />{' '}
        <button type="submit">Save evidence</button>
      </form>
      {saved ? (
        <p>
          Saved evidence:{' '}
          <a href={saved} rel="noopener noreferrer" target="_blank">
            {saved}
          </a>
        </p>
      ) : null}
      <p>
        <label>
          <input type="checkbox" checked={done} onChange={(e) => toggleDone(e.target.checked)} /> I
          have finished this milestone
        </label>
      </p>
      <p role="status" data-testid="lab-status">
        {status}
      </p>
    </section>
  );
}
