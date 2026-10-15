import { afterAll, describe, expect, it } from 'vitest';
import { createNodeRunner, createNodeSqlRunner } from '../src/lib/grader/node-client';
import { checkCoverage } from '../scripts/validator/checks/coverage';
import { checkGrading, checkPredict } from '../scripts/validator/checks/grading';
import { checkReferences } from '../scripts/validator/checks/references';
import { checkSafetyText, isReservedPhone } from '../scripts/validator/checks/safety';
import { checkSchemas } from '../scripts/validator/checks/schemas';
import { checkTime, estimateLesson } from '../scripts/validator/checks/time';
import { codeBlocks, componentUses } from '../scripts/validator/mdx';
import type { Content, Doc, Issue, LessonPage } from '../scripts/validator/types';

const rules = (issues: Issue[]) => issues.filter((i) => i.severity === 'error').map((i) => i.rule);
const messages = (issues: Issue[]) => issues.map((i) => i.message).join('\n');

// ---- fixtures ------------------------------------------------------------------------------

const exercise = (over: Record<string, unknown> = {}): Doc => ({
  file: 'src/content/exercises/l-1-make.yaml',
  data: {
    id: 'l-1-make',
    lesson: 'l-1',
    runtime: 'python',
    kind: 'make',
    pools: ['lesson'],
    competencies: ['py.functions'],
    timeoutMs: 5000,
    packages: [],
    prompt: 'Write f.',
    starter: 'def f():\n    ...\n',
    visibleTests: 'def test_a():\n    assert f() == 1\n',
    hiddenTests: 'def test_b():\n    assert f() != 2\n',
    feedback: [],
    referenceSolution: 'def f():\n    return 1\n',
    wrongSolutions: [
      { label: 'returns 2', code: 'def f():\n    return 2\n' },
      { label: 'returns None', code: 'def f():\n    pass\n' },
    ],
    explanation: 'Because.',
    ...over,
  },
});

const base = (over: Partial<Content> = {}): Content => ({
  curriculum: [
    {
      id: 'week-1',
      week: 1,
      lessons: [
        { id: 'l-1', title: 'One', durationMin: 60, status: 'published' },
        { id: 'l-2', title: 'Two', durationMin: 60, status: 'planned' },
      ],
      lab: [{ milestone: 'wa-m1', minutes: 45 }],
      gym: { focus: 'Hashing', target: 2 },
    },
  ],
  competencies: [
    { id: 'py.functions', track: 'py', title: 'Functions', evidence: 'browser', core: true },
    { id: 'py.collections', track: 'py', title: 'Collections', evidence: 'browser', core: true },
  ],
  lessons: [],
  exercises: [],
  quizzes: [],
  practice: [],
  cards: [],
  interview: [],
  problems: [],
  drills: [],
  ...over,
});

const page = (id: string, fm: Record<string, unknown>, body = ''): LessonPage => ({
  file: `src/content/docs/lessons/${id}.mdx`,
  frontmatter: {
    title: id,
    lessonId: id,
    week: 1,
    track: 'py',
    durationMin: 60,
    anatomy: 'short',
    competencies: ['py.functions'],
    whyItMatters: 'x',
    objectives: ['Explain x'],
    sources: [{ title: 'Docs', url: 'https://docs.python.org/3/' }],
    ...fm,
  },
  body,
});

const question = (id: string, over: Record<string, unknown> = {}) => ({
  id,
  pools: ['check', 'mastery', 'warmup'],
  chunk: 1,
  objective: 1,
  type: 'single',
  competencies: ['py.functions'],
  stem: 's',
  options: [
    { text: 'a', correct: true, why: 'w' },
    { text: 'b', correct: false, why: 'w' },
  ],
  ...over,
});

// ---- schemas and ids -----------------------------------------------------------------------

describe('schemas and ids', () => {
  it('accepts a good exercise', () => {
    expect(rules(checkSchemas(base({ exercises: [exercise()] })))).toEqual([]);
  });

  it('rejects an exercise that breaks its schema', () => {
    const bad = exercise({ prompt: undefined, kind: 'nonsense' });
    expect(rules(checkSchemas(base({ exercises: [bad] })))).toContain('schema');
  });

  it('requires the id to equal the file name and start with the lesson id', () => {
    const wrongName = exercise({ id: 'l-1-other' });
    expect(rules(checkSchemas(base({ exercises: [wrongName] })))).toContain('id-matches-file');
    const wrongPrefix = { ...exercise({ id: 'zzz' }), file: 'src/content/exercises/zzz.yaml' };
    expect(rules(checkSchemas(base({ exercises: [wrongPrefix] })))).toContain('id-prefix');
  });

  it('rejects duplicate question ids', () => {
    const q = (file: string, lesson: string): Doc => ({
      file,
      data: { lesson, items: [question(`${lesson}-q1`), question(`${lesson}-q1`)] },
    });
    const issues = checkSchemas(base({ quizzes: [q('src/content/quizzes/l-1.yaml', 'l-1')] }));
    expect(rules(issues)).toContain('unique-id');
  });

  it('requires the lesson frontmatter fields', () => {
    const bad = page('l-1', { whyItMatters: undefined });
    expect(messages(checkSchemas(base({ lessons: [bad] })))).toContain('whyItMatters');
  });
});

