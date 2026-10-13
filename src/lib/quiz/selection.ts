import type { LessonOrder, Question, QuestionPool } from './types';

export type Rng = () => number;

/** Small seeded generator (mulberry32) so selection is testable. */
export function seededRng(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function shuffle<T>(items: readonly T[], rng: Rng): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j] as T, out[i] as T];
  }
  return out;
}

export function inPool(q: Question, pool: QuestionPool): boolean {
  return q.pools.includes(pool);
}

/** Ids of lessons that come before `current` in the course. */
export function earlierLessonIds(lessons: LessonOrder[], current: string): Set<string> {
  const cur = lessons.find((l) => l.id === current);
  if (!cur) return new Set();
  return new Set(lessons.filter((l) => l.order < cur.order).map((l) => l.id));
}

/** Accuracy per competency from past answers (0 to 1). Missing means no evidence. */
export function competencyAccuracy(
  questions: Question[],
  answers: Record<string, { attempts: { correct: boolean }[] }>,
): Map<string, number> {
  const tally = new Map<string, { right: number; total: number }>();
  for (const q of questions) {
    const attempts = answers[q.id]?.attempts ?? [];
    for (const comp of q.competencies) {
      const t = tally.get(comp) ?? { right: 0, total: 0 };
      for (const a of attempts) {
        t.total += 1;
        if (a.correct) t.right += 1;
      }
      tally.set(comp, t);
    }
  }
  const out = new Map<string, number>();
  for (const [comp, t] of tally) if (t.total > 0) out.set(comp, t.right / t.total);
  return out;
}

export const WARMUP_COUNT = 5;
const WEAK_BELOW = 0.7;

/**
 * Warm-up: `count` items drawn from earlier lessons' warm-up pools, weighted towards weak
 * competencies. Returns null when fewer than `count` items exist (the warm-up is skipped).
 */
export function selectWarmUp(args: {
  items: Question[];
  lessons: LessonOrder[];
  current: string;
  accuracy: Map<string, number>;
  rng: Rng;
  count?: number;
}): Question[] | null {
  const count = args.count ?? WARMUP_COUNT;
  const earlier = earlierLessonIds(args.lessons, args.current);
  const candidates = args.items.filter((q) => earlier.has(q.lesson) && inPool(q, 'warmup'));
  if (candidates.length < count) return null;

  const weight = (q: Question) => {
    const weakness = Math.max(
      0,
      ...q.competencies.map((c) => {
        const acc = args.accuracy.get(c);
        return acc === undefined ? 0 : acc < WEAK_BELOW ? 2 : 0;
      }),
    );
    return 1 + weakness;
  };

  const pool = [...candidates];
  const picked: Question[] = [];
  while (picked.length < count && pool.length > 0) {
    const total = pool.reduce((s, q) => s + weight(q), 0);
    let r = args.rng() * total;
    let idx = 0;
    for (; idx < pool.length - 1; idx++) {
      r -= weight(pool[idx] as Question);
      if (r < 0) break;
    }
    picked.push(pool.splice(idx, 1)[0] as Question);
  }
  return picked;
}

/** At least 30% of a check comes from earlier lessons once they supply 8 or more mastery items. */
export const INTERLEAVE_FRACTION = 0.3;
export const INTERLEAVE_MIN_EARLIER = 8;

export interface MasterySelection {
  questions: Question[];
  fromEarlier: number;
}

export function selectMastery(args: {
  items: Question[];
  lessons: LessonOrder[];
  current: string;
  count: number;
  /** Question ids already used in a previous attempt; avoided when the pool allows. */
  exclude: ReadonlySet<string>;
  rng: Rng;
}): MasterySelection {
  const earlier = earlierLessonIds(args.lessons, args.current);
  const own = args.items.filter((q) => q.lesson === args.current && inPool(q, 'mastery'));
  const prior = args.items.filter((q) => earlier.has(q.lesson) && inPool(q, 'mastery'));

  const fresh = (list: Question[]) => {
    const unused = list.filter((q) => !args.exclude.has(q.id));
    return shuffle(unused, args.rng).concat(
      shuffle(
        list.filter((q) => args.exclude.has(q.id)),
        args.rng,
      ),
    );
  };

  const wantEarlier =
    prior.length >= INTERLEAVE_MIN_EARLIER ? Math.ceil(args.count * INTERLEAVE_FRACTION) : 0;
  const earlierPicks = fresh(prior).slice(0, wantEarlier);

  // Cover every objective of this lesson first, then fill from the rest of its pool.
  const ownOrdered = fresh(own);
  const chosen: Question[] = [];
  const objectives = [
    ...new Set(own.map((q) => q.objective).filter((o): o is number => o !== undefined)),
  ];
  for (const obj of shuffle(objectives, args.rng)) {
    if (chosen.length >= args.count - earlierPicks.length) break;
    const q = ownOrdered.find((x) => x.objective === obj && !chosen.includes(x));
    if (q) chosen.push(q);
  }
  for (const q of ownOrdered) {
    if (chosen.length >= args.count - earlierPicks.length) break;
    if (!chosen.includes(q)) chosen.push(q);
  }
  const questions = shuffle([...chosen, ...earlierPicks], args.rng);
  return { questions, fromEarlier: earlierPicks.length };
}

export interface MasteryExerciseRef {
  id: string;
}

/** Pick a mastery make exercise, avoiding ones used before when another exists. */
export function selectMasteryExercise<T extends MasteryExerciseRef>(
  exercises: T[],
  exclude: ReadonlySet<string>,
  rng: Rng,
): T | undefined {
  const unused = exercises.filter((e) => !exclude.has(e.id));
  const list = unused.length > 0 ? unused : exercises;
  return shuffle(list, rng)[0];
}

/** Competencies of the questions answered wrongly, without duplicates. */
export function missedCompetencies(results: { question: Question; correct: boolean }[]): string[] {
  return [...new Set(results.filter((r) => !r.correct).flatMap((r) => r.question.competencies))];
}

/** Chunks (1-based) of this lesson's check items that teach the missed competencies. */
export function chunksForCompetencies(
  items: Question[],
  lesson: string,
  missed: readonly string[],
): number[] {
  const chunks = new Set<number>();
  for (const q of items) {
    if (q.lesson !== lesson || q.chunk === undefined || !inPool(q, 'check')) continue;
    if (q.competencies.some((c) => missed.includes(c))) chunks.add(q.chunk);
  }
  return [...chunks].sort((a, b) => a - b);
}
