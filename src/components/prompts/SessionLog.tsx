import { useState } from 'react';
import { gapToCard, logSession, type Score, type SessionKind } from '../../lib/prompts/sessions';

interface Props {
  kind: SessionKind;
  /** Score names to ask for, for example correctness, depth and clarity. */
  scoreLabels: string[];
  competencies: string[];
  lessonId?: string | undefined;
  exerciseId?: string | undefined;
}

const SCORES: Score[] = [1, 2, 3, 4, 5];

/** After a Claude session: log the scores and gaps. Any gap can become a review card in one click. */
export function SessionLog({ kind, scoreLabels, competencies, lessonId, exerciseId }: Props) {
  const [scores, setScores] = useState<Record<string, Score>>({});
  const [gaps, setGaps] = useState(['', '', '']);
  const [notes, setNotes] = useState('');
  const [message, setMessage] = useState('');
  const [saved, setSaved] = useState<string[] | null>(null);
  const [made, setMade] = useState<Record<number, boolean>>({});

  const save = () => {
    const missing = scoreLabels.filter((l) => scores[l] === undefined);
    if (missing.length > 0) {
      setMessage(`Enter a score from 1 to 5 for: ${missing.join(', ')}.`);
      return;
    }
    try {
      logSession(window.localStorage, new Date(), {
        kind,
        lessonId,
        exerciseId,
        competencies,
        scores,
        gaps,
        notes: notes.trim() || undefined,
      });
      setSaved(gaps.map((g) => g.trim()).filter(Boolean));
      setMessage('Session logged.');
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Could not save the session.');
    }
  };

  return (
    <section aria-label="Log this session" data-testid="session-log">
      <h3>Log this session</h3>
      {scoreLabels.map((label) => (
        <p key={label}>
          <label>
            Score for {label} (1 to 5){' '}
            <select
              value={scores[label] ?? ''}
              onChange={(e) =>
                setScores((s) => ({ ...s, [label]: Number(e.target.value) as Score }))
              }
            >
              <option value="">Choose</option>
              {SCORES.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
        </p>
      ))}
      <p>Biggest gaps, each written as a question you should be able to answer:</p>
      {gaps.map((g, i) => (
        <p key={i}>
          <label>
            Gap {i + 1}{' '}
            <input
              type="text"
              size={60}
              value={g}
              onChange={(e) => setGaps((all) => all.map((x, j) => (j === i ? e.target.value : x)))}
            />
          </label>
        </p>
      ))}
      <p>
        <label>
          Notes (optional)
          <br />
          <textarea rows={3} cols={60} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </label>
      </p>
      <p>
        <button type="button" onClick={save}>
          Save session
        </button>
      </p>
      <p role="status" aria-live="polite" data-testid="session-status">
        {message}
      </p>
      {saved && saved.length > 0 && (
        <ul>
          {saved.map((gap, i) => (
            <li key={i}>
              {gap}{' '}
              <button
                type="button"
                disabled={made[i] === true}
                onClick={() => {
                  try {
                    gapToCard(window.localStorage, new Date(), gap, competencies);
                    setMade((m) => ({ ...m, [i]: true }));
                  } catch (e) {
                    setMessage(e instanceof Error ? e.message : 'Could not add the card.');
                  }
                }}
              >
                {made[i] ? 'Card added' : 'Add as review card'}
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
