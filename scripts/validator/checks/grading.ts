import {
  gradeFiles,
  gradePython,
  gradeWriteTests,
  runPython,
  testNames,
  type PythonExerciseSpec,
} from '../../../src/lib/grader/grade';
import type { Runner } from '../../../src/lib/grader/runner';
import {
  gradeSql,
  runSql,
  type SqlExerciseSpec,
  type SqlRunner,
} from '../../../src/lib/grader/sql-grade';
import { expectedOutput } from '../../../src/lib/quiz/predict-truth';
import { codeBlocks, metaValue } from '../mdx';
import { error, type Content, type Doc, type Issue } from '../types';

export interface Runners {
  /** TZ=UTC, PYTHONHASHSEED=0 */
  py: Runner;
  /** TZ=Pacific/Kiritimati, PYTHONHASHSEED=1: a second, fresh interpreter with different settings. */
  pyAlt: Runner;
  sql: SqlRunner;
}

type Wrong = { label: string; code: string };

const str = (v: unknown) => (typeof v === 'string' ? v : '');

function pySpec(d: Record<string, unknown>): PythonExerciseSpec {
  return {
    kind: d['kind'] as PythonExerciseSpec['kind'],
    timeoutMs: Number(d['timeoutMs'] ?? 5000),
    packages: (d['packages'] as string[]) ?? [],
    visibleTests: str(d['visibleTests']),
    hiddenTests: str(d['hiddenTests']),
    feedback: (d['feedback'] as { test: string; message: string }[]) ?? [],
    implementations: d['implementations'] as PythonExerciseSpec['implementations'],
  };
}

function sqlSpec(d: Record<string, unknown>): SqlExerciseSpec {
  return {
    schema: str(d['schema']),
    extensions: (d['extensions'] as string[]) ?? [],
    referenceSolution: str(d['referenceSolution']),
    compare: (d['compare'] as SqlExerciseSpec['compare']) ?? {
      orderMatters: false,
      numericTolerance: 0,
    },
    checks: (d['checks'] as SqlExerciseSpec['checks']) ?? [],
    planCheck: d['planCheck'] as SqlExerciseSpec['planCheck'],
    queueClaim: d['queueClaim'] as boolean | undefined,
    timeoutMs: Number(d['timeoutMs'] ?? 5000),
  };
}

const failing = (r: { tests: { name: string; status: string }[] }) =>
  r.tests.filter((t) => t.status !== 'passed').map((t) => t.name);

async function gradeExercise(doc: Doc, r: Runners, issues: Issue[]): Promise<void> {
  const d = doc.data;
  const wrongs = (d['wrongSolutions'] as Wrong[]) ?? [];

  if (d['runtime'] === 'sql') {
    const spec = sqlSpec(d);
    const ref = await gradeSql(r.sql, spec, spec.referenceSolution);
    if (!ref.passed) {
      const why = ref.error ?? ref.mismatch ?? ref.failures.join(' ');
      issues.push(error('grader', doc.file, `Reference solution does not pass: ${why}`));
    }
    for (const w of wrongs) {
      const res = await gradeSql(r.sql, spec, w.code);
      if (res.passed)
        issues.push(
          error(
            'grader',
            doc.file,
            `Wrong solution passes, so the tests are too weak: "${w.label}".`,
          ),
        );
    }
    return;
  }

  const spec = pySpec(d);
  const names = new Set([...testNames(spec.visibleTests), ...testNames(spec.hiddenTests)]);
  for (const f of spec.feedback) {
    if (d['kind'] !== 'write-tests' && !names.has(f.test)) {
      issues.push(
        error('feedback', doc.file, `Feedback refers to a test that does not exist: ${f.test}.`),
      );
    }
  }

  if (d['kind'] === 'write-tests') {
    const ref = await gradeWriteTests(r.py, spec, str(d['referenceSolution']));
    if (!ref.passed)
      issues.push(
        error('grader', doc.file, `Reference tests do not pass: ${ref.findings.join(' ')}`),
      );
    for (const w of wrongs) {
      const res = await gradeWriteTests(r.py, spec, w.code);
      if (res.passed)
        issues.push(
          error(
            'grader',
            doc.file,
            `Wrong test file passes, so the buggy versions are too weak: "${w.label}".`,
          ),
        );
    }
    return;
  }

  // The reference must pass under both time zones.
  for (const [label, runner] of [
    ['TZ=UTC', r.py],
    ['TZ=Pacific/Kiritimati', r.pyAlt],
  ] as const) {
    const res = await gradePython(runner, spec, str(d['referenceSolution']), true);
    if (!res.passed) {
      const why = res.error ?? failing(res).join(', ');
      issues.push(
        error('grader', doc.file, `Reference solution does not pass under ${label}: ${why}`),
      );
    }
  }
  for (const w of wrongs) {
    const res = await gradePython(r.py, spec, w.code, true);
    if (res.passed)
      issues.push(
        error(
          'grader',
          doc.file,
          `Wrong solution passes, so the tests are too weak: "${w.label}".`,
        ),
      );
  }
  // The starter must not already pass (a debug starter must fail a visible test).
  const starter = await gradePython(r.py, spec, str(d['starter']), d['kind'] !== 'debug');
  if (starter.passed) {
    issues.push(error('grader', doc.file, 'The starter code already passes its tests.'));
  }
}

