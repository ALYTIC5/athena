import { parentPort, workerData } from 'node:worker_threads';
import { loadPyodide } from 'pyodide';
import { createEngine, type PyodideLike } from './engine';
import type { PythonRequest } from './protocol';

const cacheDir = (workerData as { packageCacheDir?: string } | null)?.packageCacheDir;

const engine = createEngine(
  async () =>
    (await loadPyodide({
      env: { PYTHONHASHSEED: '0', ...(process.env.TZ ? { TZ: process.env.TZ } : {}) },
      ...(cacheDir ? { packageCacheDir: cacheDir } : {}),
    })) as unknown as PyodideLike,
);

parentPort?.on('message', (req: PythonRequest) => {
  void engine.handle(req, (event) => parentPort?.postMessage(event));
});
