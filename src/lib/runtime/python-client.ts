import { createRunner, type Runner, type WorkerHandle } from '../grader/runner';
import type { PythonRequest, WorkerEvent } from '../grader/protocol';

let shared: Runner | undefined;
const progressListeners = new Set<(stage: string) => void>();

/** One Pyodide worker per page, created on first use. */
export function getPythonRunner(onProgress?: (stage: string) => void): Runner {
  if (onProgress) progressListeners.add(onProgress);
  shared ??= createRunner(
    (): WorkerHandle => {
      const worker = new Worker(new URL('../../workers/pyodide.worker.ts', import.meta.url), {
        type: 'module',
      });
      return {
        post: (request: PythonRequest) => worker.postMessage(request),
        terminate: () => worker.terminate(),
        onEvent: (listener: (e: WorkerEvent) => void) =>
          worker.addEventListener('message', (m) =>
            listener((m as MessageEvent<WorkerEvent>).data),
          ),
        onCrash: (listener: (message: string) => void) =>
          worker.addEventListener('error', (e) =>
            listener(e.message || 'The Python worker crashed.'),
          ),
      };
    },
    (stage) => progressListeners.forEach((l) => l(stage)),
  );
  return shared;
}
