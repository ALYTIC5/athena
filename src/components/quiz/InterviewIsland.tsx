import { useEffect, useState } from 'react';
import { url } from '../../lib/url';

interface InterviewQuestion {
  id: string;
  question: string;
  modelAnswer: string;
  listenFor: string[];
}

/** The learner answers first; the model answer and what the interviewer listens for come after. */
export function InterviewIsland({ lesson }: { lesson: string }) {
  const [questions, setQuestions] = useState<InterviewQuestion[] | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});

  useEffect(() => {
    fetch(url(`data/interview/${lesson}.json`))
      .then(async (r) => (r.ok ? ((await r.json()) as InterviewQuestion[]) : []))
      .then(setQuestions)
      .catch(() => setQuestions([]));
  }, [lesson]);

  if (!questions) return <p>Loading the interview questions…</p>;
  if (questions.length === 0) return null;

  return (
    <section aria-labelledby={`interview-${lesson}`} data-pagefind-ignore>
      <h2 id={`interview-${lesson}`}>Interview corner</h2>
      <p>
        Say your answer out loud first, then write the key points. The model answer unlocks after
        you write something.
      </p>
      {questions.map((q) => (
        <div key={q.id} data-interview={q.id}>
          <h3>{q.question}</h3>
          <label>
            Your answer
            <br />
            <textarea
              rows={4}
              cols={60}
              value={answers[q.id] ?? ''}
              onChange={(e) => setAnswers((a) => ({ ...a, [q.id]: e.target.value }))}
            />
          </label>
          <p>
            <button
              type="button"
              disabled={(answers[q.id] ?? '').trim() === ''}
              onClick={() => setRevealed((r) => ({ ...r, [q.id]: true }))}
            >
              Show model answer
            </button>
          </p>
          {revealed[q.id] && (
            <div data-testid="model-answer">
              <p>{q.modelAnswer}</p>
              <p>What the interviewer listens for:</p>
              <ul>
                {q.listenFor.map((l, i) => (
                  <li key={i}>{l}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      ))}
    </section>
  );
}
