import { useCallback, useEffect, useState } from 'react';
import {
  scoreQuestion,
  masteryPassed,
  masteryScore,
  MASTERY_PASS_FRACTION,
} from '../../lib/quiz/scoring';
import { loadPool } from '../../lib/quiz/pool-client';
import { recordAnswer, recordMasteryAttempt, usedMasteryIds } from '../../lib/quiz/record';
import {
  chunksForCompetencies,
  missedCompetencies,
  seededRng,
  selectMastery,
  selectMasteryExercise,
} from '../../lib/quiz/selection';
import type { Confidence, Question, QuizPool, Response } from '../../lib/quiz/types';
import { getSeed } from '../../lib/quiz/seed';
import { load } from '../../lib/store/store';
import { url } from '../../lib/url';
import { ExerciseIsland } from '../ExerciseIsland';
import { QuestionView } from './QuestionView';

interface MasteryExercise {
  id: string;
  kind: 'faded' | 'debug' | 'make' | 'write-tests';
  runtime: 'python' | 'sql';
  title: string;
  prompt: string;
  starter: string;
  visibleTests: string;
  timeoutMs: number;
  packages: string[];
  schema: string | null;
  extensions: string[];
}

interface Props {
  lesson: string;
  count: number;
}

interface Answered {
  question: Question;
  correct: boolean;
  confidence: Confidence;
  response: Response;
}

const EX_PREFIX = 'mastery-ex-';

function usedExerciseIds(): Set<string> {
  const stored = load(window.localStorage);
  const ids = new Set<string>();
  if (stored.status !== 'ok') return ids;
  for (const key of Object.keys(stored.data.answers)) {
    if (key.startsWith(EX_PREFIX)) ids.add(key.slice(EX_PREFIX.length));
  }
  return ids;
}

