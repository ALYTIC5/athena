import { url } from '../url';
import type { QuizPool } from './types';

let cached: Promise<QuizPool> | undefined;

/** Question pools come from build-time JSON, never from component props. */
export function loadPool(): Promise<QuizPool> {
  cached ??= fetch(url('data/quiz-pool.json')).then(async (res) => {
    if (!res.ok) throw new Error('Could not load the questions.');
    return (await res.json()) as QuizPool;
  });
  cached.catch(() => {
    cached = undefined;
  });
  return cached;
}
