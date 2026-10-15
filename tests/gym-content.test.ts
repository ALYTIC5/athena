import { readFileSync, readdirSync } from 'node:fs';
import { afterAll, describe, expect, it } from 'vitest';
import { parse } from 'yaml';
import { gradeFiles, gradePython, type PythonExerciseSpec } from '../src/lib/grader/grade';
import { createNodeRunner } from '../src/lib/grader/node-client';

const runner = createNodeRunner({ packageCacheDir: '.pyodide-cache' });
afterAll(() => runner.dispose());

interface Problem {
  id: string;
  timeLimitMin: number;
  visibleTests: string;
  hiddenTests: string;
  referenceSolutions: { code: string }[];
  wrongSolutions: { label: string; code: string }[];
}

interface Drill {
  id: string;
  files: Record<string, string>;
  fixedFiles: Record<string, string>;
  failingTest: string;
}

const spec = (p: Problem): PythonExerciseSpec => ({
  kind: 'make',
  timeoutMs: 5000,
  packages: [],
  visibleTests: p.visibleTests,
  hiddenTests: p.hiddenTests,
  feedback: [],
});

describe('sample gym problems (reference passes, every wrong solution fails)', () => {
  const dir = 'src/content/problems';
  const files = readdirSync(dir).filter((f) => f.startsWith('sample-gym-'));
  it('finds three samples', () => expect(files).toHaveLength(3));
  for (const file of files) {
    const p = parse(readFileSync(`${dir}/${file}`, 'utf8')) as Problem;
    it(`${p.id}: reference solution passes all tests`, async () => {
      for (const ref of p.referenceSolutions) {
        const r = await gradePython(runner, spec(p), ref.code, true);
        expect(r.error).toBeUndefined();
        expect(r.tests.filter((t) => t.status !== 'passed').map((t) => t.name)).toEqual([]);
        expect(r.passed).toBe(true);
      }
    }, 120000);
    for (const wrong of p.wrongSolutions) {
      it(`${p.id}: fails "${wrong.label}"`, async () => {
        const r = await gradePython(runner, spec(p), wrong.code, true);
        expect(r.passed).toBe(false);
      }, 120000);
    }
  }
});

describe('sample drills (the bug fails the test, the fix passes)', () => {
  const dir = 'src/content/drills';
  const files = readdirSync(dir).filter((f) => f.startsWith('sample-drill-'));
  it('finds the code-reading and AI-assisted samples', () => expect(files).toHaveLength(2));
  for (const file of files) {
    const d = parse(readFileSync(`${dir}/${file}`, 'utf8')) as Drill;
    it(`${d.id}: the planted bug makes the test fail`, async () => {
      const r = await gradeFiles(runner, { files: d.files, tests: d.failingTest, timeoutMs: 5000 });
      expect(r.error).toBeUndefined();
      expect(r.passed).toBe(false);
      expect(r.tests.some((t) => t.status !== 'passed')).toBe(true);
    }, 120000);
    it(`${d.id}: the fixed files pass`, async () => {
      const r = await gradeFiles(runner, {
        files: d.fixedFiles,
        tests: d.failingTest,
        timeoutMs: 5000,
      });
      expect(r.error).toBeUndefined();
      expect(r.tests.filter((t) => t.status !== 'passed').map((t) => t.name)).toEqual([]);
      expect(r.passed).toBe(true);
    }, 120000);
  }

  it('runs drill files from a fresh directory each time and trims tracebacks to drill files', async () => {
    const files = { 'm.py': 'def f():\n    raise ValueError("boom")\n' };
    const tests = 'from m import f\n\ndef test_it():\n    f()\n';
    const r = await gradeFiles(runner, { files, tests, timeoutMs: 5000 });
    expect(r.tests[0]?.status).toBe('errored');
    expect(r.tests[0]?.message).toContain('m.py');
    expect(r.tests[0]?.message).not.toContain('/tmp/athena_work');
    // A second run with a different module of the same name must not see stale code.
    const files2 = { 'm.py': 'def f():\n    return 1\n' };
    const r2 = await gradeFiles(runner, { files: files2, tests, timeoutMs: 5000 });
    expect(r2.passed).toBe(true);
  }, 120000);
});