export function MasteryCheckIsland({ lesson, count }: Props) {
  const [pool, setPool] = useState<QuizPool | null>(null);
  const [exercises, setExercises] = useState<MasteryExercise[]>([]);
  const [error, setError] = useState('');
  const [phase, setPhase] = useState<'intro' | 'questions' | 'exercise' | 'result'>('intro');
  const [questions, setQuestions] = useState<Question[]>([]);
  const [exercise, setExercise] = useState<MasteryExercise | undefined>(undefined);
  const [fromEarlier, setFromEarlier] = useState(0);
  const [answers, setAnswers] = useState<Answered[]>([]);
  const [unaided, setUnaided] = useState(false);
  const [attemptNo, setAttemptNo] = useState(0);

  useEffect(() => {
    Promise.all([
      loadPool(),
      fetch(url(`data/mastery-exercises/${lesson}.json`)).then(async (r) =>
        r.ok ? ((await r.json()) as MasteryExercise[]) : [],
      ),
    ])
      .then(([p, ex]) => {
        setPool(p);
        setExercises(ex);
      })
      .catch((e: unknown) =>
        setError(e instanceof Error ? e.message : 'Could not load the check.'),
      );
  }, [lesson]);

  const start = useCallback(() => {
    if (!pool) return;
    const stored = load(window.localStorage);
    const exclude = stored.status === 'ok' ? usedMasteryIds(stored.data) : new Set<string>();
    const rng = seededRng((getSeed() ^ (attemptNo * 7919)) >>> 0);
    const sel = selectMastery({
      items: pool.items,
      lessons: pool.lessons,
      current: lesson,
      count,
      exclude,
      rng,
    });
    setQuestions(sel.questions);
    setFromEarlier(sel.fromEarlier);
    setExercise(selectMasteryExercise(exercises, usedExerciseIds(), rng));
    setAnswers([]);
    setUnaided(false);
    setPhase('questions');
  }, [pool, lesson, count, exercises, attemptNo]);

  const finish = () => {
    const results = answers.map((a) => ({ question: a.question, correct: a.correct }));
    const score = masteryScore(results);
    const exerciseOk = exercise ? unaided : true;
    const passed = masteryPassed(score, exerciseOk);
    try {
      recordMasteryAttempt(window.localStorage, new Date(), {
        lesson,
        score,
        passed,
        missedCompetencies: missedCompetencies(results),
      });
      if (exercise) {
        recordAnswer(window.localStorage, new Date(), {
          id: `${EX_PREFIX}${exercise.id}`,
          correct: unaided,
          source: 'mastery',
        });
      }
    } catch {
      // corrupt data: Settings shows the recovery screen
    }
    setPhase('result');
  };

  if (error) return <p role="alert">{error}</p>;
  if (!pool) return <p>Loading the mastery check…</p>;

  const results = answers.map((a) => ({ question: a.question, correct: a.correct }));
  const score = masteryScore(results);
  const exerciseOk = exercise ? unaided : true;
  const passed = masteryPassed(score, exerciseOk);
  const missed = missedCompetencies(results);
  const chunks = chunksForCompetencies(pool.items, lesson, missed);

  return (
    <section aria-labelledby={`mastery-${lesson}`} data-pagefind-ignore data-mastery={lesson}>
      <h2 id={`mastery-${lesson}`}>Mastery check</h2>

      {phase === 'intro' && (
        <div>
          <p>
            {count} questions and one make exercise. You pass with{' '}
            {Math.round(MASTERY_PASS_FRACTION * 100)}% or more and the exercise passed with no hints
            and no tutor. Feedback comes at the end.
          </p>
          <button type="button" onClick={start} data-testid="start-mastery">
            {attemptNo === 0 ? 'Start the check' : 'Retake with new questions'}
          </button>
        </div>
      )}

      {phase === 'questions' && (
        <div>
          <p>
            {answers.length} of {questions.length} answered
            {fromEarlier > 0 ? `, ${fromEarlier} from earlier lessons` : ''}.
          </p>
          {questions.map((q, i) => (
            <QuestionView
              key={q.id}
              question={q}
              showFeedback={false}
              heading={`Question ${i + 1} of ${questions.length}`}
              onSubmit={(r) => {
                setAnswers((a) => [...a, { question: q, ...r }]);
                try {
                  recordAnswer(window.localStorage, new Date(), {
                    id: q.id,
                    correct: r.correct,
                    confidence: r.confidence,
                    source: 'mastery',
                  });
                } catch {
                  // corrupt data: Settings shows the recovery screen
                }
              }}
            />
          ))}
          <button
            type="button"
            disabled={answers.length < questions.length}
            onClick={() => setPhase(exercise ? 'exercise' : 'result')}
            data-testid="to-exercise"
          >
            {exercise ? 'Continue to the make exercise' : 'See results'}
          </button>
          {answers.length < questions.length && (
            <p>
              <small>Answer every question to continue.</small>
            </p>
          )}
        </div>
      )}

      {phase === 'exercise' && exercise && (
        <div>
          <h3>Make exercise: {exercise.title}</h3>
          <p>Pass it with no hints and no tutor prompt. Use Check to submit.</p>
          <ExerciseIsland
            id={exercise.id}
            lessonTitle={exercise.title}
            kind={exercise.kind}
            runtime={exercise.runtime}
            schema={exercise.schema ?? undefined}
            extensions={exercise.extensions}
            promptText={exercise.prompt}
            starter={exercise.starter}
            visibleTests={exercise.visibleTests}
            timeoutMs={exercise.timeoutMs}
            packages={exercise.packages}
            dataUrl={url(`data/exercises/${exercise.id}.json`)}
            onChecked={(r) => setUnaided((prev) => prev || r.unaided)}
          />
          <p>
            <button type="button" onClick={finish} data-testid="finish-mastery">
              Finish the check
            </button>
          </p>
        </div>
      )}

      {phase === 'result' && (
        <div data-testid="mastery-result" data-passed={passed}>
          <h3>{passed ? 'Passed: lesson mastered' : 'Not passed yet'}</h3>
          <p>
            Score: {Math.round(score * 100)}% ({answers.filter((a) => a.correct).length} of{' '}
            {answers.length}).{' '}
            {exercise
              ? unaided
                ? 'Make exercise passed unaided.'
                : 'Make exercise not passed unaided.'
              : ''}
          </p>
          {!passed && missed.length > 0 && (
            <div>
              <p>Competencies to revisit: {missed.join(', ')}.</p>
              {chunks.length > 0 && (
                <ul>
                  {chunks.map((n) => (
                    <li key={n}>
                      <a href={`#chunk-${n}`}>Go back to chunk {n}</a>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
          <h4>Review</h4>
          <ol>
            {answers.map((a) => {
              const v = scoreQuestion(a.question, a.response);
              return (
                <li key={a.question.id} data-correct={a.correct}>
                  <strong>{a.correct ? 'Correct' : 'Incorrect'}.</strong>{' '}
                  {'stem' in a.question ? a.question.stem : a.question.type}
                  {v.explanation && <div>{v.explanation}</div>}
                </li>
              );
            })}
          </ol>
          {!passed && (
            <button
              type="button"
              onClick={() => {
                setAttemptNo((n) => n + 1);
                setPhase('intro');
              }}
            >
              Prepare a retake
            </button>
          )}
        </div>
      )}
    </section>
  );
}
