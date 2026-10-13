/// <reference lib="webworker" />
import { createPglite } from '../lib/grader/pglite-db';
import { createSqlEngine } from '../lib/grader/sql-engine';
import type { SqlRequest } from '../lib/grader/sql-protocol';

const engine = createSqlEngine(createPglite);

self.onmessage = (e: MessageEvent<SqlRequest>) => {
  void engine.handle(e.data, (event) => self.postMessage(event));
};
