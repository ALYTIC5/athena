import { describe, expect, it } from 'vitest';
import { computeCompetency } from '../src/lib/competency/levels';
import type { CompetencyDef, ContentIndex } from '../src/lib/competency/types';
import { createDefault, type LearnerData } from '../src/lib/store/store';

const NOW = new Date('2026-10-15T12:00:00.000Z');
const iso = (offsetDays: number) => new Date(NOW.getTime() + offsetDays * 86_400_000).toISOString();
const C = 'py.sets';

const browser: CompetencyDef = {
  id: C,
  track: 'py',
  title: 'Sets',
  evidence: 'browser',
  core: true,
};
const local: CompetencyDef = {
  id: 'git.branching',
  track: 'git',
  title: 'Branches',
  evidence: 'local',
  core: true,
};
const interview = (id: string): CompetencyDef => ({
  id,
  track: 'int',
  title: id,
  evidence: 'interview',
  core: true,
});

const index: ContentIndex = {
  questions: [
    { id: 'q1', lesson: 'l1', competencies: [C] },
    { id: 'q2', lesson: 'l1', competencies: [C] },
    { id: 'g1', lesson: 'l2', competencies: ['git.branching'] },
  ],
  exercises: [
    { id: 'faded', lesson: 'l1', kind: 'faded', competencies: [C] },
    { id: 'make', lesson: 'l1', kind: 'make', competencies: [C] },
    { id: 'debug', lesson: 'l1', kind: 'debug', competencies: [C] },
  ],
  cards: [
    { id: 'ex-card', lesson: 'l1', type: 'explain', competencies: [C] },
    { id: 'basic-card', lesson: 'l1', type: 'basic', competencies: [C] },
  ],
  problems: [
    { id: 'p1', competencies: ['int.hashing'], timeLimitMin: 20 },
    { id: 'p2', competencies: ['int.hashing'], timeLimitMin: 20 },
  ],
  drills: [
    { id: 'cr', kind: 'code-reading', competencies: ['int.code-reading', C], timeLimitMin: 30 },
    { id: 'ai', kind: 'ai-assisted', competencies: ['int.ai-assisted'], timeLimitMin: 30 },
  ],
  practice: [
    { id: 'chk', lesson: 'l2', kind: 'checklist', competencies: ['git.branching'], steps: 2 },
  ],
  lessons: [{ id: 'l2', labMilestones: ['wa-m1'] }],
};

const fresh = (): LearnerData => createDefault(NOW);
const ex = (
  d: LearnerData,
  id: string,
  a: Partial<LearnerData['exercises'][string]['attempts'][number]> = {},
) => {
  d.exercises[id] = {
    updatedAt: iso(0),
    bestCredit: 1,
    attempts: [
      {
        at: iso(0),
        passed: true,
        hintsUsed: 0,
        tutorUsed: false,
        solutionViewed: false,
        durationMs: 1000,
        ...a,
      },
    ],
  };
};
const answer = (
  d: LearnerData,
  id: string,
  correct: boolean,
  confidence?: 1 | 2 | 3 | 4,
  offset = 0,
) => {
  d.answers[id] = {
    updatedAt: iso(0),
    attempts: [
      { at: iso(offset), correct, source: 'check', ...(confidence ? { confidence } : {}) },
    ],
  };
};
const mastered = (d: LearnerData, lesson: string) => {
  d.lessons[lesson] = {
    updatedAt: iso(0),
    status: 'mastered',
    masteryAttempts: [{ at: iso(0), score: 1, passed: true, missedCompetencies: [] }],
  };
};
const session = (
  d: LearnerData,
  scores: Record<string, 1 | 2 | 3 | 4 | 5>,
  kind: 'explain' | 'concept' = 'explain',
  comps = [C],
) => {
  d.sessions.push({
    id: `s${d.sessions.length}`,
    at: iso(0),
    kind,
    competencies: comps,
    scores,
    gaps: [],
  });
};
const level = (def: CompetencyDef, d: LearnerData) => computeCompetency(def, index, d, NOW).level;

