import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { Worker } from 'node:worker_threads';
import { createRunner, type Runner, type WorkerHandle } from './runner';
import type { PythonRequest, WorkerEvent } from './protocol';

export interface NodeRunnerOptions {
  /** Directory for downloaded Pyodide packages (pytest, numpy, ...). Keep it between runs in CI. */
  packageCacheDir?: string;
  onProgress?: (stage: string) => void;
}

/** Same message protocol and timeout path as the browser, on a `worker_threads` worker. */
export function createNodeRunner(options: NodeRunnerOptions = {}): Runner {
  const cacheDir = options.packageCacheDir ? resolve(options.packageCacheDir) : undefined;
  if (cacheDir) mkdirSync(cacheDir, { recursive: true });
  const spawn = (): WorkerHandle => {
    const worker = new Worker(new URL('./node-worker-entry.mjs', import.meta.url), {
      workerData: { packageCacheDir: cacheDir },
    });
    return {
      post: (request: PythonRequest) => worker.postMessage(request),
      terminate: () => worker.terminate(),
      onEvent: (listener: (e: WorkerEvent) => void) => worker.on('message', listener),
      onCrash: (listener: (m: string) => void) => {
        worker.on('error', (e: Error) => listener(e.message));
        worker.on('exit', (code) => {
          if (code !== 0) listener(`Worker exited with code ${code}`);
        });
      },
    };
  };
  return createRunner(spawn, options.onProgress);
}
