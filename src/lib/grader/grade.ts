import type { Runner } from './runner';
import type { PythonResponse, TestResult } from './protocol';

export interface PythonExerciseSpec {
  kind: 'faded' | 'debug' | 'make' | 'write-tests';
  timeoutMs: number;
  packages: string[];
  visibleTests?: string | undefined;
  hiddenTests?: string | undefined;
  feedback: { test: string; message: string }[];
  implementations?: { correct: string; buggy: { label: string; code: string }[] } | undefined;
}

export interface GradedTest extends TestResult {
  hidden: boolean;
  /** Misconception message from the exercise's feedback mapping, for failing tests. */
  feedback?: string;
}

export interface GradeReport {
  passed: boolean;
  tests: GradedTest[];
  stdout: string;
  stderr: string;
  /** Load/syntax/runtime error from the learner's code, or a timeout or worker failure message. */
  error?: string;
  timedOut?: boolean;
}

/** Test names declared in a test source, in order (cheap static scan, used to label visibility). */
export function testNames(source: string | undefined): string[] {
  if (!source) return [];
  return [...source.matchAll(/^def (test_\w+)\s*\(/gm)].map((m) => m[1] as string);
}

function annotate(
  tests: TestResult[],
  hiddenNames: Set<string>,
  feedback: PythonExerciseSpec['feedback'],
): GradedTest[] {
  return tests.map((t) => {
    const hidden = hiddenNames.has(t.name);
    const map = feedback.find((f) => f.test === t.name);
    const graded: GradedTest = { ...t, hidden };
    if (t.status !== 'passed' && map) graded.feedback = map.message;
    // Hidden tests show only their name and the matching feedback, never the assertion detail.
    if (hidden) graded.message = '';
    return graded;
  });
}

function emptyReport(response: PythonResponse, error?: string): GradeReport {
  const r: GradeReport = {
    passed: false,
    tests: [],
    stdout: response.stdout,
    stderr: response.stderr,
  };
  if (error !== undefined) r.error = error;
  return r;
}

/**
 * Run the learner's code against the visible tests (`check: false`) or against visible plus hidden
 * tests (`check: true`).
 */
export async function gradePython(
  runner: Runner,
  spec: PythonExerciseSpec,
  code: string,
  check: boolean,
): Promise<GradeReport> {
  const visible = spec.visibleTests ?? '';
  const hidden = check ? (spec.hiddenTests ?? '') : '';
  const tests = [visible, hidden].filter((s) => s.trim() !== '').join('\n\n');
  const outcome = await runner.run(
    { type: 'tests', code, tests, packages: spec.packages },
    spec.timeoutMs,
  );
  if (outcome.kind === 'timeout') {
    return {
      passed: false,
      tests: [],
      stdout: '',
      stderr: '',
      error: outcome.message,
      timedOut: true,
    };
  }
  if (outcome.kind === 'failure') {
    return { passed: false, tests: [], stdout: '', stderr: '', error: outcome.message };
  }
  const { response } = outcome;
  if (response.error !== undefined) return emptyReport(response, response.error);
  const graded = annotate(response.tests ?? [], new Set(testNames(hidden)), spec.feedback);
  return {
    passed: graded.length > 0 && graded.every((t) => t.status === 'passed'),
    tests: graded,
    stdout: response.stdout,
    stderr: response.stderr,
  };
}

/** Run code with no tests (the Run button). */
export async function runPython(
  runner: Runner,
  code: string,
  packages: string[],
  timeoutMs: number,
): Promise<GradeReport> {
  const outcome = await runner.run({ type: 'run', code, packages }, timeoutMs);
  if (outcome.kind === 'timeout') {
    return {
      passed: false,
      tests: [],
      stdout: '',
      stderr: '',
      error: outcome.message,
      timedOut: true,
    };
  }
  if (outcome.kind === 'failure') {
    return { passed: false, tests: [], stdout: '', stderr: '', error: outcome.message };
  }
  const r = emptyReport(outcome.response, outcome.response.error);
  r.passed = outcome.response.error === undefined;
  return r;
}

export interface WriteTestsReport {
  passed: boolean;
  /** Plain-language findings, one per problem. */
  findings: string[];
}

/**
 * A write-tests exercise passes when the learner's tests pass on the correct implementation and
 * at least one test fails on every buggy implementation.
 */
export async function gradeWriteTests(
  runner: Runner,
  spec: PythonExerciseSpec,
  learnerTests: string,
): Promise<WriteTestsReport> {
  const impls = spec.implementations;
  if (!impls) throw new Error('write-tests exercise has no implementations');
  const packages = [...new Set(['pytest', ...spec.packages])];
  const findings: string[] = [];

  const run = async (impl: string) => {
    const o = await runner.run(
      { type: 'pytest', impl, tests: learnerTests, packages },
      spec.timeoutMs,
    );
    if (o.kind === 'timeout') return { error: o.message, tests: [] as TestResult[] };
    if (o.kind === 'failure') return { error: o.message, tests: [] as TestResult[] };
    return { error: o.response.error, tests: o.response.tests ?? [] };
  };

  const correct = await run(impls.correct);
  if (correct.error !== undefined) return { passed: false, findings: [correct.error] };
  const bad = correct.tests.filter((t) => t.status !== 'passed');
  if (bad.length > 0) {
    findings.push(
      `These tests fail on the correct implementation, so they check the wrong thing: ${bad
        .map((t) => t.name)
        .join(', ')}.`,
    );
  }
  for (const buggy of impls.buggy) {
    const r = await run(buggy.code);
    if (r.error !== undefined) {
      findings.push(r.error);
      continue;
    }
    if (!r.tests.some((t) => t.status !== 'passed')) {
      findings.push(`No test caught a bug: ${buggy.label}.`);
    }
  }
  return { passed: findings.length === 0, findings };
}

// ---- credit, hints, solution lock --------------------------------------------------------------

export interface AttemptState {
  passed: boolean;
  hintsUsed: 0 | 1 | 2 | 3;
  tutorUsed: boolean;
  solutionViewed: boolean;
}

const HINT_CREDIT = [1, 0.75, 0.5, 0.25] as const;

/** SPEC §7: 1.0 no hints; 0.75 / 0.5 / 0.25 after hint 1 / 2 / 3; tutor caps at 0.75; solution first earns 0. */
export function creditFor(a: AttemptState): number {
  if (!a.passed || a.solutionViewed) return 0;
  const base = HINT_CREDIT[a.hintsUsed];
  return a.tutorUsed ? Math.min(base, 0.75) : base;
}

/** Only a full-credit pass counts as unaided. */
export function isUnaided(a: AttemptState): boolean {
  return creditFor(a) === 1;
}

/** Solution unlocks after a pass, or after three failed checks plus all three hints. */
export function solutionUnlocked(args: {
  passed: boolean;
  failedChecks: number;
  hintsUsed: number;
}): boolean {
  return args.passed || (args.failedChecks >= 3 && args.hintsUsed >= 3);
}

export const STUCK_AFTER_MS = 15 * 60 * 1000;

/** After about 15 minutes without a pass, suggest the first hint or the tutor prompt. */
export function shouldNudgeStuck(args: {
  passed: boolean;
  startedAt: number;
  now: number;
}): boolean {
  return !args.passed && args.now - args.startedAt >= STUCK_AFTER_MS;
}