describe('browser competencies', () => {
  it('0 with no evidence', () => expect(level(browser, fresh())).toBe(0));

  it('1 Recognise: at least 2 tagged questions answered correctly', () => {
    const d = fresh();
    answer(d, 'q1', true);
    expect(level(browser, d)).toBe(0);
    answer(d, 'q2', true);
    expect(level(browser, d)).toBe(1);
  });

  it('2 Explain: a strong explain-back session, or an explain card rated Good twice', () => {
    const d = fresh();
    session(d, { correctness: 4, 'depth of understanding': 3, clarity: 3 });
    expect(level(browser, d)).toBe(2);
    const weak = fresh();
    session(weak, { correctness: 4, 'depth of understanding': 2, clarity: 5 });
    expect(level(browser, weak)).toBe(0);
    const cards = fresh();
    cards.reviewLog = [
      { cardId: 'ex-card', at: iso(-2), rating: 3 },
      { cardId: 'ex-card', at: iso(-1), rating: 4 },
    ];
    expect(level(browser, cards)).toBe(2);
    const basic = fresh();
    basic.reviewLog = [
      { cardId: 'basic-card', at: iso(-2), rating: 3 },
      { cardId: 'basic-card', at: iso(-1), rating: 3 },
    ];
    expect(level(browser, basic)).toBe(0);
  });

  it('3 Apply with help: a tagged exercise passed, hints allowed', () => {
    const d = fresh();
    ex(d, 'faded', { hintsUsed: 2 });
    expect(level(browser, d)).toBe(3);
  });

  it('4 Apply unaided: a make exercise passed with no help and the mastery check passed', () => {
    const d = fresh();
    ex(d, 'make');
    expect(level(browser, d)).toBe(3);
    mastered(d, 'l1');
    expect(level(browser, d)).toBe(4);
    const tutor = fresh();
    ex(tutor, 'make', { tutorUsed: true });
    mastered(tutor, 'l1');
    expect(level(browser, tutor)).toBe(3);
  });

  it('5 Debug and teach: a debug exercise passed unaided and an explain-back of 4 or more', () => {
    const d = fresh();
    ex(d, 'make');
    ex(d, 'debug');
    mastered(d, 'l1');
    expect(level(browser, d)).toBe(4);
    session(d, { correctness: 4, 'depth of understanding': 5, clarity: 4 });
    expect(level(browser, d)).toBe(5);
  });

  it('5 can also come from a code-reading drill passed unaided', () => {
    const d = fresh();
    ex(d, 'make');
    mastered(d, 'l1');
    d.drills['cr'] = {
      updatedAt: iso(0),
      attempts: [{ at: iso(0), passed: true, durationMs: 1, hintsUsed: 0, solutionViewed: false }],
    };
    session(d, { correctness: 4, 'depth of understanding': 4, clarity: 4 });
    expect(level(browser, d)).toBe(5);
  });
});