// ---- references ----------------------------------------------------------------------------

describe('references', () => {
  it('accepts resolvable references', () => {
    const lesson = page(
      'l-1',
      { durationMin: 60 },
      '<Exercise id="l-1-make" />\n<LabStep milestone="wa-m1" />',
    );
    expect(rules(checkReferences(base({ lessons: [lesson], exercises: [exercise()] })))).toEqual(
      [],
    );
  });

  it('flags an unknown lesson and an unknown competency', () => {
    const e = exercise({ lesson: 'nope', competencies: ['x.y'] });
    const issues = checkReferences(base({ exercises: [e] }));
    expect(messages(issues)).toContain('Unknown lesson "nope"');
    expect(messages(issues)).toContain('Unknown competency "x.y"');
  });

  it('flags a published lesson that uses content of a planned lesson, but allows prerequisites', () => {
    const planned = {
      ...exercise({ id: 'l-2-make', lesson: 'l-2' }),
      file: 'src/content/exercises/l-2-make.yaml',
    };
    const lesson = page('l-1', { prerequisites: ['l-2'] }, '<Exercise id="l-2-make" />');
    const issues = checkReferences(base({ lessons: [lesson], exercises: [planned] }));
    expect(rules(issues)).toEqual(['planned-content']);
  });

  it('flags a LabStep milestone that curriculum.yaml does not list', () => {
    const lesson = page('l-1', {}, '<LabStep milestone="wa-m9" />');
    expect(messages(checkReferences(base({ lessons: [lesson] })))).toContain('wa-m9');
  });

  it('requires a published lesson durationMin to equal curriculum.yaml', () => {
    const lesson = page('l-1', { durationMin: 90 });
    expect(rules(checkReferences(base({ lessons: [lesson] })))).toEqual(['duration']);
  });

  it('flags a published lesson without a page', () => {
    expect(messages(checkReferences(base()))).toContain('published but has no page');
  });
});

// ---- coverage and interleaving -------------------------------------------------------------

describe('coverage', () => {
  /** A short published lesson that meets every pool minimum. */
  function compliant(): Content {
    const items = [
      ...Array.from({ length: 16 }, (_, i) =>
        question(`l-1-m${i}`, { pools: ['mastery', 'warmup'], chunk: undefined, objective: 1 }),
      ),
      question('l-1-c1', { pools: ['check'], chunk: 1 }),
    ];
    const cards = Array.from({ length: 8 }, (_, i) => ({
      id: `l-1-c${i}`,
      type: 'basic',
      competencies: ['py.functions'],
      front: 'f',
      back: 'b',
    }));
    return base({
      lessons: [
        page('l-1', { anatomy: 'short', objectives: ['Explain x'] }, '<Chunk n={1} title="A" />'),
      ],
      quizzes: [{ file: 'src/content/quizzes/l-1.yaml', data: { lesson: 'l-1', items } }],
      cards: [{ file: 'src/content/cards/l-1.yaml', data: { lesson: 'l-1', cards } }],
      exercises: [
        exercise({ id: 'l-1-ma', pools: ['mastery'] }),
        exercise({ id: 'l-1-mb', pools: ['mastery'] }),
      ],
    });
  }

  it('passes a lesson that meets every minimum', () => {
    expect(checkCoverage(compliant())).toEqual([]);
  });

  it('flags too few mastery questions, uncovered objectives and thin competencies', () => {
    const c = compliant();
    (c.quizzes[0]!.data['items'] as unknown[]).splice(0, 14);
    const text = messages(checkCoverage(c));
    expect(text).toContain('mastery questions; at least 16');
    expect(text).toContain('warm-up eligible');
  });

  it('flags a missing mastery make exercise and an overlap with the lesson exercise', () => {
    const c = compliant();
    c.exercises = [exercise({ id: 'l-1-ma', pools: ['mastery', 'lesson'] })];
    const text = messages(checkCoverage(c));
    expect(text).toContain('mastery make exercise(s); at least 2');
    expect(text).toContain('different from the lesson make exercise');
  });

  it('flags a chunk without check items and a wrong number of cards', () => {
    const c = compliant();
    c.lessons = [
      page('l-1', { anatomy: 'short' }, '<Chunk n={1} title="A" />\n<Chunk n={2} title="B" />'),
    ];
    c.cards = [
      { file: 'src/content/cards/l-1.yaml', data: { lesson: 'l-1', cards: [{ id: 'l-1-c0' }] } },
    ];
    const text = messages(checkCoverage(c));
    expect(text).toContain('Chunk 2 has 0 check item');
    expect(text).toContain('1 cards; a lesson needs 8 to 15');
  });

  it('does not apply to the orientation lesson, planned lessons or sample content', () => {
    const c = compliant();
    c.lessons = [page('l-1', { anatomy: 'orientation' }), page('l-2', { anatomy: 'full' })];
    expect(checkCoverage(c)).toEqual([]);
  });
});

