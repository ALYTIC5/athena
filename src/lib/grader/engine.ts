import { HARNESS_SOURCE, trimTraceback } from './harness';
import type { PythonRequest, PythonResponse, TestResult, WorkerEvent } from './protocol';

/** The slice of the Pyodide API the engine uses (kept narrow so tests can fake it). */
export interface PyodideLike {
  runPython(code: string, options?: { globals?: unknown }): unknown;
  runPythonAsync(
    code: string,
    options?: { globals?: unknown; filename?: string },
  ): Promise<unknown>;
  loadPackage(
    names: string[],
    options?: { messageCallback?: (m: string) => void; errorCallback?: (m: string) => void },
  ): Promise<unknown>;
  globals: { get(name: string): unknown };
  setStdout(options: { batched: (line: string) => void }): void;
  setStderr(options: { batched: (line: string) => void }): void;
}

export type LoadPyodide = () => Promise<PyodideLike>;
export type Post<R extends { id: number } = PythonResponse> = (event: WorkerEvent<R>) => void;

type PyFn = (arg: string) => string;

/**
 * Worker-side logic shared by the browser Web Worker and the Node worker thread, so the validator
 * grades with exactly the code the browser uses.
 */
export function createEngine(loadPyodide: LoadPyodide) {
  let pyodide: PyodideLike | undefined;
  const loaded = new Set<string>();
  let stdout: string[] = [];
  let stderr: string[] = [];

  async function init(id: number, post: Post): Promise<PyodideLike> {
    if (pyodide) return pyodide;
    post({ type: 'progress', id, stage: 'Loading Python' });
    const py = await loadPyodide();
    py.setStdout({ batched: (line) => stdout.push(line) });
    py.setStderr({ batched: (line) => stderr.push(line) });
    py.runPython(HARNESS_SOURCE);
    pyodide = py;
    return py;
  }

  async function ensurePackages(py: PyodideLike, names: string[], id: number, post: Post) {
    const missing = names.filter((n) => !loaded.has(n));
    if (missing.length === 0) return;
    post({ type: 'progress', id, stage: `Loading ${missing.join(', ')}` });
    await py.loadPackage(missing, {
      messageCallback: () => undefined,
      errorCallback: () => undefined,
    });
    for (const n of missing) loaded.add(n);
    (py.globals.get('_athena_rebaseline') as () => void)();
  }

  function finish(id: number): PythonResponse {
    const response: PythonResponse = { id, stdout: stdout.join('\n'), stderr: stderr.join('\n') };
    stdout = [];
    stderr = [];
    return response;
  }

  async function handle(req: PythonRequest, post: Post): Promise<void> {
    try {
      const py = await init(req.id, post);
      await ensurePackages(py, req.packages ?? [], req.id, post);
      stdout = [];
      stderr = [];
      post({ type: 'started', id: req.id });

      if (req.type === 'run') {
        (py.globals.get('_athena_reset') as () => void)();
        const globals = (py.globals.get('_athena_new_globals') as () => unknown)();
        let error: string | undefined;
        try {
          await py.runPythonAsync(req.code, { globals, filename: '<learner>' });
        } catch (e) {
          error = trimTraceback(String(e instanceof Error ? e.message : e));
        }
        const out = finish(req.id);
        if (error !== undefined) out.error = error;
        post({ type: 'response', response: out });
        return;
      }

      const fnName =
        req.type === 'tests'
          ? '_athena_run_tests'
          : req.type === 'files'
            ? '_athena_run_files'
            : '_athena_run_pytest';
      const fn = py.globals.get(fnName) as PyFn;
      const payload =
        req.type === 'tests'
          ? { code: req.code, tests: req.tests }
          : req.type === 'files'
            ? { files: req.files, tests: req.tests }
            : { impl: req.impl, tests: req.tests };
      const raw = JSON.parse(fn(JSON.stringify(payload))) as {
        error?: string;
        tests: TestResult[];
      };
      const response = finish(req.id);
      response.tests = raw.tests.map((t) => ({ ...t, message: trimTraceback(t.message) }));
      if (raw.error !== undefined) response.error = trimTraceback(raw.error);
      post({ type: 'response', response });
    } catch (e) {
      post({
        type: 'failure',
        id: req.id,
        message: e instanceof Error ? e.message : String(e),
      });
    }
  }

  return { handle };
}
