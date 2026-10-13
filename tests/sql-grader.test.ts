import { readFileSync, readdirSync } from 'node:fs';
import { afterAll, describe, expect, it } from 'vitest';
import { parse } from 'yaml';
import { createNodeSqlRunner } from '../src/lib/grader/node-client';
import { compareResults } from '../src/lib/grader/sql-compare';
import { normaliseValue } from '../src/lib/grader/sql-engine';
import { gradeSql, runSql, type SqlExerciseSpec } from '../src/lib/grader/sql-grade';

const runner = createNodeSqlRunner();
afterAll(() => runner.dispose());

interface SampleYaml {
  id: string;
  runtime: string;
  schema: string;
  extensions?: string[];
  referenceSolution: string;
  compare: 'none' | { orderMatters?: boolean; numericTolerance?: number };
  checks?: SqlExerciseSpec['checks'];
  timeoutMs?: number;
  wrongSolutions: { label: string; code: string }[];
  planCheck?: SqlExerciseSpec['planCheck'];
  queueClaim?: boolean;
}

function specOf(y: SampleYaml): SqlExerciseSpec {
  return {
    schema: y.schema,
    extensions: y.extensions ?? [],
    referenceSolution: y.referenceSolution,
    compare: y.compare,
    checks: y.checks ?? [],
    planCheck: y.planCheck,
    queueClaim: y.queueClaim,
    timeoutMs: y.timeoutMs ?? 5000,
  };
}

describe('value normalisation and comparison', () => {
  it('normalises bigint, numeric, dates and timestamps', () => {
    expect(normaliseValue(5n, 20)).toBe(5);
    expect(normaliseValue('12.50', 1700)).toBe(12.5);
    expect(normaliseValue(new Date('2026-11-02T00:00:00Z'), 1082)).toBe('2026-11-02');
    expect(normaliseValue(new Date('2026-11-02T09:00:00Z'), 1184)).toBe('2026-11-02T09:00:00.000Z');
    expect(normaliseValue(null, 25)).toBeNull();
    expect(normaliseValue({ a: 1 }, 3802)).toBe('{"a":1}');
  });

  const r = (rows: (string | number | null)[][], fields = ['a', 'b']) => ({ fields, rows });
  it('treats rows as a multiset unless order matters', () => {
    const a = r([
      [1, 'x'],
      [2, 'y'],
    ]);
    const b = r([
      [2, 'y'],
      [1, 'x'],
    ]);
    expect(compareResults(a, b).equal).toBe(true);
    expect(compareResults(a, b, { orderMatters: true }).equal).toBe(false);
  });
  it('matches column names case-insensitively, in order', () => {
    expect(compareResults(r([[1, 2]], ['A', 'B']), r([[1, 2]], ['a', 'b'])).equal).toBe(true);
    expect(compareResults(r([[1, 2]], ['b', 'a']), r([[1, 2]], ['a', 'b'])).equal).toBe(false);
  });
  it('uses numeric tolerance and NULL equals NULL', () => {
    expect(
      compareResults(r([[1.0004, null]]), r([[1, null]]), { numericTolerance: 0.001 }).equal,
    ).toBe(true);
    expect(
      compareResults(r([[1.01, null]]), r([[1, null]]), { numericTolerance: 0.001 }).equal,
    ).toBe(false);
    expect(compareResults(r([[1, null]]), r([[1, 0]])).equal).toBe(false);
  });
  it('detects duplicate-row differences', () => {
    expect(
      compareResults(
        r([
          [1, 'x'],
          [1, 'x'],
        ]),
        r([
          [1, 'x'],
          [2, 'y'],
        ]),
      ).equal,
    ).toBe(false);
  });
});

describe('sample SQL exercises (reference passes, every wrong solution fails)', () => {
  const dir = 'src/content/exercises';
  const files = readdirSync(dir).filter((f) => f.startsWith('sample-sql-'));
  it('finds the three samples', () => expect(files).toHaveLength(3));
  for (const file of files) {
    const y = parse(readFileSync(`${dir}/${file}`, 'utf8')) as SampleYaml;
    it(`${y.id}: reference solution passes`, async () => {
      const report = await gradeSql(runner, specOf(y), y.referenceSolution);
      expect(report.error).toBeUndefined();
      expect(report.mismatch).toBeUndefined();
      expect(report.failures).toEqual([]);
      expect(report.passed).toBe(true);
    }, 120000);
    for (const wrong of y.wrongSolutions) {
      it(`${y.id}: fails "${wrong.label}"`, async () => {
        const report = await gradeSql(runner, specOf(y), wrong.code);
        expect(report.passed).toBe(false);
      }, 120000);
    }
  }
});

