import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { Worker } from 'node:worker_threads';
import { createRunner, type Runner, type WorkerHandle } from './runner';
import type { PythonRequest, PythonResponse, WorkerEvent } from './protocol';
import type { SqlRequest, SqlResponse } from './sql-protocol';

export interface NodeRunnerOptions {
  /** Directory for downloaded Pyodide packages (pytest, numpy, ...). Keep it between runs in CI. */
  packageCacheDir?: string;
  /** Extra interpreter environment, for example `{ TZ: 'Pacific/Kiritimati', PYTHONHASHSEED: '1' }`. */
  env?: Record<string, string>;
  onProgress?: (stage: string) => void;
}

function handleFor<Req extends { id: number }, Res extends { id: number }>(
  worker: Worker,
): WorkerHandle<Req, Res> {
  return {
    post: (request: Req) => worker.postMessage(request),
    terminate: () => worker.terminate(),
    onEvent: (listener: (e: WorkerEvent<Res>) => void) => worker.on('message', listener),
    onCrash: (listener: (m: string) => void) => {
      worker.on('error', (e: Error) => listener(e.message));
      worker.on('exit', (code) => {
        if (code !== 0) listener(`Worker exited with code ${code}`);
      });
    },
  };
}

/** Same message protocol and timeout path as the browser, on a `worker_threads` worker. */
export function createNodeRunner(
  options: NodeRunnerOptions = {},
): Runner<PythonRequest, PythonResponse> {
  const cacheDir = options.packageCacheDir ? resolve(options.packageCacheDir) : undefined;
  if (cacheDir) mkdirSync(cacheDir, { recursive: true });
  return createRunner<PythonRequest, PythonResponse>(
    () =>
      handleFor(
        new Worker(new URL('./node-worker-entry.mjs', import.meta.url), {
          workerData: { packageCacheDir: cacheDir, env: options.env },
        }),
      ),
    options.onProgress,
  );
}

/** SQL grading on PGlite in a worker thread, with the same timeout-and-recreate behaviour. */
export function createNodeSqlRunner(
  options: { onProgress?: (stage: string) => void } = {},
): Runner<SqlRequest, SqlResponse> {
  return createRunner<SqlRequest, SqlResponse>(
    () => handleFor(new Worker(new URL('./node-sql-worker-entry.mjs', import.meta.url))),
    options.onProgress,
  );
}
