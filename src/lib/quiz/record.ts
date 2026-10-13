import { update, type KeyValueStorage, type LearnerData } from '../store/store';
import type { Confidence } from './types';

export type AnswerSource = 'check' | 'warmup' | 'mastery';

/** Append an answer attempt. Warm-up answers are recorded but never touch card schedules. */
export function recordAnswer(
  storage: KeyValueStorage,
  now: Date,
  args: { id: string; correct: boolean; confidence?: Confidence | undefined; source: AnswerSource },
): LearnerData {
  return update(storage, now, (d) => {
    const at = now.toISOString();
    const prev = d.answers[args.id];
    return {
      ...d,
      answers: {
        ...d.answers,
        [args.id]: {
          updatedAt: at,
          attempts: [
            ...(prev?.attempts ?? []),
            {
              at,
              correct: args.correct,
              ...(args.confidence === undefined ? {} : { confidence: args.confidence }),
              source: args.source,
            },
          ],
        },
      },
    };
  });
}

/** Ids of questions already answered in a mastery check, to avoid them on a retake. */
export function usedMasteryIds(data: LearnerData): Set<string> {
  const used = new Set<string>();
  for (const [id, rec] of Object.entries(data.answers)) {
    if (rec.attempts.some((a) => a.source === 'mastery')) used.add(id);
  }
  return used;
}

/** Record a finished mastery attempt; a pass marks the lesson mastered. */
export function recordMasteryAttempt(
  storage: KeyValueStorage,
  now: Date,
  args: { lesson: string; score: number; passed: boolean; missedCompetencies: string[] },
): LearnerData {
  return update(storage, now, (d) => {
    const at = now.toISOString();
    const prev = d.lessons[args.lesson];
    const status: LearnerData['lessons'][string]['status'] = args.passed
      ? 'mastered'
      : prev?.status === 'mastered'
        ? 'mastered'
        : 'in-progress';
    return {
      ...d,
      lessons: {
        ...d.lessons,
        [args.lesson]: {
          updatedAt: at,
          status,
          ...(prev?.startedAt ? { startedAt: prev.startedAt } : { startedAt: at }),
          ...(args.passed
            ? { masteredAt: at }
            : prev?.masteredAt
              ? { masteredAt: prev.masteredAt }
              : {}),
          masteryAttempts: [
            ...(prev?.masteryAttempts ?? []),
            {
              at,
              score: args.score,
              passed: args.passed,
              missedCompetencies: args.missedCompetencies,
            },
          ],
        },
      },
    };
  });
}
