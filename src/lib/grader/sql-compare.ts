import type { SqlCell, SqlResult } from './sql-protocol';

export interface CompareOptions {
  orderMatters?: boolean;
  numericTolerance?: number;
}

export interface CompareOutcome {
  equal: boolean;
  /** Plain-language reason when not equal. */
  reason?: string;
}

function cellEqual(a: SqlCell, b: SqlCell, tolerance: number): boolean {
  if (a === null || b === null) return a === b;
  if (typeof a === 'number' && typeof b === 'number') return Math.abs(a - b) <= tolerance;
  return a === b;
}

function rowEqual(a: SqlCell[], b: SqlCell[], tolerance: number): boolean {
  return a.length === b.length && a.every((cell, i) => cellEqual(cell, b[i] as SqlCell, tolerance));
}

/**
 * Column names are compared case-insensitively and in order. Rows are compared as a multiset
 * unless `orderMatters`; numbers match within `numericTolerance`; NULL equals NULL.
 */
export function compareResults(
  actual: SqlResult,
  expected: SqlResult,
  options: CompareOptions = {},
): CompareOutcome {
  const tolerance = options.numericTolerance ?? 0;
  const names = (r: SqlResult) => r.fields.map((f) => f.toLowerCase());
  if (names(actual).join('|') !== names(expected).join('|')) {
    return {
      equal: false,
      reason: `Expected columns ${expected.fields.join(', ')} but got ${actual.fields.join(', ') || 'none'}.`,
    };
  }
  if (actual.rows.length !== expected.rows.length) {
    return {
      equal: false,
      reason: `Expected ${expected.rows.length} rows but got ${actual.rows.length}.`,
    };
  }
  if (options.orderMatters) {
    const bad = expected.rows.findIndex(
      (row, i) => !rowEqual(actual.rows[i] as SqlCell[], row, tolerance),
    );
    return bad === -1
      ? { equal: true }
      : { equal: false, reason: `Row ${bad + 1} differs from the expected result.` };
  }
  const remaining = [...actual.rows];
  for (const row of expected.rows) {
    const at = remaining.findIndex((r) => rowEqual(r, row, tolerance));
    if (at === -1)
      return { equal: false, reason: 'The rows returned differ from the expected rows.' };
    remaining.splice(at, 1);
  }
  return { equal: true };
}
