import { describe, expect, it } from 'vitest';
import { addCustomCard, rateCard } from '../src/lib/srs/apply';
import {
  isDue,
  newSchedule,
  previewIntervals,
  review,
  toFsrsCard,
  toSchedule,
} from '../src/lib/srs/fsrs';
import { applyLapseRules, hasRecentLapses } from '../src/lib/srs/lapses';
import { buildQueue, doneToday, interleave, type ContentCard } from '../src/lib/srs/queue';
import {
  createDefault,
  load,
  update,
  type KeyValueStorage,
  type LearnerData,
} from '../src/lib/store/store';

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

// A fixed clock: every test passes `NOW` explicitly.
const NOW = new Date('2026-10-13T10:00:00.000Z');
const DAY = 24 * 60 * 60 * 1000;
const at = (offsetDays: number) => new Date(NOW.getTime() + offsetDays * DAY);

const card = (id: string, lesson: string): ContentCard => ({
  id,
  lesson,
  type: 'basic',
  competencies: ['py.values-names'],
  front: `front ${id}`,
  back: `back ${id}`,
});

function dataWithMastered(...lessons: string[]): LearnerData {
  const d = createDefault(NOW);
  for (const l of lessons) {
    d.lessons[l] = {
      updatedAt: NOW.toISOString(),
      status: 'mastered',
      masteryAttempts: [],
    };
  }
  return d;
}

describe('fsrs wrapper (fixed clock)', () => {
  it('a new card is due now and in the new state', () => {
    const s = newSchedule(NOW);
    expect(s.state).toBe('new');
    expect(isDue(s, NOW)).toBe(true);
  });

  it('Good on a new card moves into learning with a short step; Easy graduates to review', () => {
    const good = review(newSchedule(NOW), 3, NOW).schedule;
    expect(good.state).toBe('learning');
    expect(new Date(good.due).getTime() - NOW.getTime()).toBe(10 * 60 * 1000);
    const easy = review(newSchedule(NOW), 4, NOW).schedule;
    expect(easy.state).toBe('review');
    expect(new Date(easy.due).getTime()).toBeGreaterThan(NOW.getTime() + DAY);
  });

  it('is deterministic for the same inputs', () => {
    const a = review(newSchedule(NOW), 4, NOW).schedule;
    const b = review(newSchedule(NOW), 4, NOW).schedule;
    expect(a).toEqual(b);
  });

  it('Again on a review card is a lapse and relearns soon', () => {
    const graduated = review(newSchedule(NOW), 4, NOW).schedule;
    const later = new Date(graduated.due);
    const lapsed = review(graduated, 1, later).schedule;
    expect(lapsed.state).toBe('relearning');
    expect(lapsed.lapses).toBe(1);
    expect(new Date(lapsed.due).getTime() - later.getTime()).toBeLessThan(DAY);
  });

  it('later ratings give longer intervals (Hard < Good < Easy)', () => {
    const graduated = review(newSchedule(NOW), 4, NOW).schedule;
    const when = new Date(graduated.due);
    const p = previewIntervals(graduated, when);
    expect(p[2].days).toBeLessThanOrEqual(p[3].days);
    expect(p[3].days).toBeLessThan(p[4].days);
    expect(p[1].days).toBe(0);
  });

  it('round-trips through the boundary without storing deprecated fields', () => {
    const s = review(newSchedule(NOW), 3, NOW).schedule;
    expect(toSchedule(toFsrsCard(s))).toEqual(s);
    expect(Object.keys(s)).not.toContain('elapsed_days');
    expect(Object.keys(s)).not.toContain('scheduled_days');
  });
});

