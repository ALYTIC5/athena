/** JSON-safe cell value after normalisation (see `normaliseValue`). */
export type SqlCell = string | number | boolean | null;

export interface SqlResult {
  fields: string[];
  rows: SqlCell[][];
}

export type SqlCheck = string | { sql: string; expectError: string };

export interface PlanCheck {
  /** Query to EXPLAIN after the learner's statement ran and ANALYZE was run. */
  query: string;
  /** Accepted plan node types, for example `Index Scan`, `Index Only Scan`, `Bitmap Index Scan`. */
  accept: string[];
}

export interface SqlRequest {
  type: 'sql';
  id: number;
  schema: string;
  extensions: string[];
  /** The statement(s) to run; the result of the last one is returned. */
  sql: string;
  checks?: SqlCheck[];
  planCheck?: PlanCheck;
  /** Structural checks for a queue-claim statement (`UPDATE ... FOR UPDATE SKIP LOCKED ... RETURNING`). */
  queueClaim?: boolean;
}

export interface SqlCheckResult {
  index: number;
  ok: boolean;
  detail: string;
}

export interface SqlResponse {
  id: number;
  result?: SqlResult;
  error?: { message: string; code?: string };
  checks: SqlCheckResult[];
  /** Messages for failed plan or structure checks. */
  structure: string[];
}

export const SQL_DEFAULT_TIMEOUT_MS = 5000;
