import { seededRng, shuffle, type Rng } from '../quiz/selection';
import type { LearnerData } from '../store/store';

export interface ProblemRef {
  id: string;
  pattern: string;
  difficulty: 'easy' | 'medium';
}

/**
 * A mixed set: one to three problems with the pattern hidden until after the attempt. Prefers
 * problems the learner has not passed, and different patterns within one set.
 */
export function pickMixedSet(args: {
  problems: ProblemRef[];
  data: LearnerData | null;
  count: number;
  rng?: Rng;
}): ProblemRef[] {
  const rng = args.rng ?? seededRng(Date.now() >>> 0);
  const count = Math.min(3, Math.max(1, args.count));
  const passed = (id: string) => args.data?.gym[id]?.attempts.some((a) => a.passed) ?? false;
  const unpassed = shuffle(
    args.problems.filter((p) => !passed(p.id)),
    rng,
  );
  const pool = unpassed.length >= count ? unpassed : shuffle(args.problems, rng);
  const picked: ProblemRef[] = [];
  const patterns = new Set<string>();
  for (const p of pool) {
    if (picked.length >= count) break;
    if (!patterns.has(p.pattern)) {
      picked.push(p);
      patterns.add(p.pattern);
    }
  }
  for (const p of pool) {
    if (picked.length >= count) break;
    if (!picked.includes(p)) picked.push(p);
  }
  return picked;
}
