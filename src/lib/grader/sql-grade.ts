import type { Runner } from './runner';
import { compareResults, type CompareOptions } from './sql-compare';
import type { PlanCheck, SqlCheck, SqlRequest, SqlResponse, SqlResult } from './sql-protocol';

export type SqlRunner = Runner<SqlRequest, SqlResponse>;

export interface SqlExerciseSpec {
  schema: string;
  extensions: string[];
  referenceSolution: string;
  /** `'none'` for DDL exercises graded only by checks. */
  compare: 'none' | CompareOptions;
  checks: SqlCheck[];
  planCheck?: PlanCheck | undefined;
  queueClaim?: boolean | undefined;
  timeoutMs: number;
}

export interface SqlGradeReport {
  passed: boolean;
  result?: SqlResult;
  /** Database error, timeout message or worker failure. */
  error?: string;
  errorCode?: string;
  timedOut?: boolean;
  mismatch?: string;
  failures: string[];
}

async function execute(
  runner: SqlRunner,
  spec: SqlExerciseSpec,
  sql: string,
  withChecks: boolean,
): Promise<{ response?: SqlResponse; error?: string; timedOut?: boolean }> {
  const outcome = await runner.run(
    {
      type: 'sql',
      schema: spec.schema,
      extensions: spec.extensions,
      sql,
      ...(withChecks
        ? {
            checks: spec.checks,
            ...(spec.planCheck ? { planCheck: spec.planCheck } : {}),
            ...(spec.queueClaim ? { queueClaim: true } : {}),
          }
        : {}),
    },
    spec.timeoutMs,
  );
  if (outcome.kind === 'timeout') return { error: outcome.message, timedOut: true };
  if (outcome.kind === 'failure') return { error: outcome.message };
  return { response: outcome.response };
}

/** The Run button: execute the learner's SQL and show the last result. */
export async function runSql(
  runner: SqlRunner,
  spec: SqlExerciseSpec,
  sql: string,
): Promise<SqlGradeReport> {
  const r = await execute(runner, spec, sql, false);
  if (!r.response) {
    return {
      passed: false,
      failures: [],
      error: r.error ?? 'Worker failed',
      timedOut: r.timedOut === true,
    };
  }
  const report: SqlGradeReport = { passed: !r.response.error, failures: [] };
  if (r.response.result) report.result = r.response.result;
  if (r.response.error) {
    report.error = r.response.error.message;
    if (r.response.error.code) report.errorCode = r.response.error.code;
  }
  return report;
}

/** The Check button: compare with the reference result, then run checks, plan and structure checks. */
export async function gradeSql(
  runner: SqlRunner,
  spec: SqlExerciseSpec,
  sql: string,
): Promise<SqlGradeReport> {
  const learner = await execute(runner, spec, sql, true);
  if (!learner.response) {
    return {
      passed: false,
      failures: [],
      error: learner.error ?? 'Worker failed',
      timedOut: learner.timedOut === true,
    };
  }
  const res = learner.response;
  const report: SqlGradeReport = { passed: false, failures: [] };
  if (res.result) report.result = res.result;
  if (res.error) {
    report.error = res.error.message;
    if (res.error.code) report.errorCode = res.error.code;
    return report;
  }

  if (spec.compare !== 'none') {
    const ref = await execute(runner, spec, spec.referenceSolution, false);
    const expected = ref.response?.result;
    if (!expected) {
      report.failures.push('The reference solution did not return a result.');
    } else if (!res.result) {
      report.mismatch = 'Your statement did not return rows. Use a SELECT.';
    } else {
      const cmp = compareResults(res.result, expected, spec.compare);
      if (!cmp.equal) report.mismatch = cmp.reason ?? 'The result differs.';
    }
  }
  for (const c of res.checks)
    if (!c.ok) report.failures.push(c.detail || `Check ${c.index + 1} failed.`);
  report.failures.push(...res.structure);
  report.passed = report.mismatch === undefined && report.failures.length === 0;
  return report;
}
