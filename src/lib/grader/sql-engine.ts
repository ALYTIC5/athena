import type { Post } from './engine';
import type {
  PlanCheck,
  SqlCell,
  SqlCheck,
  SqlCheckResult,
  SqlRequest,
  SqlResponse,
  SqlResult,
} from './sql-protocol';

interface RawResult {
  fields: { name: string; dataTypeID: number }[];
  rows: unknown[][];
}

/** The slice of PGlite the engine uses (kept narrow so it can be faked). */
export interface DbLike {
  exec(sql: string, options?: { rowMode: 'array' }): Promise<RawResult[]>;
  query(sql: string, params?: unknown[], options?: { rowMode: 'array' }): Promise<RawResult>;
  clone(): Promise<DbLike>;
  close(): Promise<void>;
}

export type CreateDb = (extensions: string[]) => Promise<DbLike>;

const OID_DATE = 1082;
const OID_NUMERIC = 1700;

/** Make a cell JSON-safe and comparable: bigint and numeric to number, dates to ISO strings. */
export function normaliseValue(value: unknown, typeOid: number): SqlCell {
  if (value === null || value === undefined) return null;
  if (typeof value === 'bigint') {
    return Number.isSafeInteger(Number(value)) ? Number(value) : value.toString();
  }
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  if (value instanceof Date) {
    return typeOid === OID_DATE ? value.toISOString().slice(0, 10) : value.toISOString();
  }
  if (typeof value === 'string') {
    if (typeOid === OID_NUMERIC) {
      const n = Number(value);
      return Number.isNaN(n) ? value : n;
    }
    return value;
  }
  if (value instanceof Uint8Array) {
    return '\\x' + [...value].map((b) => b.toString(16).padStart(2, '0')).join('');
  }
  return JSON.stringify(value, (_k, v: unknown) => (typeof v === 'bigint' ? Number(v) : v));
}

export function normaliseResult(raw: RawResult): SqlResult {
  return {
    fields: raw.fields.map((f) => f.name),
    rows: raw.rows.map((row) =>
      row.map((v, i) => normaliseValue(v, raw.fields[i]?.dataTypeID ?? 0)),
    ),
  };
}

function errorInfo(e: unknown): { message: string; code?: string } {
  const message = e instanceof Error ? e.message : String(e);
  const code = (e as { code?: unknown } | null)?.code;
  return typeof code === 'string' ? { message, code } : { message };
}

function planNodeTypes(plan: unknown): string[] {
  const found: string[] = [];
  const walk = (node: unknown) => {
    if (Array.isArray(node)) node.forEach(walk);
    else if (node && typeof node === 'object') {
      for (const [k, v] of Object.entries(node)) {
        if (k === 'Node Type' && typeof v === 'string') found.push(v);
        else walk(v);
      }
    }
  };
  walk(plan);
  return found;
}

async function explain(db: DbLike, query: string): Promise<string[]> {
  const r = await db.query(`EXPLAIN (FORMAT JSON) ${query.replace(/;\s*$/, '')}`, [], {
    rowMode: 'array',
  });
  const cell = r.rows[0]?.[0];
  const plan: unknown = typeof cell === 'string' ? JSON.parse(cell) : cell;
  return planNodeTypes(plan);
}

async function runChecks(db: DbLike, checks: SqlCheck[]): Promise<SqlCheckResult[]> {
  const out: SqlCheckResult[] = [];
  for (const [index, check] of checks.entries()) {
    if (typeof check === 'string') {
      try {
        const r = await db.query(check, [], { rowMode: 'array' });
        const ok = r.rows.length === 1 && r.rows[0]?.length === 1 && r.rows[0][0] === true;
        out.push({ index, ok, detail: ok ? '' : 'The check query did not return true.' });
      } catch (e) {
        out.push({ index, ok: false, detail: errorInfo(e).message });
      }
    } else {
      try {
        await db.exec(check.sql);
        out.push({
          index,
          ok: false,
          detail: `Expected error ${check.expectError}, but the statement succeeded.`,
        });
      } catch (e) {
        const code = errorInfo(e).code;
        const ok = code === check.expectError;
        out.push({
          index,
          ok,
          detail: ok
            ? ''
            : `Expected error ${check.expectError}, got ${code ?? 'a different error'}.`,
        });
      }
    }
  }
  return out;
}

async function planAndStructure(
  db: DbLike,
  sql: string,
  planCheck: PlanCheck | undefined,
  queueClaim: boolean,
): Promise<string[]> {
  const problems: string[] = [];
  if (planCheck) {
    await db.exec('ANALYZE');
    const types = await explain(db, planCheck.query);
    if (!types.some((t) => planCheck.accept.includes(t))) {
      problems.push(
        `The query plan does not use an index (found: ${types.join(', ') || 'nothing'}).`,
      );
    }
  }
  if (queueClaim) {
    const text = sql.replace(/;\s*$/, '');
    if (text.includes(';')) problems.push('Use a single statement.');
    if (!/^\s*update\b/i.test(text)) problems.push('The claim must be an UPDATE statement.');
    if (!/for\s+update\s+skip\s+locked/i.test(text)) problems.push('Use FOR UPDATE SKIP LOCKED.');
    if (!/\breturning\b/i.test(text)) problems.push('Use RETURNING to hand the claimed row back.');
    if (/^\s*update\b/i.test(text)) {
      try {
        const types = await explain(db, text);
        if (!types.includes('LockRows')) problems.push('The plan has no row locking (LockRows).');
      } catch (e) {
        problems.push(errorInfo(e).message);
      }
    }
  }
  return problems;
}

/**
 * Worker-side SQL logic shared by the browser worker and the Node worker thread. A template
 * database is built once per schema; every request runs on a fresh clone that is closed afterwards.
 * No wrapping transaction is used, so COMMIT and DDL inside the learner's SQL behave normally.
 */
export function createSqlEngine(createDb: CreateDb) {
  const templates = new Map<string, Promise<DbLike>>();

  function template(schema: string, extensions: string[]): Promise<DbLike> {
    const key = JSON.stringify([extensions, schema]);
    let t = templates.get(key);
    if (!t) {
      t = (async () => {
        const db = await createDb(extensions);
        for (const ext of extensions) await db.exec(`CREATE EXTENSION IF NOT EXISTS ${ext}`);
        await db.exec(schema);
        return db;
      })();
      templates.set(key, t);
    }
    return t;
  }

  async function handle(req: SqlRequest, post: Post<SqlResponse>): Promise<void> {
    try {
      post({ type: 'progress', id: req.id, stage: 'Loading PostgreSQL' });
      const base = await template(req.schema, req.extensions);
      const db = await base.clone();
      post({ type: 'started', id: req.id });
      const response: SqlResponse = { id: req.id, checks: [], structure: [] };
      try {
        try {
          const results = await db.exec(req.sql, { rowMode: 'array' });
          const last = results[results.length - 1];
          if (last) response.result = normaliseResult(last);
        } catch (e) {
          response.error = errorInfo(e);
        }
        if (!response.error) {
          response.checks = await runChecks(db, req.checks ?? []);
          response.structure = await planAndStructure(
            db,
            req.sql,
            req.planCheck,
            req.queueClaim ?? false,
          );
        }
      } finally {
        await db.close();
      }
      post({ type: 'response', response });
    } catch (e) {
      post({ type: 'failure', id: req.id, message: e instanceof Error ? e.message : String(e) });
    }
  }

  return { handle };
}
