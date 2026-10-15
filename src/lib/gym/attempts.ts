import { review, type CardSchedule } from '../srs/fsrs';
import { update, type KeyValueStorage, type LearnerData } from '../store/store';
import type { ThinkAloudId } from './timer';

export type GymMode = 'approach' | 'timed' | 'mixed' | 'reattempt';
type GymRecord = LearnerData['gym'][string];
type Reattempt = NonNullable<GymRecord['reattempt']>;

const DAY_MS = 24 * 60 * 60 * 1000;

export interface AttemptInput {
  problemId: string;
  mode: GymMode;
  passed: boolean;
  durationMs: number;
  hintsUsed: number;
  checklist: ThinkAloudId[];
  communication?: 1 | 2 | 3 | 4 | 5 | undefined;
}

/**
 * Failed problems return in the Gym queue, scheduled with ts-fsrs, separate from the daily
 * Review queue and its caps. A first pass schedules nothing; a first failure comes back tomorrow.
 */
export function nextReattempt(
  prev: GymRecord | undefined,
  passed: boolean,
  now: Date,
): Reattempt | undefined {
  const existing = prev?.reattempt;
  if (!existing) {
    if (passed) return undefined;
    return {
      due: new Date(now.getTime() + DAY_MS).toISOString(),
      stability: 1,
      difficulty: 5,
      reps: 1,
      lapses: 1,
    };
  }
  const lastAt = prev?.attempts.at(-1)?.at ?? new Date(now.getTime() - DAY_MS).toISOString();
  const schedule: CardSchedule = {
    due: existing.due,
    stability: existing.stability,
    difficulty: existing.difficulty,
    reps: existing.reps,
    lapses: existing.lapses,
    state: 'review',
    lastReview: lastAt,
    learningSteps: 0,
  };
  const next = review(schedule, passed ? 3 : 1, now).schedule;
  // A failure always comes back within a day; a pass pushes it out.
  const due = passed
    ? next.due
    : new Date(Math.min(new Date(next.due).getTime(), now.getTime() + DAY_MS)).toISOString();
  return {
    due,
    stability: next.stability,
    difficulty: next.difficulty,
    reps: next.reps,
    lapses: next.lapses,
  };
}

export function recordGymAttempt(
  storage: KeyValueStorage,
  now: Date,
  a: AttemptInput,
): LearnerData {
  return update(storage, now, (d) => {
    const at = now.toISOString();
    const prev = d.gym[a.problemId];
    const reattempt = nextReattempt(prev, a.passed, now);
    return {
      ...d,
      gym: {
        ...d.gym,
        [a.problemId]: {
          updatedAt: at,
          attempts: [
            ...(prev?.attempts ?? []),
            {
              at,
              mode: a.mode,
              passed: a.passed,
              durationMs: a.durationMs,
              hintsUsed: a.hintsUsed,
              checklist: a.checklist,
              ...(a.communication === undefined ? {} : { communication: a.communication }),
            },
          ],
          ...(reattempt ? { reattempt } : {}),
        },
      },
    };
  });
}

export function dueReattempts(data: LearnerData, now: Date): string[] {
  return Object.entries(data.gym)
    .filter(([, rec]) => rec.reattempt && new Date(rec.reattempt.due).getTime() <= now.getTime())
    .sort(([, a], [, b]) => (a.reattempt?.due ?? '').localeCompare(b.reattempt?.due ?? ''))
    .map(([id]) => id);
}

/** Passed unaided within the time limit (used by interview competency levels). */
export function passedWithinLimit(
  attempt: { passed: boolean; durationMs: number; hintsUsed: number },
  limitMinutes: number,
): boolean {
  return attempt.passed && attempt.hintsUsed === 0 && attempt.durationMs <= limitMinutes * 60_000;
}

/** Self-rate how well you communicated (1 to 5) on the most recent attempt at a problem. */
export function rateCommunication(
  storage: KeyValueStorage,
  now: Date,
  problemId: string,
  score: 1 | 2 | 3 | 4 | 5,
): LearnerData {
  return update(storage, now, (d) => {
    const rec = d.gym[problemId];
    if (!rec || rec.attempts.length === 0) return d;
    const attempts = rec.attempts.map((a, i) =>
      i === rec.attempts.length - 1 ? { ...a, communication: score } : a,
    );
    return {
      ...d,
      gym: { ...d.gym, [problemId]: { ...rec, attempts, updatedAt: now.toISOString() } },
    };
  });
}
