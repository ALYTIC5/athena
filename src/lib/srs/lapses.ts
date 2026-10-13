import type { LearnerData } from '../store/store';

const DAY_MS = 24 * 60 * 60 * 1000;

/** A card has "recent lapses" if it was rated Again twice in the last 30 days (SPEC §8). */
export const LAPSE_WINDOW_DAYS = 30;
export const LAPSES_FOR_RECENT = 2;
/** A mastered lesson needs review when this many of its cards have recent lapses. */
export const CARDS_FOR_NEEDS_REVIEW = 3;

export function hasRecentLapses(cardId: string, log: LearnerData['reviewLog'], now: Date): boolean {
  const since = now.getTime() - LAPSE_WINDOW_DAYS * DAY_MS;
  let again = 0;
  for (const entry of log) {
    if (entry.cardId === cardId && entry.rating === 1 && new Date(entry.at).getTime() >= since) {
      again += 1;
    }
  }
  return again >= LAPSES_FOR_RECENT;
}

/**
 * Mark mastered lessons as `needs-review` when 3 or more of their cards have recent lapses.
 * `lessonOfCard` maps a card id to its lesson (learner-made cards have none).
 */
export function applyLapseRules(
  data: LearnerData,
  lessonOfCard: (cardId: string) => string | undefined,
  now: Date,
): LearnerData {
  const lapsedByLesson = new Map<string, number>();
  for (const cardId of Object.keys(data.cards)) {
    const lesson = lessonOfCard(cardId);
    if (!lesson) continue;
    if (hasRecentLapses(cardId, data.reviewLog, now)) {
      lapsedByLesson.set(lesson, (lapsedByLesson.get(lesson) ?? 0) + 1);
    }
  }
  let changed = false;
  const lessons = { ...data.lessons };
  for (const [lesson, count] of lapsedByLesson) {
    const rec = lessons[lesson];
    if (rec?.status === 'mastered' && count >= CARDS_FOR_NEEDS_REVIEW) {
      lessons[lesson] = { ...rec, status: 'needs-review', updatedAt: now.toISOString() };
      changed = true;
    }
  }
  return changed ? { ...data, lessons } : data;
}
