import { describe, expect, it } from 'vitest';
import {
  chunksForCompetencies,
  competencyAccuracy,
  earlierLessonIds,
  missedCompetencies,
  selectMastery,
  selectMasteryExercise,
  selectWarmUp,
  seededRng,
} from '../src/lib/quiz/selection';
import {
  masteryPassed,
  masteryScore,
  normaliseOutput,
  scoreQuestion,
} from '../src/lib/quiz/scoring';
import type { LessonOrder, Question } from '../src/lib/quiz/types';

const base = (id: string, lesson: string, over: Partial<Question> = {}) =>
  ({
    id,
    lesson,
    pools: ['check', 'mastery', 'warmup'],
    competencies: ['py.values-names'],
    ...over,
  }) as const;

const single = (id: string, lesson: string, over: Record<string, unknown> = {}): Question =>
  ({
    ...base(id, lesson),
    type: 'single',
    stem: 's',
    options: [
      { text: 'a', correct: false, why: 'Not a.' },
      { text: 'b', correct: true, why: 'Because b.' },
    ],
    ...over,
  }) as Question;

const lessons: LessonOrder[] = [
  { id: 'l1', order: 0, week: 1 },
  { id: 'l2', order: 1, week: 2 },
  { id: 'l3', order: 2, week: 3 },
];

describe('scoring', () => {
  it('single choice: explains the chosen and the right option', () => {
    const q = single('q', 'l1');
    expect(scoreQuestion(q, { type: 'single', selected: 1 })).toEqual({
      correct: true,
      explanation: 'Because b.',
    });
    const wrong = scoreQuestion(q, { type: 'single', selected: 0 });
    expect(wrong.correct).toBe(false);
    expect(wrong.explanation).toBe('Not a. Because b.');
    expect(scoreQuestion(q, { type: 'single', selected: null }).correct).toBe(false);
  });

  it('multiple choice needs exactly the right set', () => {
    const q = {
      ...base('m', 'l1'),
      type: 'multiple',
      stem: 's',
      options: [
        { text: 'a', correct: true, why: '' },
        { text: 'b', correct: false, why: '' },
        { text: 'c', correct: true, why: '' },
      ],
    } as Question;
    expect(scoreQuestion(q, { type: 'multiple', selected: [2, 0] }).correct).toBe(true);
    expect(scoreQuestion(q, { type: 'multiple', selected: [0] }).correct).toBe(false);
    expect(scoreQuestion(q, { type: 'multiple', selected: [0, 1, 2] }).correct).toBe(false);
  });

  it('short answer ignores case and spacing, and supports patterns', () => {
    const q = {
      ...base('s', 'l1'),
      type: 'short',
      stem: 's',
      accepted: ['is not'],
      patterns: ['^idempot'],
      explanation: 'why',
    } as Question;
    expect(scoreQuestion(q, { type: 'short', text: '  IS   Not ' }).correct).toBe(true);
    expect(scoreQuestion(q, { type: 'short', text: 'Idempotent' }).correct).toBe(true);
    expect(scoreQuestion(q, { type: 'short', text: 'is' }).correct).toBe(false);
  });

  it('predict ignores trailing whitespace only', () => {
    const q = {
      ...base('p', 'l1'),
      type: 'predict',
      code: 'x',
      investigate: [],
      expected: '[1, 2]\n',
    } as Question;
    expect(scoreQuestion(q, { type: 'predict', text: '[1, 2]  ' }).correct).toBe(true);
    expect(scoreQuestion(q, { type: 'predict', text: '[1,2]' }).correct).toBe(false);
    expect(normaliseOutput('a  \nb \n\n')).toBe('a\nb');
  });

  it('parsons checks order and indentation, and rejects distractors', () => {
    const q = {
      ...base('pa', 'l1'),
      type: 'parsons',
      lines: ['def f(x):', '    if x:', '        return 1', '    return 0'],
      distractors: ['    pass'],
    } as Question;
    const good = [
      { text: 'def f(x):', indent: 0 },
      { text: 'if x:', indent: 1 },
      { text: 'return 1', indent: 2 },
      { text: 'return 0', indent: 1 },
    ];
    expect(scoreQuestion(q, { type: 'parsons', lines: good }).correct).toBe(true);
    const wrongIndent = good.map((l, i) => (i === 3 ? { ...l, indent: 2 } : l));
    expect(scoreQuestion(q, { type: 'parsons', lines: wrongIndent }).correct).toBe(false);
    const withDistractor = [...good, { text: 'pass', indent: 1 }];
    expect(scoreQuestion(q, { type: 'parsons', lines: withDistractor }).correct).toBe(false);
  });

  it('bug and order', () => {
    const bug = {
      ...base('b', 'l1'),
      type: 'bug',
      code: 'a\nb',
      buggyLine: 2,
      explanation: 'e',
    } as Question;
    expect(scoreQuestion(bug, { type: 'bug', line: 2 }).correct).toBe(true);
    expect(scoreQuestion(bug, { type: 'bug', line: 1 }).correct).toBe(false);
    const order = {
      ...base('o', 'l1'),
      type: 'order',
      stem: 's',
      steps: ['a', 'b', 'c'],
    } as Question;
    expect(scoreQuestion(order, { type: 'order', steps: ['a', 'b', 'c'] }).correct).toBe(true);
    expect(scoreQuestion(order, { type: 'order', steps: ['b', 'a', 'c'] }).correct).toBe(false);
  });

  it('mastery needs 80% and an unaided make exercise', () => {
    expect(
      masteryScore([
        { correct: true },
        { correct: true },
        { correct: true },
        { correct: true },
        { correct: false },
      ]),
    ).toBe(0.8);
    expect(masteryPassed(0.8, true)).toBe(true);
    expect(masteryPassed(0.79, true)).toBe(false);
    expect(masteryPassed(1, false)).toBe(false);
    expect(masteryScore([])).toBe(0);
  });
});

