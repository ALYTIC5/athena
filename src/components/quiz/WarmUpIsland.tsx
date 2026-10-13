import { useEffect, useState } from 'react';
import { loadPool } from '../../lib/quiz/pool-client';
import { recordAnswer } from '../../lib/quiz/record';
import { competencyAccuracy, seededRng, selectWarmUp } from '../../lib/quiz/selection';
import type { Question } from '../../lib/quiz/types';
import { getSeed } from '../../lib/quiz/seed';
import { load } from '../../lib/store/store';
import { QuestionView } from './QuestionView';

interface Props {
  lesson: string;
  count: number;
}

export function WarmUpIsland({ lesson, count }: Props) {
  const [picked, setPicked] = useState<Question[] | null | undefined>(undefined);
  const [done, setDone] = useState(0);

  useEffect(() => {
    loadPool()
      .then((pool) => {
        const stored = load(window.localStorage);
        const answers = stored.status === 'ok' ? stored.data.answers : {};
        const accuracy = competencyAccuracy(pool.items, answers);
        setPicked(
          selectWarmUp({
            items: pool.items,
            lessons: pool.lessons,
            current: lesson,
            accuracy,
            rng: seededRng(getSeed()),
            count,
          }),
        );
      })
      .catch(() => setPicked(null));
  }, [lesson, count]);

  // The loading line gives the island a size so client:visible can see it.
  if (picked === undefined) return <p>Loading the warm-up…</p>;
  // Fewer than `count` earlier items exist: skip the warm-up.
  if (picked === null) return null;

  return (
    <section aria-labelledby={`warmup-${lesson}`} data-pagefind-ignore>
      <h2 id={`warmup-${lesson}`}>Warm-up</h2>
      <p>
        Five questions from earlier lessons, about 8 minutes. Answers are saved, but they do not
        change your review schedule. {done} of {picked.length} answered.
      </p>
      {picked.map((q, i) => (
        <QuestionView
          key={q.id}
          question={q}
          showFeedback
          heading={`Warm-up ${i + 1} of ${picked.length}`}
          onSubmit={(r) => {
            setDone((n) => n + 1);
            try {
              recordAnswer(window.localStorage, new Date(), {
                id: q.id,
                correct: r.correct,
                confidence: r.confidence,
                source: 'warmup',
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
