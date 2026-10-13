import { readFileSync } from 'node:fs';
import { afterAll, describe, expect, it } from 'vitest';
import {
  creditFor,
  gradePython,
  gradeWriteTests,
  isUnaided,
  runPython,
  shouldNudgeStuck,
  solutionUnlocked,
  STUCK_AFTER_MS,
  testNames,
  type PythonExerciseSpec,
} from '../src/lib/grader/grade';
import { trimTraceback } from '../src/lib/grader/harness';
import { PYODIDE_VERSION } from '../src/lib/grader/protocol';
import { createNodeRunner } from '../src/lib/grader/node-client';

const runner = createNodeRunner({ packageCacheDir: '.pyodide-cache' });
afterAll(() => runner.dispose());

const spec = (over: Partial<PythonExerciseSpec> = {}): PythonExerciseSpec => ({
  kind: 'make',
  timeoutMs: 5000,
  packages: [],
  feedback: [],
  ...over,
});

const VISIBLE = `def test_adds():\n    assert add(1, 2) == 3\n`;
const HIDDEN = `def test_negative():\n    assert add(-1, -2) == -3\n`;

describe('pyodide version pin', () => {
  it('matches the pyodide npm package', () => {
    const pkg = JSON.parse(readFileSync('node_modules/pyodide/package.json', 'utf8')) as {
      version: string;
    };
    expect(PYODIDE_VERSION).toBe(pkg.version);
  });
});

describe('credit rules', () => {
  const base = { passed: true, hintsUsed: 0, tutorUsed: false, solutionViewed: false } as const;
  it('steps down with hints', () => {
    expect(creditFor(base)).toBe(1);
    expect(creditFor({ ...base, hintsUsed: 1 })).toBe(0.75);
    expect(creditFor({ ...base, hintsUsed: 2 })).toBe(0.5);
    expect(creditFor({ ...base, hintsUsed: 3 })).toBe(0.25);
  });
  it('caps tutor use at 0.75 and gives 0 for a viewed solution or a fail', () => {
    expect(creditFor({ ...base, tutorUsed: true })).toBe(0.75);
    expect(creditFor({ ...base, hintsUsed: 2, tutorUsed: true })).toBe(0.5);
    expect(creditFor({ ...base, solutionViewed: true })).toBe(0);
    expect(creditFor({ ...base, passed: false })).toBe(0);
  });
  it('counts only a full-credit pass as unaided', () => {
    expect(isUnaided(base)).toBe(true);
    expect(isUnaided({ ...base, tutorUsed: true })).toBe(false);
  });
  it('locks the solution until a pass or three fails plus all hints', () => {
    expect(solutionUnlocked({ passed: false, failedChecks: 2, hintsUsed: 3 })).toBe(false);
    expect(solutionUnlocked({ passed: false, failedChecks: 3, hintsUsed: 2 })).toBe(false);
    expect(solutionUnlocked({ passed: false, failedChecks: 3, hintsUsed: 3 })).toBe(true);
    expect(solutionUnlocked({ passed: true, failedChecks: 0, hintsUsed: 0 })).toBe(true);
  });
  it('nudges after 15 minutes without a pass', () => {
    const startedAt = 1000;
    expect(
      shouldNudgeStuck({ passed: false, startedAt, now: startedAt + STUCK_AFTER_MS - 1 }),
    ).toBe(false);
    expect(shouldNudgeStuck({ passed: false, startedAt, now: startedAt + STUCK_AFTER_MS })).toBe(
      true,
    );
    expect(shouldNudgeStuck({ passed: true, startedAt, now: startedAt + STUCK_AFTER_MS })).toBe(
      false,
    );
  });
});

describe('helpers', () => {
  it('finds test names in order', () => {
    expect(
      testNames(`def test_b():\n    pass\ndef helper():\n    pass\ndef test_a():\n    pass`),
    ).toEqual(['test_b', 'test_a']);
  });
  it('trims tracebacks to learner frames', () => {
    const raw = [
      'Traceback (most recent call last):',
      '  File "/lib/python/pyodide/_base.py", line 1, in run',
      '    internal()',
      '  File "<learner>", line 3, in <module>',
      '    boom()',
      'ValueError: bad',
    ].join('\n');
    const out = trimTraceback(raw);
    expect(out).toContain('<learner>');
    expect(out).toContain('ValueError: bad');
    expect(out).not.toContain('_base.py');
    expect(out).not.toContain('internal()');
  });
});

