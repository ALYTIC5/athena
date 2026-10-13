import { describe, expect, it } from 'vitest';
import { exceptionName, expectedOutput } from '../src/lib/quiz/predict-truth';
import { recordAnswer, recordMasteryAttempt, usedMasteryIds } from '../src/lib/quiz/record';
import { load, type KeyValueStorage } from '../src/lib/store/store';

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

const T = new Date('2026-10-13T10:00:00.000Z');

describe('predict ground truth', () => {
  it('uses printed output when the code runs cleanly', () => {
    expect(expectedOutput('[1, 2, 3]\n', undefined)).toBe('[1, 2, 3]');
  });
  it('appends the exception type name on its own line', () => {
    const err =
      'Traceback (most recent call last):\n  File "<learner>", line 2, in <module>\nValueError: invalid literal for int()';
    expect(expectedOutput('a\n', err)).toBe('a\nValueError');
    expect(expectedOutput('', err)).toBe('ValueError');
  });
  it('finds the exception name in a trimmed traceback', () => {
    expect(exceptionName('TypeError: bad operand')).toBe('TypeError');
    expect(exceptionName('x\nKeyError: 3')).toBe('KeyError');
    expect(exceptionName('nothing here')).toBeUndefined();
  });
});

describe('recording answers', () => {
  it('appends attempts with confidence and source, and never touches cards', () => {
    const s = new MemoryStorage();
    recordAnswer(s, T, { id: 'q1', correct: true, confidence: 3, source: 'warmup' });
    recordAnswer(s, T, { id: 'q1', correct: false, source: 'check' });
    const r = load(s);
    expect(r.status).toBe('ok');
    if (r.status !== 'ok') return;
    expect(r.data.answers['q1']?.attempts).toHaveLength(2);
    expect(r.data.answers['q1']?.attempts[0]).toMatchObject({
      correct: true,
      confidence: 3,
      source: 'warmup',
    });
    expect(r.data.answers['q1']?.attempts[1]).not.toHaveProperty('confidence');
    expect(r.data.cards).toEqual({});
    expect(r.data.reviewLog).toEqual([]);
  });

  it('lists question ids already used in a mastery check', () => {
    const s = new MemoryStorage();
    recordAnswer(s, T, { id: 'a', correct: true, source: 'mastery' });
    recordAnswer(s, T, { id: 'b', correct: true, source: 'check' });
    const r = load(s);
    expect(r.status === 'ok' && [...usedMasteryIds(r.data)]).toEqual(['a']);
  });

  it('a failed mastery attempt keeps the lesson in progress; a pass marks it mastered', () => {
    const s = new MemoryStorage();
    recordMasteryAttempt(s, T, {
      lesson: 'py-01',
      score: 0.75,
      passed: false,
      missedCompetencies: ['x.y'],
    });
    let r = load(s);
    expect(r.status === 'ok' && r.data.lessons['py-01']?.status).toBe('in-progress');
    recordMasteryAttempt(s, T, { lesson: 'py-01', score: 1, passed: true, missedCompetencies: [] });
    r = load(s);
    expect(r.status === 'ok' && r.data.lessons['py-01']?.status).toBe('mastered');
    expect(r.status === 'ok' && r.data.lessons['py-01']?.masteryAttempts).toHaveLength(2);
    expect(r.status === 'ok' && r.data.lessons['py-01']?.masteredAt).toBeDefined();
  });

  it('a later failed attempt does not unmaster a mastered lesson', () => {
    const s = new MemoryStorage();
    recordMasteryAttempt(s, T, { lesson: 'py-01', score: 1, passed: true, missedCompetencies: [] });
    recordMasteryAttempt(s, T, {
      lesson: 'py-01',
      score: 0.5,
      passed: false,
      missedCompetencies: [],
    });
    const r = load(s);
    expect(r.status === 'ok' && r.data.lessons['py-01']?.status).toBe('mastered');
  });
});
