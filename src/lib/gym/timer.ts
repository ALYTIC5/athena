export const EASY_MINUTES = 20;
export const MEDIUM_MINUTES = 40;
export const STAR_SECONDS = 120;

export const THINK_ALOUD_STEPS = [
  { id: 'clarify', label: 'Clarify the problem' },
  { id: 'examples', label: 'Work through examples' },
  { id: 'brute-force', label: 'Say the brute-force approach' },
  { id: 'optimise', label: 'Optimise it' },
  { id: 'code', label: 'Write the code' },
  { id: 'test', label: 'Test it' },
  { id: 'complexity', label: 'State the complexity' },
] as const;

export type ThinkAloudId = (typeof THINK_ALOUD_STEPS)[number]['id'];

/** Milliseconds left on a countdown that started at `startedAt` (never below zero). */
export function remainingMs(startedAt: number, limitMs: number, now: number): number {
  return Math.max(0, limitMs - (now - startedAt));
}

export function formatClock(ms: number): string {
  const total = Math.ceil(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

/** An easy problem gets 20 minutes and a medium one 40 (SPEC section 9). */
export function limitMinutes(difficulty: 'easy' | 'medium'): number {
  return difficulty === 'easy' ? EASY_MINUTES : MEDIUM_MINUTES;
}
