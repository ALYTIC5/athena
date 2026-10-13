import { update, type KeyValueStorage, type LearnerData } from '../store/store';
import { review, type RatingValue } from './fsrs';
import { applyLapseRules } from './lapses';
import type { QueueItem } from './queue';

/**
 * Rate a card: store the new schedule, append to the review log and re-check the lapse rules.
 * Warm-up answers never come through here, so they cannot change a schedule.
 */
export function rateCard(
  storage: KeyValueStorage,
  now: Date,
  card: Pick<QueueItem, 'id' | 'schedule'>,
  rating: RatingValue,
  lessonOfCard: (cardId: string) => string | undefined,
): LearnerData {
  return update(storage, now, (d) => {
    const at = now.toISOString();
    const { schedule } = review(card.schedule, rating, now);
    const existing = d.cards[card.id];
    const next: LearnerData = {
      ...d,
      cards: {
        ...d.cards,
        [card.id]: {
          updatedAt: at,
          state: schedule,
          ...(existing?.custom ? { custom: existing.custom } : {}),
        },
      },
      reviewLog: [...d.reviewLog, { cardId: card.id, at, rating }],
    };
    return applyLapseRules(next, lessonOfCard, now);
  });
}

/** Add a learner-made card (for example a gap from a mock interview). It is due immediately. */
export function addCustomCard(
  storage: KeyValueStorage,
  now: Date,
  card: { front: string; back: string; competencies: string[] },
): string {
  const id = `custom-${now.getTime().toString(36)}-${Math.floor(Math.random() * 1296).toString(36)}`;
  update(storage, now, (d) => ({
    ...d,
    cards: {
      ...d.cards,
      [id]: {
        updatedAt: now.toISOString(),
        state: {
          due: now.toISOString(),
          stability: 0,
          difficulty: 0,
          reps: 0,
          lapses: 0,
          state: 'new',
        },
        custom: card,
      },
    },
  }));
  return id;
}
