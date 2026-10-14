/** Pinned Pyodide version. A unit test checks this equals the `pyodide` npm package version. */
export const PYODIDE_VERSION = '314.0.7';
export const PYODIDE_CDN_URL = `https://cdn.jsdelivr.net/pyodide/v${PYODIDE_VERSION}/full/`;

export const DEFAULT_TIMEOUT_MS = 5000;

export type PythonRequest =
  | { type: 'run'; id: number; code: string; packages?: string[] }
  | { type: 'tests'; id: number; code: string; tests: string; packages?: string[] }
  | { type: 'pytest'; id: number; impl: string; tests: string; packages?: string[] }
  | {
      type: 'files';
      id: number;
      files: Record<string, string>;
      tests: string;
      packages?: string[];
    };

export type TestStatus = 'passed' | 'failed' | 'errored';

export interface TestResult {
  name: string;
  status: TestStatus;
  /** Assertion message or `ExceptionType: message`, with a traceback trimmed to learner frames. */
  message: string;
}

export interface PythonResponse {
  id: number;
  stdout: string;
  stderr: string;
  /** Set when the learner's code failed to load or run (syntax error, exception at import). */
  error?: string;
  tests?: TestResult[];
}

/** Messages a worker sends to its owner. */
export type WorkerEvent<R extends { id: number } = PythonResponse> =
  | { type: 'progress'; id: number; stage: string }
  | { type: 'started'; id: number }
  | { type: 'response'; response: R }
  | { type: 'failure'; id: number; message: string };

export type RunOutcome<R extends { id: number } = PythonResponse> =
  | { kind: 'done'; response: R }
  | { kind: 'timeout'; message: string }
  | { kind: 'failure'; message: string };

export function timeoutMessage(seconds: number): string {
  return `Your code ran for more than ${seconds} seconds. Look for a loop that never ends.`;
}