// ---- time estimates ------------------------------------------------------------------------

describe('time estimates', () => {
  const ex = (id: string, kind: string, runtime = 'python', estMin?: number) => ({
    id,
    lesson: 'l-1',
    kind,
    runtime,
    ...(estMin ? { estMin } : {}),
  });

  it('uses the documented minutes (the py-01 example comes to about 166)', () => {
    const body = [
      '<WarmUp lesson="py-01" count={5} />',
      '<Chunk n={1} title="A" />',
      '<Predict lesson="py-01" item="a" />',
      '<Exercise id="faded1" />',
      '<Quiz lesson="py-01" chunk={1} />',
      '<Chunk n={2} title="B" />',
      '<Predict lesson="py-01" item="b" />',
      '<Exercise id="faded2" />',
      '<Quiz lesson="py-01" chunk={2} />',
      '<Parsons lesson="py-01" item="p" />',
      '<Exercise id="debug" />',
      '<Exercise id="make" />',
      '<ExplainBack lesson="py-01" exercise="make" />',
      '<MasteryCheck lesson="py-01" count={8} />',
      '<InterviewCorner lesson="py-01" />',
    ].join('\n');
    const q = (chunk: number) =>
      [1, 2].map((n) => ({ id: `q${chunk}${n}`, type: 'single', pools: ['check'], chunk }));
    const est = estimateLesson({
      body,
      anatomy: 'full',
      durationMin: 165,
      exercises: new Map([
        ['faded1', ex('faded1', 'faded')],
        ['faded2', ex('faded2', 'faded')],
        ['debug', ex('debug', 'debug')],
        ['make', ex('make', 'make')],
      ]),
      practice: new Map(),
      questions: [...q(1), ...q(2)],
      interviewCount: 2,
    });
    expect(Math.round(est.total)).toBe(166);
  });

  it('fails a lesson more than 15% over its target and passes one within it', () => {
    const fm = { anatomy: 'short', durationMin: 30 };
    const body =
      '<Chunk n={1} title="A" />\n<Chunk n={2} title="B" />\n<Chunk n={3} title="C" />\n<Chunk n={4} title="D" />';
    const over = base({ lessons: [page('l-1', { ...fm }, body)] });
    over.curriculum[0]!.lessons[0]!.durationMin = 30;
    expect(rules(checkTime(over))).toEqual(['time']);
    const ok = base({ lessons: [page('l-1', { anatomy: 'short', durationMin: 60 }, body)] });
    expect(checkTime(ok)).toEqual([]);
  });

  it('caps a week at 2.75 hours of lessons plus lab', () => {
    const c = base();
    c.curriculum[0]!.lessons = [{ id: 'l-1', title: 'a', durationMin: 120, status: 'planned' }];
    c.curriculum[0]!.lab = [{ milestone: 'wa-m1', minutes: 60 }];
    expect(messages(checkTime(c))).toContain('Week 1 totals 180 min');
  });

  it('lets an exercise override its default with estMin', () => {
    const est = estimateLesson({
      body: '<Exercise id="x" />',
      anatomy: 'short',
      durationMin: 60,
      exercises: new Map([['x', ex('x', 'make', 'sql', 3)]]),
      practice: new Map(),
      questions: [],
      interviewCount: 0,
    });
    expect(est.total).toBe(3);
  });
});

// ---- safety --------------------------------------------------------------------------------

