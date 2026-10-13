import {
  DEFAULT_TIMEOUT_MS,
  timeoutMessage,
  type PythonRequest,
  type PythonResponse,
  type RunOutcome,
  type WorkerEvent,
} from './protocol';

/** A worker as the runner sees it: a Web Worker in the browser, a worker thread under Node. */
export interface WorkerHandle<
  Req extends { id: number } = PythonRequest,
  Res extends { id: number } = PythonResponse,
> {
  post(request: Req): void;
  terminate(): void | Promise<unknown>;
  onEvent(listener: (event: WorkerEvent<Res>) => void): void;
  onCrash(listener: (message: string) => void): void;
}

type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;
export type RequestBody<Req extends { id: number } = PythonRequest> = DistributiveOmit<Req, 'id'>;

export interface Runner<
  Req extends { id: number } = PythonRequest,
  Res extends { id: number } = PythonResponse,
> {
  run(body: RequestBody<Req>, timeoutMs?: number): Promise<RunOutcome<Res>>;
  dispose(): void | Promise<unknown>;
}

/**
 * Serialises requests to one worker. The timeout clock starts when the worker reports that
 * execution has started (after Pyodide and packages have loaded). On timeout the worker is
 * terminated and a fresh one is created for the next request.
 */
export function createRunner<
  Req extends { id: number } = PythonRequest,
  Res extends { id: number } = PythonResponse,
>(spawn: () => WorkerHandle<Req, Res>, onProgress?: (stage: string) => void): Runner<Req, Res> {
  let worker: WorkerHandle<Req, Res> | undefined;
  let handler: ((event: WorkerEvent<Res> | { type: 'crash'; message: string }) => void) | undefined;
  let nextId = 1;
  let queue: Promise<unknown> = Promise.resolve();

  /** Create a worker and wire its listeners once; each request swaps in its own handler. */
  function current(): WorkerHandle<Req, Res> {
    if (worker) return worker;
    const w = spawn();
    w.onEvent((e) => {
      if (worker === w) handler?.(e);
    });
    w.onCrash((message) => {
      if (worker === w) handler?.({ type: 'crash', message });
    });
    worker = w;
    return w;
  }

  function runOne(body: RequestBody<Req>, timeoutMs: number): Promise<RunOutcome<Res>> {
    const w = current();
    const id = nextId++;
    return new Promise<RunOutcome<Res>>((resolve) => {
      let timer: ReturnType<typeof setTimeout> | undefined;
      let settled = false;
      const settle = (outcome: RunOutcome<Res>, discard: boolean) => {
        if (settled) return;
        settled = true;
        if (timer !== undefined) clearTimeout(timer);
        handler = undefined;
        if (discard) {
          void w.terminate();
          if (worker === w) worker = undefined;
        }
        resolve(outcome);
      };
      handler = (e) => {
        if (e.type === 'crash') settle({ kind: 'failure', message: e.message }, true);
        else if (e.type === 'progress' && e.id === id) onProgress?.(e.stage);
        else if (e.type === 'started' && e.id === id) {
          timer = setTimeout(
            () => settle({ kind: 'timeout', message: timeoutMessage(timeoutMs / 1000) }, true),
            timeoutMs,
          );
        } else if (e.type === 'response' && e.response.id === id) {
          settle({ kind: 'done', response: e.response }, false);
        } else if (e.type === 'failure' && e.id === id) {
          settle({ kind: 'failure', message: e.message }, true);
        }
      };
      w.post({ ...body, id } as unknown as Req);
    });
  }

  return {
    run(body, timeoutMs = DEFAULT_TIMEOUT_MS) {
      const result = queue.then(() => runOne(body, timeoutMs));
      queue = result.catch(() => undefined);
      return result;
    },
    dispose() {
      const w = worker;
      worker = undefined;
      return w?.terminate();
    },
  };
}