describe('python grading (real Pyodide under Node)', () => {
  it('passes correct code, reports visible tests', async () => {
    const r = await gradePython(
      runner,
      spec({ visibleTests: VISIBLE }),
      'def add(a, b):\n    return a + b\n',
      false,
    );
    expect(r.passed).toBe(true);
    expect(r.tests.map((t) => t.status)).toEqual(['passed']);
  }, 120000);

  it('fails wrong code with a test failure', async () => {
    const r = await gradePython(
      runner,
      spec({ visibleTests: VISIBLE }),
      'def add(a, b):\n    return a - b\n',
      false,
    );
    expect(r.passed).toBe(false);
    expect(r.tests[0]?.status).toBe('failed');
  }, 60000);

  it('hides hidden-test detail and maps feedback on Check', async () => {
    const s = spec({
      visibleTests: VISIBLE,
      hiddenTests: HIDDEN,
      feedback: [{ test: 'test_negative', message: 'Check negative numbers.' }],
    });
    const wrong = 'def add(a, b):\n    return abs(a) + abs(b) if a < 0 else a + b\n';
    const notRun = await gradePython(runner, s, wrong, false);
    expect(notRun.tests.map((t) => t.name)).toEqual(['test_adds']);
    const r = await gradePython(runner, s, wrong, true);
    const hidden = r.tests.find((t) => t.name === 'test_negative');
    expect(hidden?.status).toBe('failed');
    expect(hidden?.hidden).toBe(true);
    expect(hidden?.message).toBe('');
    expect(hidden?.feedback).toBe('Check negative numbers.');
    expect(r.passed).toBe(false);
  }, 60000);

  it('reports an exception inside a test as errored', async () => {
    const r = await gradePython(
      runner,
      spec({ visibleTests: VISIBLE }),
      'def add(a, b):\n    return a + undefined_name\n',
      false,
    );
    expect(r.tests[0]?.status).toBe('errored');
    expect(r.tests[0]?.message).toContain('NameError');
  }, 60000);

  it('reports a syntax error with a line number', async () => {
    const r = await gradePython(
      runner,
      spec({ visibleTests: VISIBLE }),
      'def add(a, b)\n    return a + b\n',
      false,
    );
    expect(r.passed).toBe(false);
    expect(r.error).toContain('SyntaxError');
    expect(r.error).toContain('line 1');
  }, 60000);

  it('times out an infinite loop, then recovers with a fresh worker', async () => {
    const r = await gradePython(
      runner,
      spec({ visibleTests: VISIBLE, timeoutMs: 1000 }),
      'def add(a, b):\n    while True:\n        pass\n',
      false,
    );
    expect(r.timedOut).toBe(true);
    expect(r.error).toBe('Your code ran for more than 1 seconds. Look for a loop that never ends.');
    const again = await gradePython(
      runner,
      spec({ visibleTests: VISIBLE }),
      'def add(a, b):\n    return a + b\n',
      false,
    );
    expect(again.passed).toBe(true);
  }, 120000);

  it('removes modules and state between runs', async () => {
    const first = await runPython(
      runner,
      'import sys, types\nm = types.ModuleType("leftover")\nsys.modules["leftover"] = m\nprint("first")',
      [],
      5000,
    );
    expect(first.stdout).toBe('first');
    const second = await runPython(
      runner,
      'import sys\nprint("leftover" in sys.modules)\nprint("m" in dir())',
      [],
      5000,
    );
    expect(second.stdout).toBe('False\nFalse');
  }, 60000);

  it('trims run tracebacks to the learner frames', async () => {
    const r = await runPython(runner, 'def f():\n    raise ValueError("bad")\nf()', [], 5000);
    expect(r.error).toContain('line 2, in f');
    expect(r.error).toContain('ValueError: bad');
    expect(r.error).not.toContain('pyodide');
  }, 60000);

  it('supports top-level await in run mode', async () => {
    const r = await runPython(
      runner,
      'import asyncio\nasync def f():\n    return 41\nprint(await f() + 1)',
      [],
      5000,
    );
    expect(r.error).toBeUndefined();
    expect(r.stdout).toBe('42');
  }, 60000);

  it('uses a stable hash seed', async () => {
    const a = await runPython(runner, 'print(hash("athena"))', [], 5000);
    const b = await runPython(runner, 'print(hash("athena"))', [], 5000);
    expect(a.stdout).toBe(b.stdout);
  }, 60000);
});

describe('write-tests grading (needs the pytest package; downloads once into .pyodide-cache)', () => {
  const s = spec({
    kind: 'write-tests',
    timeoutMs: 20000,
    implementations: {
      correct: 'def add(a, b):\n    return a + b\n',
      buggy: [
        { label: 'subtracts', code: 'def add(a, b):\n    return a - b\n' },
        { label: 'ignores b', code: 'def add(a, b):\n    return a\n' },
        { label: 'wrong for zero', code: 'def add(a, b):\n    return a + b if a else 0\n' },
      ],
    },
  });
  const good =
    'from impl import add\n\ndef test_a():\n    assert add(2, 3) == 5\n\ndef test_b():\n    assert add(0, 4) == 4\n';

  it('passes tests that accept the correct code and catch every bug', async () => {
    const r = await gradeWriteTests(runner, s, good);
    expect(r.findings).toEqual([]);
    expect(r.passed).toBe(true);
  }, 240000);

  it('fails tests that miss a bug', async () => {
    const weak = 'from impl import add\n\ndef test_a():\n    assert add(2, 3) == 5\n';
    const r = await gradeWriteTests(runner, s, weak);
    expect(r.passed).toBe(false);
    expect(r.findings.join(' ')).toContain('wrong for zero');
  }, 240000);

  it('fails tests that reject the correct implementation', async () => {
    const wrong = 'from impl import add\n\ndef test_a():\n    assert add(2, 3) == 6\n';
    const r = await gradeWriteTests(runner, s, wrong);
    expect(r.passed).toBe(false);
    expect(r.findings[0]).toContain('correct implementation');
  }, 240000);
});
