import { parentPort } from 'node:worker_threads';
import { createPglite } from './pglite-db';
import { createSqlEngine } from './sql-engine';
import type { SqlRequest } from './sql-protocol';

const engine = createSqlEngine(createPglite);

parentPort?.on('message', (req: SqlRequest) => {
  void engine.handle(req, (event) => parentPort?.postMessage(event));
});
