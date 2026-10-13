import { createRunner } from '../grader/runner';
import type { WorkerEvent } from '../grader/protocol';
import type { SqlRunner } from '../grader/sql-grade';
import type { SqlRequest, SqlResponse } from '../grader/sql-protocol';

let shared: SqlRunner | undefined;
const progressListeners = new Set<(stage: string) => void>();

/** One PGlite worker per page, created on first use. */
export function getSqlRunner(onProgress?: (stage: string) => void): SqlRunner {
  if (onProgress) progressListeners.add(onProgress);
  shared ??= createRunner<SqlRequest, SqlResponse>(
    () => {
      const worker = new Worker(new URL('../../workers/pglite.worker.ts', import.meta.url), {
        type: 'module',
      });
      return {
        post: (request: SqlRequest) => worker.postMessage(request),
        terminate: () => worker.terminate(),
        onEvent: (listener: (e: WorkerEvent<SqlResponse>) => void) =>
          worker.addEventListener('message', (m) =>
            listener((m as MessageEvent<WorkerEvent<SqlResponse>>).data),
          ),
        onCrash: (listener: (message: string) => void) =>
          worker.addEventListener('error', (e) => listener(e.message || 'The SQL worker crashed.')),
      };
    },
    (stage) => progressListeners.forEach((l) => l(stage)),
  );
  return shared;
}