describe('runtime behaviour', () => {
  const base: SqlExerciseSpec = {
    schema:
      'CREATE TABLE t (id integer PRIMARY KEY, n integer); INSERT INTO t VALUES (1, 10), (2, 20);',
    extensions: [],
    referenceSolution: 'SELECT 1',
    compare: 'none',
    checks: [],
    timeoutMs: 5000,
  };

  it('returns database errors with the SQLSTATE code', async () => {
    const r = await runSql(runner, base, 'SELECT * FROM missing_table');
    expect(r.passed).toBe(false);
    expect(r.errorCode).toBe('42P01');
  }, 120000);

  it('uses a fresh clone per run, so changes never leak', async () => {
    await runSql(runner, base, 'DELETE FROM t');
    const r = await runSql(runner, base, 'SELECT count(*) AS c FROM t');
    expect(r.result?.rows).toEqual([[2]]);
  }, 120000);

  it('lets the learner COMMIT and run DDL without breaking the grader', async () => {
    const r = await runSql(
      runner,
      base,
      'BEGIN; INSERT INTO t VALUES (3, 30); COMMIT; SELECT count(*) AS c FROM t',
    );
    expect(r.error).toBeUndefined();
    expect(r.result?.rows).toEqual([[3]]);
  }, 120000);

  it('keeps duplicate column names via array row mode', async () => {
    const r = await runSql(runner, base, 'SELECT id, id FROM t ORDER BY id');
    expect(r.result?.fields).toEqual(['id', 'id']);
    expect(r.result?.rows[0]).toEqual([1, 1]);
  }, 120000);

  it('terminates a runaway query and recovers', async () => {
    const slow = await runSql(
      runner,
      { ...base, timeoutMs: 1000 },
      'SELECT count(*) FROM generate_series(1, 100000000000)',
    );
    expect(slow.timedOut).toBe(true);
    expect(slow.error).toBe(
      'Your code ran for more than 1 seconds. Look for a loop that never ends.',
    );
    const ok = await runSql(runner, base, 'SELECT 1 AS one');
    expect(ok.result?.rows).toEqual([[1]]);
  }, 120000);

  it('plan check accepts an index plan and rejects a sequential scan', async () => {
    const schema = `CREATE TABLE calls (id integer PRIMARY KEY, caller text, started_at timestamptz);
      INSERT INTO calls SELECT g, 'caller-' || (g % 5000), now() - (g || ' minutes')::interval FROM generate_series(1, 20000) g;`;
    const spec: SqlExerciseSpec = {
      ...base,
      schema,
      timeoutMs: 20000,
      planCheck: {
        query: "SELECT * FROM calls WHERE caller = 'caller-42'",
        accept: ['Index Scan', 'Index Only Scan', 'Bitmap Index Scan'],
      },
    };
    const good = await gradeSql(runner, spec, 'CREATE INDEX calls_caller_idx ON calls (caller)');
    expect(good.failures).toEqual([]);
    expect(good.passed).toBe(true);
    const bad = await gradeSql(runner, spec, 'SELECT 1');
    expect(bad.passed).toBe(false);
    expect(bad.failures.join(' ')).toContain('does not use an index');
  }, 120000);

  it('queue-claim structure check requires UPDATE ... FOR UPDATE SKIP LOCKED ... RETURNING', async () => {
    const spec: SqlExerciseSpec = {
      ...base,
      schema:
        "CREATE TABLE jobs (id integer PRIMARY KEY, status text NOT NULL DEFAULT 'queued', run_after timestamptz NOT NULL DEFAULT now()); INSERT INTO jobs (id) VALUES (1), (2), (3);",
      referenceSolution:
        "UPDATE jobs SET status = 'running' WHERE id = (SELECT id FROM jobs WHERE status = 'queued' ORDER BY id FOR UPDATE SKIP LOCKED LIMIT 1) RETURNING id",
      compare: { orderMatters: true },
      queueClaim: true,
    };
    const ref = await gradeSql(runner, spec, spec.referenceSolution);
    expect(ref.failures).toEqual([]);
    expect(ref.passed).toBe(true);
    const noLock = await gradeSql(
      runner,
      spec,
      "UPDATE jobs SET status = 'running' WHERE id = (SELECT id FROM jobs WHERE status = 'queued' ORDER BY id LIMIT 1) RETURNING id",
    );
    expect(noLock.passed).toBe(false);
    expect(noLock.failures.join(' ')).toContain('SKIP LOCKED');
  }, 120000);

  it('expectError check fails when the statement succeeds or errors differently', async () => {
    const spec: SqlExerciseSpec = {
      ...base,
      checks: [
        { sql: 'INSERT INTO t VALUES (1, 99)', expectError: '23505' },
        { sql: 'INSERT INTO t VALUES (9, 9)', expectError: '23505' },
      ],
    };
    const r = await gradeSql(runner, spec, 'SELECT 1');
    expect(r.failures).toHaveLength(1);
    expect(r.failures[0]).toContain('succeeded');
  }, 120000);
});
