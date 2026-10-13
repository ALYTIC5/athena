/// <reference lib="webworker" />
import { createEngine, type PyodideLike } from '../lib/grader/engine';
import { PYODIDE_CDN_URL } from '../lib/grader/protocol';
import type { PythonRequest } from '../lib/grader/protocol';

const engine = createEngine(async () => {
  // Module worker: import the ES module build from the pinned CDN path (no importScripts).
  const mod = (await import(/* @vite-ignore */ `${PYODIDE_CDN_URL}pyodide.mjs`)) as {
    loadPyodide: (options: { indexURL: string; env: Record<string, string> }) => Promise<unknown>;
  };
  return (await mod.loadPyodide({
    indexURL: PYODIDE_CDN_URL,
    env: { PYTHONHASHSEED: '0' },
  })) as PyodideLike;
});

self.onmessage = (e: MessageEvent<PythonRequest>) => {
  void engine.handle(e.data, (event) => self.postMessage(event));
};