describe('interview competencies', () => {
  const gym = (
    d: LearnerData,
    id: string,
    at: number,
    over: Partial<LearnerData['gym'][string]['attempts'][number]> = {},
  ) => {
    const prev = d.gym[id]?.attempts ?? [];
    d.gym[id] = {
      updatedAt: iso(0),
      attempts: [
        ...prev,
        {
          at: iso(at),
          mode: 'timed',
          passed: true,
          durationMs: 10 * 60_000,
          hintsUsed: 0,
          checklist: [],
          ...over,
        },
      ],
    };
  };
  const hashing = interview('int.hashing');

  it('3 with one passed problem; 4 needs two unaided passes within the limit on different days', () => {
    const d = fresh();
    gym(d, 'p1', -2);
    expect(level(hashing, d)).toBe(3);
    gym(d, 'p1', -2.1); // same day
    expect(level(hashing, d)).toBe(3);
    gym(d, 'p2', -1);
    expect(level(hashing, d)).toBe(4);
  });

  it('a pass over the time limit does not count towards 4', () => {
    const d = fresh();
    gym(d, 'p1', -2);
    gym(d, 'p2', -1, { durationMs: 25 * 60_000 });
    expect(level(hashing, d)).toBe(3);
  });

  it('code-reading counts drills and reaches 5 with two unaided passes on different days', () => {
    const def = interview('int.code-reading');
    const d = fresh();
    const attempt = (at: number) => ({
      at: iso(at),
      passed: true,
      durationMs: 60_000,
      hintsUsed: 0,
      solutionViewed: false,
    });
    d.drills['cr'] = { updatedAt: iso(0), attempts: [attempt(-3)] };
    expect(level(def, d)).toBe(3);
    d.drills['cr'] = { updatedAt: iso(0), attempts: [attempt(-3), attempt(-1)] };
    expect(level(def, d)).toBe(5);
  });

  it('AI-assisted: unaided means the explanation was not viewed', () => {
    const def = interview('int.ai-assisted');
    const d = fresh();
    d.drills['ai'] = {
      updatedAt: iso(0),
      attempts: [
        { at: iso(-3), passed: true, durationMs: 60_000, hintsUsed: 0, solutionViewed: true },
        { at: iso(-1), passed: true, durationMs: 60_000, hintsUsed: 0, solutionViewed: true },
      ],
    };
    expect(level(def, d)).toBe(3);
  });
});

describe('local competencies', () => {
  it('4 needs the mastery check plus a lab with an evidence link, or a finished checklist', () => {
    const d = fresh();
    answer(d, 'g1', true);
    mastered(d, 'l2');
    expect(level(local, d)).toBe(0);
    d.labs['wa-m1'] = { updatedAt: iso(0), done: true };
    expect(level(local, d)).toBe(0);
    d.labs['wa-m1'] = {
      updatedAt: iso(0),
      done: true,
      evidenceUrl: 'https://github.com/example/repo/commit/abc',
    };
    expect(level(local, d)).toBe(4);
    const viaChecklist = fresh();
    mastered(viaChecklist, 'l2');
    viaChecklist.checklists['chk'] = { updatedAt: iso(0), done: ['0', '1'] };
    expect(level(local, viaChecklist)).toBe(4);
  });

  it('5 also needs a session on it with every score 4 or more', () => {
    const d = fresh();
    mastered(d, 'l2');
    d.labs['wa-m1'] = {
      updatedAt: iso(0),
      done: true,
      evidenceUrl: 'https://github.com/example/repo/commit/abc',
    };
    session(d, { correctness: 4, depth: 5 }, 'concept', ['git.branching']);
    expect(level(local, d)).toBe(5);
  });
});

describe('rusty and overconfident', () => {
  it('rusty when a card is overdue by more than 14 days, or has recent lapses; the level does not drop', () => {
    const d = fresh();
    ex(d, 'faded');
    d.cards['basic-card'] = {
      updatedAt: iso(0),
      state: { due: iso(-15), stability: 5, difficulty: 5, reps: 3, lapses: 0, state: 'review' },
    };
    const r = computeCompetency(browser, index, d, NOW);
    expect(r.rusty).toBe(true);
    expect(r.level).toBe(3);
    d.cards['basic-card'] = {
      updatedAt: iso(0),
      state: { due: iso(-13), stability: 5, difficulty: 5, reps: 3, lapses: 0, state: 'review' },
    };
    expect(computeCompetency(browser, index, d, NOW).rusty).toBe(false);
    d.reviewLog = [
      { cardId: 'basic-card', at: iso(-3), rating: 1 },
      { cardId: 'basic-card', at: iso(-1), rating: 1 },
    ];
    expect(computeCompetency(browser, index, d, NOW).rusty).toBe(true);
  });

  it('lists questions answered "certain" but wrong in the last 30 days only', () => {
    const d = fresh();
    answer(d, 'q1', false, 4, -3);
    answer(d, 'q2', false, 4, -40);
    expect(computeCompetency(browser, index, d, NOW).overconfident).toEqual(['q1']);
    answer(d, 'q1', false, 3, -3);
    expect(computeCompetency(browser, index, d, NOW).overconfident).toEqual([]);
  });
});