describe('safety', () => {
  const scan = (text: string) => checkSafetyText([{ file: 'f.yaml', text }]);

  it('allows reserved phone numbers and example email domains', () => {
    expect(scan('call +44 7700 900123 or 07700 900999 or (212) 555-0123 or 555-0150')).toEqual([]);
    expect(
      scan('mail amara@example.com, jonas@example.org, mei@example.net, sofia@booking.test'),
    ).toEqual([]);
  });

  it('rejects real-looking phone numbers and other email domains', () => {
    expect(rules(scan('call +44 7911 123456'))).toEqual(['safety']);
    expect(rules(scan('call 212-555-0200'))).toEqual(['safety']);
    expect(rules(scan('mail someone@gmail.com'))).toEqual(['safety']);
  });

  it('rejects secrets without the ATHENA_FAKE marker, accepts them with it', () => {
    // Built at run time so the source never contains a secret-shaped string.
    const openAiLike = ['sk', 'abcdefghijklmnopqrstuvwxyz1234'].join('-');
    const awsLike = ['AKIA', 'ABCDEFGHIJKLMNOP'].join('');
    expect(rules(scan(`key: ${openAiLike}`))).toEqual(['safety']);
    expect(rules(scan(`key: ${awsLike}`))).toEqual(['safety']);
    expect(scan('key: sk-ATHENA_FAKE_abcdefghijklmnopqrstuvwxyz')).toEqual([]);
  });

  it('ignores ISO dates and short numbers', () => {
    expect(scan('on 2026-10-14 there were 12345678 rows')).toEqual([]);
  });

  it('knows the reserved ranges', () => {
    expect(isReservedPhone('+44 7700 900000')).toBe(true);
    expect(isReservedPhone('+44 7700 901000')).toBe(false);
    expect(isReservedPhone('555-0100')).toBe(true);
    expect(isReservedPhone('555-0200')).toBe(false);
  });
});

// ---- mdx helpers ---------------------------------------------------------------------------

describe('mdx helpers', () => {
  it('reads component attributes and code block info strings', () => {
    const uses = componentUses(
      '<Chunk n={2} title="Names" prior />\n<LabStep milestone="wa-m1" />',
    );
    expect(uses[0]).toMatchObject({
      name: 'Chunk',
      attrs: { n: '2', title: 'Names', prior: 'true' },
    });
    expect(uses[1]?.attrs['milestone']).toBe('wa-m1');
    const blocks = codeBlocks(
      'x\n```python nocheck="needs network"\nprint(1)\n```\n```sql schema="e1"\nselect 1\n```\n',
    );
    expect(blocks.map((b) => b.lang)).toEqual(['python', 'sql']);
    expect(blocks[0]?.meta).toContain('nocheck');
  });
});

// ---- grading with the real graders ---------------------------------------------------------

describe('grading (real Pyodide and PGlite)', () => {
  const py = createNodeRunner({
    packageCacheDir: '.pyodide-cache',
    env: { TZ: 'UTC', PYTHONHASHSEED: '0' },
  });
  const pyAlt = createNodeRunner({
    packageCacheDir: '.pyodide-cache',
    env: { TZ: 'Pacific/Kiritimati', PYTHONHASHSEED: '1' },
  });
  const sql = createNodeSqlRunner();
  afterAll(() => Promise.all([py.dispose(), pyAlt.dispose(), sql.dispose()]));
  const runners = { py, pyAlt, sql };

  it('passes a good exercise', async () => {
    const r = await checkGrading(base({ exercises: [exercise()] }), runners);
    expect(r.issues).toEqual([]);
  }, 180000);

  it('flags a reference that fails, a wrong solution that passes and a starter that already passes', async () => {
    const badRef = exercise({ referenceSolution: 'def f():\n    return 3\n' });
    expect(messages((await checkGrading(base({ exercises: [badRef] }), runners)).issues)).toContain(
      'Reference solution does not pass',
    );

    const weak = exercise({
      wrongSolutions: [
        { label: 'passes anyway', code: 'def f():\n    return 1\n' },
        { label: 'returns 2', code: 'def f():\n    return 2\n' },
      ],
    });
    expect(messages((await checkGrading(base({ exercises: [weak] }), runners)).issues)).toContain(
      'tests are too weak',
    );

    const easyStarter = exercise({ starter: 'def f():\n    return 1\n' });
    expect(
      messages((await checkGrading(base({ exercises: [easyStarter] }), runners)).issues),
    ).toContain('starter code already passes');
  }, 240000);

  it('rejects predict output that depends on the hash seed, and stores ground truth for the rest', async () => {
    const issues: Issue[] = [];
    const truth = await checkPredict(
      [
        { id: 'stable', code: 'print(sorted({"a", "b", "c"}))' },
        { id: 'seeded', code: 'print(hash("athena"))' },
      ],
      runners,
      issues,
    );
    expect(truth['stable']).toBe("['a', 'b', 'c']");
    expect(issues.map((i) => i.where)).toEqual(['seeded']);
  }, 120000);

  it('checks lesson code blocks and demands a reason for nocheck', async () => {
    const lesson = page(
      'l-1',
      {},
      [
        '```python',
        'print(1 / 0)',
        '```',
        '```python nocheck',
        'x',
        '```',
        '```python nocheck="shows an error"',
        'print(1 / 0)',
        '```',
      ].join('\n'),
    );
    const r = await checkGrading(base({ lessons: [lesson] }), runners);
    const text = messages(r.issues);
    expect(text).toContain('Does not run');
    expect(text).toContain('nocheck needs a reason');
    expect(r.issues).toHaveLength(2);
  }, 120000);
});
