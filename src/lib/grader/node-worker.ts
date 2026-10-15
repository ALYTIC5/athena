import { parentPort, workerData } from 'node:worker_threads';
import { loadPyodide } from 'pyodide';
import { createEngine, type PyodideLike } from './engine';
import type { PythonRequest } from './protocol';

const data = workerData as { packageCacheDir?: string; env?: Record<string, string> } | null;
const cacheDir = data?.packageCacheDir;

const engine = createEngine(
  async () =>
    (await loadPyodide({
      env: {
        PYTHONHASHSEED: '0',
        ...(process.env.TZ ? { TZ: process.env.TZ } : {}),
        ...(data?.env ?? {}),
      },
      ...(cacheDir ? { packageCacheDir: cacheDir } : {}),
    })) as unknown as PyodideLike,
);

parentPort?.on('message', (req: PythonRequest) => {
  void engine.handle(req, (event) => parentPort?.postMessage(event));
});