describe('queue', () => {
  it('only offers cards of mastered lessons', () => {
    const content = [card('a1', 'l1'), card('b1', 'l2')];
    const q = buildQueue({ content, data: dataWithMastered('l1'), now: NOW });
    expect(q.queue.map((c) => c.id)).toEqual(['a1']);
    expect(q.queue[0]?.isNew).toBe(true);
  });

  it('interleaves topics instead of finishing one lesson first', () => {
    const items = ['a1', 'a2', 'a3']
      .map((id) => ({ id, lesson: 'l1' }))
      .concat(['b1', 'b2'].map((id) => ({ id, lesson: 'l2' })));
    expect(interleave(items).map((i) => i.id)).toEqual(['a1', 'b1', 'a2', 'b2', 'a3']);
  });

  it('caps new cards per day (default 10) and counts what was done today', () => {
    const content = Array.from({ length: 14 }, (_, i) => card(`c${i}`, 'l1'));
    const data = dataWithMastered('l1');
    expect(buildQueue({ content, data, now: NOW }).queue).toHaveLength(10);
    expect(buildQueue({ content, data, now: NOW }).newAvailable).toBe(14);
  });

  it('caps reviews per day (default 30)', () => {
    const content = Array.from({ length: 40 }, (_, i) => card(`c${i}`, 'l1'));
    const data = dataWithMastered('l1');
    for (const c of content) {
      data.cards[c.id] = {
        updatedAt: NOW.toISOString(),
        state: { ...review(newSchedule(at(-10)), 4, at(-10)).schedule, due: at(-1).toISOString() },
      };
    }
    const q = buildQueue({ content, data, now: NOW });
    expect(q.dueTotal).toBe(40);
    expect(q.queue).toHaveLength(30);
  });

  it('excludes cards that are not due yet', () => {
    const content = [card('c1', 'l1')];
    const data = dataWithMastered('l1');
    data.cards['c1'] = {
      updatedAt: NOW.toISOString(),
      state: { ...review(newSchedule(NOW), 4, NOW).schedule },
    };
    expect(buildQueue({ content, data, now: NOW }).queue).toHaveLength(0);
    expect(buildQueue({ content, data, now: at(30) }).queue).toHaveLength(1);
  });

  it('counts a first-ever rating as a new card and later ratings as reviews', () => {
    const data = createDefault(NOW);
    data.reviewLog = [
      { cardId: 'x', at: at(-3).toISOString(), rating: 3 },
      { cardId: 'x', at: NOW.toISOString(), rating: 3 },
      { cardId: 'y', at: NOW.toISOString(), rating: 3 },
    ];
    expect(doneToday(data, NOW)).toEqual({ reviews: 1, newCards: 1 });
  });

  it('includes learner-made cards without needing a mastered lesson', () => {
    const s = new MemoryStorage();
    update(s, NOW, (d) => d);
    addCustomCard(s, NOW, {
      front: 'Why idempotent?',
      back: 'Safe to retry',
      competencies: ['api.idempotency'],
    });
    const r = load(s);
    expect(r.status).toBe('ok');
    if (r.status !== 'ok') return;
    const q = buildQueue({ content: [], data: r.data, now: NOW });
    expect(q.queue).toHaveLength(1);
    expect(q.queue[0]?.custom).toBe(true);
  });
});

describe('rating a card', () => {
  it('stores the schedule and the log entry, and never touches answers', () => {
    const s = new MemoryStorage();
    const item = { id: 'a1', schedule: newSchedule(NOW) };
    const d = rateCard(s, NOW, item, 3, () => 'l1');
    expect(d.cards['a1']?.state.state).toBe('learning');
    expect(d.reviewLog).toEqual([{ cardId: 'a1', at: NOW.toISOString(), rating: 3 }]);
    expect(d.answers).toEqual({});
  });
});

describe('lapse rules', () => {
  const log = (cardId: string, offsets: number[]) =>
    offsets.map((o) => ({ cardId, at: at(o).toISOString(), rating: 1 as const }));

  it('two Again ratings in the last 30 days count as recent lapses', () => {
    expect(hasRecentLapses('a', log('a', [-2, -1]), NOW)).toBe(true);
    expect(hasRecentLapses('a', log('a', [-1]), NOW)).toBe(false);
    expect(hasRecentLapses('a', log('a', [-40, -35]), NOW)).toBe(false);
  });

  it('a mastered lesson becomes needs-review at 3 lapsed cards, not 2', () => {
    const data = dataWithMastered('l1');
    for (const id of ['a', 'b', 'c']) {
      data.cards[id] = { updatedAt: NOW.toISOString(), state: newSchedule(NOW) };
    }
    data.reviewLog = [...log('a', [-2, -1]), ...log('b', [-2, -1])];
    expect(applyLapseRules(data, () => 'l1', NOW).lessons['l1']?.status).toBe('mastered');
    data.reviewLog = [...data.reviewLog, ...log('c', [-3, -1])];
    expect(applyLapseRules(data, () => 'l1', NOW).lessons['l1']?.status).toBe('needs-review');
  });

  it('keeps needs-review cards in the queue', () => {
    const data = dataWithMastered('l1');
    data.lessons['l1'] = {
      ...(data.lessons['l1'] as NonNullable<LearnerData['lessons'][string]>),
      status: 'needs-review',
    };
    expect(buildQueue({ content: [card('a', 'l1')], data, now: NOW }).queue).toHaveLength(1);
  });
});