describe('selection', () => {
  const rng = () => seededRng(42);
  const many = (lesson: string, n: number, over: Record<string, unknown> = {}) =>
    Array.from({ length: n }, (_, i) =>
      single(`${lesson}-q${i}`, lesson, { objective: (i % 3) + 1, ...over }),
    );

  it('knows which lessons come earlier', () => {
    expect([...earlierLessonIds(lessons, 'l3')].sort()).toEqual(['l1', 'l2']);
    expect(earlierLessonIds(lessons, 'l1').size).toBe(0);
    expect(earlierLessonIds(lessons, 'missing').size).toBe(0);
  });

  it('warm-up draws from earlier lessons only and skips when too few', () => {
    const items = [...many('l1', 4), ...many('l2', 4), ...many('l3', 6)];
    const picked = selectWarmUp({ items, lessons, current: 'l3', accuracy: new Map(), rng: rng() });
    expect(picked).toHaveLength(5);
    expect(picked?.every((q) => q.lesson !== 'l3')).toBe(true);
    expect(new Set(picked?.map((q) => q.id)).size).toBe(5);
    expect(
      selectWarmUp({
        items: many('l1', 4),
        lessons,
        current: 'l2',
        accuracy: new Map(),
        rng: rng(),
      }),
    ).toBeNull();
    expect(
      selectWarmUp({
        items: many('l1', 9),
        lessons,
        current: 'l1',
        accuracy: new Map(),
        rng: rng(),
      }),
    ).toBeNull();
  });

  it('warm-up favours weak competencies', () => {
    const weak = many('l1', 20, { competencies: ['py.mutability'] });
    const strong = many('l2', 20, { competencies: ['py.functions'] });
    const accuracy = new Map([
      ['py.mutability', 0.2],
      ['py.functions', 0.95],
    ]);
    let weakCount = 0;
    for (let seed = 1; seed <= 40; seed++) {
      const picked = selectWarmUp({
        items: [...weak, ...strong],
        lessons,
        current: 'l3',
        accuracy,
        rng: seededRng(seed),
      });
      weakCount += picked?.filter((q) => q.competencies.includes('py.mutability')).length ?? 0;
    }
    expect(weakCount / 200).toBeGreaterThan(0.6);
  });

  it('computes competency accuracy from past answers', () => {
    const qs = [
      single('a', 'l1', { competencies: ['x.y'] }),
      single('b', 'l1', { competencies: ['x.y'] }),
    ];
    const acc = competencyAccuracy(qs, {
      a: { attempts: [{ correct: true }] },
      b: { attempts: [{ correct: false }] },
    });
    expect(acc.get('x.y')).toBe(0.5);
    expect(competencyAccuracy(qs, {}).has('x.y')).toBe(false);
  });

  it('mastery interleaves 30% from earlier lessons once they supply 8 mastery items', () => {
    const items = [...many('l1', 8), ...many('l2', 24)];
    const sel = selectMastery({
      items,
      lessons,
      current: 'l2',
      count: 10,
      exclude: new Set(),
      rng: rng(),
    });
    expect(sel.questions).toHaveLength(10);
    expect(sel.fromEarlier).toBe(3);
    expect(sel.questions.filter((q) => q.lesson === 'l1')).toHaveLength(3);
  });

  it('mastery does not interleave before earlier lessons supply 8 items', () => {
    const items = [...many('l1', 7), ...many('l2', 24)];
    const sel = selectMastery({
      items,
      lessons,
      current: 'l2',
      count: 8,
      exclude: new Set(),
      rng: rng(),
    });
    expect(sel.fromEarlier).toBe(0);
    expect(sel.questions.every((q) => q.lesson === 'l2')).toBe(true);
  });

  it('mastery covers every objective when possible', () => {
    const items = many('l1', 24);
    const sel = selectMastery({
      items,
      lessons,
      current: 'l1',
      count: 8,
      exclude: new Set(),
      rng: rng(),
    });
    expect(new Set(sel.questions.map((q) => q.objective))).toEqual(new Set([1, 2, 3]));
  });

  it('a retake draws different questions when the pool allows', () => {
    const items = many('l1', 24);
    const first = selectMastery({
      items,
      lessons,
      current: 'l1',
      count: 8,
      exclude: new Set(),
      rng: rng(),
    });
    const used = new Set(first.questions.map((q) => q.id));
    const second = selectMastery({
      items,
      lessons,
      current: 'l1',
      count: 8,
      exclude: used,
      rng: seededRng(7),
    });
    expect(second.questions.filter((q) => used.has(q.id))).toHaveLength(0);
  });

  it('a retake picks a different mastery exercise', () => {
    const ex = [{ id: 'e1' }, { id: 'e2' }];
    expect(selectMasteryExercise(ex, new Set(['e1']), rng())?.id).toBe('e2');
    expect(selectMasteryExercise(ex, new Set(['e1', 'e2']), rng())).toBeDefined();
    expect(selectMasteryExercise([], new Set(), rng())).toBeUndefined();
  });

  it('routes missed competencies to chunks of the same lesson', () => {
    const qs = [
      single('a', 'l1', { chunk: 1, competencies: ['x.a'] }),
      single('b', 'l1', { chunk: 2, competencies: ['x.b'] }),
      single('c', 'l2', { chunk: 5, competencies: ['x.a'] }),
      single('d', 'l1', { chunk: 3, competencies: ['x.a'], pools: ['mastery'] }),
    ];
    const missed = missedCompetencies([
      { question: qs[0] as Question, correct: false },
      { question: qs[1] as Question, correct: true },
    ]);
    expect(missed).toEqual(['x.a']);
    expect(chunksForCompetencies(qs, 'l1', missed)).toEqual([1]);
  });
});
