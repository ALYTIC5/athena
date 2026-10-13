import { PGlite } from '@electric-sql/pglite';
import { vector } from '@electric-sql/pglite-pgvector';
import type { CreateDb, DbLike } from './sql-engine';

const AVAILABLE = { vector } as const;

/** Create a PGlite instance with the named extensions (only those bundled here are allowed). */
export const createPglite: CreateDb = async (extensions) => {
  const selected: Record<string, (typeof AVAILABLE)[keyof typeof AVAILABLE]> = {};
  for (const name of extensions) {
    if (!(name in AVAILABLE)) throw new Error(`Extension not available: ${name}`);
    selected[name] = AVAILABLE[name as keyof typeof AVAILABLE];
  }
  return (await PGlite.create({ extensions: selected })) as unknown as DbLike;
};
