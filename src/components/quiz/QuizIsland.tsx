import { useEffect, useState } from 'react';
import { loadPool } from '../../lib/quiz/pool-client';
import { inPool } from '../../lib/quiz/selection';
import { recordAnswer } from '../../lib/quiz/record';
import type { Question } from '../../lib/quiz/types';
import { QuestionView } from './QuestionView';

interface Props {
  lesson: string;
  /** Show only the check items tagged with this chunk. */
  chunk?: number | undefined;
  /** Show a single item by id (used by the Predict and Parsons components). */
  item?: string | undefined;
}

export function QuizIsland({ lesson, chunk, item }: Props) {
  const [questions, setQuestions] = useState<Question[] | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    loadPool()
      .then((pool) => {
        const own = pool.items.filter((q) => q.lesson === lesson);
        setQuestions(
          item
            ? own.filter((q) => q.id === item)
            : own.filter(
                // Predict and Parsons items have their own components, so Quiz skips them.
                (q) =>
                  inPool(q, 'check') &&
                  q.type !== 'predict' &&
                  q.type !== 'parsons' &&
                  (chunk === undefined || q.chunk === chunk),
              ),
        );
      })
      .catch((e: unknown) =>
        setError(e instanceof Error ? e.message : 'Could not load the questions.'),
      );
  }, [lesson, chunk, item]);

  if (error) return <p role="alert">{error}</p>;
  if (!questions) return <p>Loading questions…</p>;
  if (questions.length === 0) return null;

  return (
    <section
      aria-label={item ? `Question ${item}` : `Quick check, chunk ${chunk ?? lesson}`}
      data-pagefind-ignore
    >
      {questions.map((q, i) => (
        <QuestionView
          key={q.id}
          question={q}
          showFeedback
          heading={item ? 'Try it' : `Quick check ${i + 1} of ${questions.length}`}
          onSubmit={(r) => {
            try {
              recordAnswer(window.localStorage, new Date(), {
                id: q.id,
                correct: r.correct,
                confidence: r.confidence,
                source: 'check',
              });
            } catch {
              // corrupt data: Settings shows the recovery screen
            }
          }}
        />
      ))}
    </section>
  );
}
