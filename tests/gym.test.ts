import { describe, expect, it } from 'vitest';
import {
  dueReattempts,
  nextReattempt,
  passedWithinLimit,
  recordGymAttempt,
} from '../src/lib/gym/attempts';
import { pickMixedSet } from '../src/lib/gym/mixed';
import { formatClock, limitMinutes, remainingMs, THINK_ALOUD_STEPS } from '../src/lib/gym/timer';
import { seededRng } from '../src/lib/quiz/selection';
import { createDefault, load, type KeyValueStorage } from '../src/lib/store/store';

class MemoryStorage implements KeyValueStorage {
  private map = new Map<string, string>();
  getItem(k: string) {
    return this.map.get(k) ?? null;
  }
  setItem(k: string, v: string) {
    this.map.set(k, v);
  }
  removeItem(k: string) {
    this.map.delete(k);
  }
}

const NOW = new Date('2026-10-14T10:00:00.000Z');
const DAY = 24 * 60 * 60 * 1000;

const attempt = (over: Record<string, unknown> = {}) => ({
  problemId: 'p1',
  mode: 'timed' as const,
  passed: false,
  durationMs: 1,
  hintsUsed: 0,
  checklist: [] as never[],
  ...over,
});

describe('timer', () => {
  it('counts down and never goes negative', () => {
    expect(remainingMs(1000, 20 * 60_000, 1000)).toBe(20 * 60_000);
    expect(remainingMs(1000, 60_000, 31_000)).toBe(30_000);
    expect(remainingMs(1000, 60_000, 999_000)).toBe(0);
  });
  it('formats mm:ss and rounds up partial seconds', () => {
    expect(formatClock(20 * 60_000)).toBe('20:00');
    expect(formatClock(61_000)).toBe('01:01');
    expect(formatClock(59_001)).toBe('01:00');
    expect(formatClock(0)).toBe('00:00');
  });
  it('gives 20 minutes for easy and 40 for medium', () => {
    expect(limitMinutes('easy')).toBe(20);
    expect(limitMinutes('medium')).toBe(40);
  });
  it('lists the seven think-aloud steps in order', () => {
    expect(THINK_ALOUD_STEPS.map((s) => s.id)).toEqual([
      'clarify',
      'examples',
      'brute-force',
      'optimise',
      'code',
      'test',
      'complexity',
    ]);
  });
});

describe('re-attempt queue', () => {
  it('a first pass schedules nothing; a first failure comes back tomorrow', () => {
    expect(nextReattempt(undefined, true, NOW)).toBeUndefined();
    const r = nextReattempt(undefined, false, NOW);
    expect(r && new Date(r.due).getTime() - NOW.getTime()).toBe(DAY);
  });

  it('records attempts, keeps a separate queue and lists what is due', () => {
    const s = new MemoryStorage();
    recordGymAttempt(s, NOW, attempt({ checklist: ['clarify', 'code'] }));
    const r = load(s);
    expect(r.status).toBe('ok');
    if (r.status !== 'ok') return;
    expect(r.data.gym['p1']?.attempts).toHaveLength(1);
    expect(r.data.gym['p1']?.attempts[0]?.checklist).toEqual(['clarify', 'code']);
    expect(dueReattempts(r.data, NOW)).toEqual([]);
    expect(dueReattempts(r.data, new Date(NOW.getTime() + 2 * DAY))).toEqual(['p1']);
    // The daily review queue is separate: no cards were created.
    expect(r.data.cards).toEqual({});
  });

  it('a pass on a re-attempt pushes the next one out; a failure keeps it within a day', () => {
    const s = new MemoryStorage();
    recordGymAttempt(s, NOW, attempt());
    const later = new Date(NOW.getTime() + 2 * DAY);
    const passed = recordGymAttempt(s, later, attempt({ mode: 'reattempt', passed: true }));
    const due = new Date(passed.gym['p1']?.reattempt?.due ?? '').getTime();
    expect(due).toBeGreaterThan(later.getTime() + DAY);
    const evenLater = new Date(due + DAY);
    const failed = recordGymAttempt(s, evenLater, attempt({ mode: 'reattempt' }));
    const due2 = new Date(failed.gym['p1']?.reattempt?.due ?? '').getTime();
    expect(due2 - evenLater.getTime()).toBeLessThanOrEqual(DAY);
  });

  it('counts unaided passes within the limit only', () => {
    expect(passedWithinLimit({ passed: true, durationMs: 19 * 60_000, hintsUsed: 0 }, 20)).toBe(
      true,
    );
    expect(passedWithinLimit({ passed: true, durationMs: 21 * 60_000, hintsUsed: 0 }, 20)).toBe(
      false,
    );
    expect(passedWithinLimit({ passed: true, durationMs: 1, hintsUsed: 1 }, 20)).toBe(false);
    expect(passedWithinLimit({ passed: false, durationMs: 1, hintsUsed: 0 }, 20)).toBe(false);
  });
});

describe('mixed sets', () => {
  const problems = ['hashing', 'hashing', 'stack', 'stack', 'trees'].map((pattern, i) => ({
    id: `p${i}`,
    pattern,
    difficulty: 'easy' as const,
  }));

  it('picks 1 to 3 problems from different patterns', () => {
    const set = pickMixedSet({ problems, data: null, count: 3, rng: seededRng(3) });
    expect(set).toHaveLength(3);
    expect(new Set(set.map((p) => p.pattern)).size).toBe(3);
    expect(pickMixedSet({ problems, data: null, count: 9, rng: seededRng(3) })).toHaveLength(3);
    expect(pickMixedSet({ problems, data: null, count: 0, rng: seededRng(3) })).toHaveLength(1);
  });

  it('prefers problems not yet passed', () => {
    const data = createDefault(NOW);
    for (const id of ['p0', 'p1', 'p2']) {
      data.gym[id] = {
        updatedAt: NOW.toISOString(),
        attempts: [
          {
            at: NOW.toISOString(),
            mode: 'timed',
            passed: true,
            durationMs: 1,
            hintsUsed: 0,
            checklist: [],
          },
        ],
      };
    }
    const set = pickMixedSet({ problems, data, count: 2, rng: seededRng(5) });
    expect(set.map((p) => p.id).sort()).toEqual(['p3', 'p4']);
  });
});