async function gradeProblem(doc: Doc, r: Runners, issues: Issue[]): Promise<void> {
  const d = doc.data;
  const spec = pySpec({ ...d, kind: 'make', timeoutMs: 5000 });
  for (const ref of (d['referenceSolutions'] as { code: string }[]) ?? []) {
    const res = await gradePython(r.py, spec, ref.code, true);
    if (!res.passed)
      issues.push(
        error(
          'grader',
          doc.file,
          `Reference solution does not pass: ${res.error ?? failing(res).join(', ')}`,
        ),
      );
  }
  for (const w of (d['wrongSolutions'] as Wrong[]) ?? []) {
    const res = await gradePython(r.py, spec, w.code, true);
    if (res.passed)
      issues.push(
        error(
          'grader',
          doc.file,
          `Wrong solution passes, so the tests are too weak: "${w.label}".`,
        ),
      );
  }
}

async function gradeDrill(doc: Doc, r: Runners, issues: Issue[]): Promise<void> {
  const d = doc.data;
  const tests = str(d['failingTest']);
  const bug = await gradeFiles(r.py, {
    files: d['files'] as Record<string, string>,
    tests,
    timeoutMs: 5000,
  });
  if (bug.passed)
    issues.push(error('grader', doc.file, 'The planted bug does not make the failing test fail.'));
  const fixed = await gradeFiles(r.py, {
    files: d['fixedFiles'] as Record<string, string>,
    tests,
    timeoutMs: 5000,
  });
  if (!fixed.passed)
    issues.push(
      error(
        'grader',
        doc.file,
        `The fixed files do not pass: ${fixed.error ?? failing(fixed).join(', ')}`,
      ),
    );
}

export interface PredictItem {
  id: string;
  code: string;
}

/**
 * Predict items and predict cards run in two fresh interpreters (different hash seed, and
 * TZ=UTC versus TZ=Pacific/Kiritimati). Output that differs is rejected. Returns the ground truth.
 */
export async function checkPredict(
  items: PredictItem[],
  r: Runners,
  issues: Issue[],
): Promise<Record<string, string>> {
  const truth: Record<string, string> = {};
  for (const item of items) {
    const a = await runPython(r.py, item.code, [], 10000);
    const b = await runPython(r.pyAlt, item.code, [], 10000);
    const outA = expectedOutput(a.stdout, a.error);
    const outB = expectedOutput(b.stdout, b.error);
    if (a.timedOut || b.timedOut) {
      issues.push(error('predict', item.id, 'The predict code timed out.'));
    } else if (outA !== outB) {
      issues.push(
        error(
          'predict',
          item.id,
          'Output differs between interpreters (hash seed or time zone). Make the code deterministic.',
        ),
      );
    }
    truth[item.id] = outA;
  }
  return truth;
}

/** Every python and sql block in a lesson runs, unless marked nocheck with a reason. */
async function checkBlocks(content: Content, r: Runners, issues: Issue[]): Promise<void> {
  const sqlExercises = new Map(
    content.exercises
      .filter((e) => e.data['runtime'] === 'sql')
      .map((e) => [String(e.data['id']), e]),
  );
  for (const page of content.lessons) {
    for (const block of codeBlocks(page.body)) {
      if (block.lang !== 'python' && block.lang !== 'sql') continue;
      const where = `${page.file} (${block.lang} block)`;
      const noCheck = /\bnocheck\b/.test(block.meta);
      if (noCheck) {
        if (!metaValue(block.meta, 'nocheck')) {
          issues.push(
            error(
              'code-block',
              where,
              'nocheck needs a reason, for example nocheck="needs network".',
            ),
          );
        }
        continue;
      }
      if (block.lang === 'python') {
        const res = await runPython(r.py, block.code, [], 5000);
        if (res.error)
          issues.push(
            error('code-block', where, `Does not run: ${res.error.split('\n').slice(-1)[0] ?? ''}`),
          );
      } else {
        const schema = metaValue(block.meta, 'schema');
        const ex = schema ? sqlExercises.get(schema) : undefined;
        if (!ex) {
          issues.push(
            error(
              'code-block',
              where,
              'A sql block needs schema="<exercise-id>" naming an SQL exercise.',
            ),
          );
          continue;
        }
        const res = await runSql(r.sql, sqlSpec(ex.data), block.code);
        if (res.error) issues.push(error('code-block', where, `Does not run: ${res.error}`));
      }
    }
  }
}

export interface GradingResult {
  issues: Issue[];
  truth: Record<string, string>;
}

/** Rules 2 and 3: graders, predict determinism and runnable code blocks. */
export async function checkGrading(content: Content, r: Runners): Promise<GradingResult> {
  const issues: Issue[] = [];
  for (const doc of content.exercises) await gradeExercise(doc, r, issues);
  for (const doc of content.problems) await gradeProblem(doc, r, issues);
  for (const doc of content.drills) await gradeDrill(doc, r, issues);

  const predict: PredictItem[] = [];
  for (const q of content.quizzes) {
    for (const i of (q.data['items'] as { id: string; type: string; code?: string }[]) ?? []) {
      if (i.type === 'predict' && i.code) predict.push({ id: i.id, code: i.code });
    }
  }
  for (const c of content.cards) {
    for (const i of (c.data['cards'] as { id: string; type: string; front?: string }[]) ?? []) {
      if (i.type === 'predict' && i.front) predict.push({ id: i.id, code: i.front });
    }
  }
  const truth = await checkPredict(predict, r, issues);
  await checkBlocks(content, r, issues);
  return { issues, truth };
}
