import {
  createEmptyCard,
  fsrs,
  generatorParameters,
  Rating,
  State,
  type Card as FsrsCard,
  type Grade,
} from 'ts-fsrs';

/** Desired retention 0.9 and default parameters (docs/SPEC.md §8). */
export const DESIRED_RETENTION = 0.9;

export type CardPhase = 'new' | 'learning' | 'review' | 'relearning';
export type RatingValue = 1 | 2 | 3 | 4;

/** Athena's own card schedule: ISO date strings, no fields the library has deprecated. */
export interface CardSchedule {
  due: string;
  stability: number;
  difficulty: number;
  reps: number;
  lapses: number;
  state: CardPhase;
  lastReview?: string | undefined;
  /** Position inside the learning or relearning steps. */
  learningSteps?: number | undefined;
}

const scheduler = fsrs(generatorParameters({ request_retention: DESIRED_RETENTION }));

const PHASE_TO_STATE: Record<CardPhase, State> = {
  new: State.New,
  learning: State.Learning,
  review: State.Review,
  relearning: State.Relearning,
};

const STATE_TO_PHASE: Record<number, CardPhase> = {
  [State.New]: 'new',
  [State.Learning]: 'learning',
  [State.Review]: 'review',
  [State.Relearning]: 'relearning',
};

const DAY_MS = 24 * 60 * 60 * 1000;

const wholeDaysBetween = (from: Date, to: Date) =>
  Math.max(0, Math.floor((to.getTime() - from.getTime()) / DAY_MS));

/** A brand-new card, due now. */
export function newSchedule(now: Date): CardSchedule {
  return toSchedule(createEmptyCard(now));
}

/** Convert at the library boundary: library card to Athena's schedule. */
export function toSchedule(card: FsrsCard): CardSchedule {
  return {
    due: card.due.toISOString(),
    stability: card.stability,
    difficulty: card.difficulty,
    reps: card.reps,
    lapses: card.lapses,
    state: STATE_TO_PHASE[card.state] ?? 'new',
    ...(card.last_review ? { lastReview: card.last_review.toISOString() } : {}),
    learningSteps: card.learning_steps,
  };
}

/** Convert at the library boundary: Athena's schedule to a library card. */
export function toFsrsCard(s: CardSchedule): FsrsCard {
  const due = new Date(s.due);
  const last = s.lastReview ? new Date(s.lastReview) : undefined;
  return {
    due,
    stability: s.stability,
    difficulty: s.difficulty,
    elapsed_days: last ? wholeDaysBetween(last, due) : 0,
    scheduled_days: last ? wholeDaysBetween(last, due) : 0,
    learning_steps: s.learningSteps ?? 0,
    reps: s.reps,
    lapses: s.lapses,
    state: PHASE_TO_STATE[s.state],
    ...(last ? { last_review: last } : {}),
  };
}

export interface ReviewOutcome {
  schedule: CardSchedule;
}

/** Apply a rating (1 Again, 2 Hard, 3 Good, 4 Easy) at `now`. Pure: the clock is passed in. */
export function review(s: CardSchedule, rating: RatingValue, now: Date): ReviewOutcome {
  const next = scheduler.next(toFsrsCard(s), now, rating as Grade);
  return { schedule: toSchedule(next.card) };
}

/** What each rating would do, for showing the next interval on the rating buttons. */
export function previewIntervals(
  s: CardSchedule,
  now: Date,
): Record<RatingValue, { due: string; days: number }> {
  const preview = scheduler.repeat(toFsrsCard(s), now);
  const out = {} as Record<RatingValue, { due: string; days: number }>;
  for (const rating of [Rating.Again, Rating.Hard, Rating.Good, Rating.Easy] as const) {
    const due = preview[rating].card.due;
    out[rating] = { due: due.toISOString(), days: wholeDaysBetween(now, due) };
  }
  return out;
}

export function isDue(s: CardSchedule, now: Date): boolean {
  return new Date(s.due).getTime() <= now.getTime();
}
