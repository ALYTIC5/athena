import { useEffect, useRef, useState } from 'react';
import { gradeFiles, type GradeReport } from '../../lib/grader/grade';
import { formatClock, remainingMs } from '../../lib/gym/timer';
import { getPythonRunner } from '../../lib/runtime/python-client';
import { update } from '../../lib/store/store';
import { CodeEditor, type CodeEditorHandle } from '../CodeEditor';

export interface DrillProps {
  id: string;
  kind: 'code-reading' | 'ai-assisted';
  title: string;
  task?: string | undefined;
  files: Record<string, string>;
  failingTest: string;
  timeLimitMin: number;
  dataUrl: string;
}

interface Revealed {
  bugExplanation: string;
  fixedFiles: Record<string, string>;
}

/**
 * Code-reading drills: a multi-file program with a planted bug and a failing test, 30 minutes.
 * AI-assisted drills allow an AI assistant but require a written hypothesis before each prompt,
 * verification with the tests, and a short reflection afterwards.
 */
export function DrillIsland(props: DrillProps) {
  const ai = props.kind === 'ai-assisted';
  const limitMs = props.timeLimitMin * 60_000;
  const names = Object.keys(props.files);
  const editors = useRef(new Map<string, CodeEditorHandle>());
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [now, setNow] = useState(Date.now());
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const [report, setReport] = useState<GradeReport | null>(null);
  const [done, setDone] = useState<null | { passed: boolean; durationMs: number }>(null);
  const [revealed, setRevealed] = useState<Revealed | null>(null);
  const [solutionViewed, setSolutionViewed] = useState(false);
  const [hypothesis, setHypothesis] = useState('');
  const [hypotheses, setHypotheses] = useState<string[]>([]);
  const [reflection, setReflection] = useState('');

  useEffect(() => {
    if (startedAt === null || done) return;
    const t = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(t);
  }, [startedAt, done]);

  const left = startedAt === null ? limitMs : remainingMs(startedAt, limitMs, now);

  const currentFiles = (): Record<string, string> =>
    Object.fromEntries(
      names.map((n) => [n, editors.current.get(n)?.getCode() ?? props.files[n] ?? '']),
    );

  const loadRevealed = async () => {
    const res = await fetch(props.dataUrl);
    if (!res.ok) throw new Error('Could not load the explanation.');
    const data = (await res.json()) as Revealed;
    setRevealed(data);
    return data;
  };

  const save = (passed: boolean, viewed: boolean, durationMs: number) => {
    try {
      update(window.localStorage, new Date(), (d) => {
        const at = new Date().toISOString();
        const prev = d.drills[props.id];
        const note = ai
          ? [`Hypotheses: ${hypotheses.join(' | ')}`, `Reflection: ${reflection}`].join('\n')
          : undefined;
        return {
          ...d,
          drills: {
            ...d.drills,
            [props.id]: {
              updatedAt: at,
              attempts: [
                ...(prev?.attempts ?? []),
                {
                  at,
                  passed,
                  durationMs,
                  hintsUsed: 0,
                  solutionViewed: viewed,
                  ...(note ? { reflection: note } : {}),
                },
              ],
            },
          },
        };
      });
    } catch {
      setStatus('Your attempt could not be saved. Open Settings to check your data.');
    }
  };

  const runTests = async () => {
    setBusy(true);
    setStatus('Running tests…');
    try {
      const r = await gradeFiles(
        getPythonRunner((s) => setStatus(`${s}…`)),
        {
          files: currentFiles(),
          tests: props.failingTest,
          timeoutMs: 5000,
        },
      );
      setReport(r);
      setStatus(r.passed ? 'All tests pass.' : 'Some tests still fail.');
    } catch (e) {
      setStatus(e instanceof Error ? e.message : 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  };

  const finish = async (passed: boolean, viewed: boolean) => {
    if (ai && hypotheses.length === 0) {
      setStatus(
        'Record at least one hypothesis before you finish: what did you think was wrong, and why?',
      );
      return;
    }
    if (ai && reflection.trim() === '') {
      setStatus(
        'Write a short reflection first: what did you ask, what did you check, what did you learn?',
      );
      return;
    }
    const durationMs = Date.now() - (startedAt ?? Date.now());
    save(passed, viewed, durationMs);
    setDone({ passed, durationMs });
    await loadRevealed();
  };

  const addHypothesis = () => {
    const text = hypothesis.trim();
    if (!text) {
      setStatus('Write your hypothesis first: what do you think is wrong, and why?');
      return;
    }
    setHypotheses((h) => [...h, text]);
    setHypothesis('');
    setStatus('Hypothesis recorded. Now you may ask your AI assistant.');
  };

  const inProgress = !done;

  return (
    <section
      aria-label={`Drill: ${props.title}`}
      data-pagefind-ignore
      data-drill={props.id}
      data-kind={props.kind}
    >
      <p>
        <span role="timer" aria-live="off" data-testid="clock">
          Time left: {formatClock(left)}
        </span>{' '}
        {startedAt === null && inProgress && (
          <button type="button" onClick={() => setStartedAt(Date.now())} data-testid="start-timer">
            Start
          </button>
        )}
      </p>
      {left === 0 && inProgress && startedAt !== null && (
        <p role="status" data-testid="time-up">
          Time is up. You can keep going, but this will not count as within the time limit.
        </p>
      )}

      {ai ? (
        <p>
          <strong>AI-assisted drill.</strong> {props.task}
        </p>
      ) : (
        <p>
          <strong>Code-reading drill.</strong> Read the files, find the bug that makes the test fail
          and fix it. No AI for this one.
        </p>
      )}

      {names.map((name) => (
        <div key={name}>
          <h2>{name}</h2>
          <CodeEditor
            ref={(h) => {
              if (h) editors.current.set(name, h);
              else editors.current.delete(name);
            }}
            initial={props.files[name] ?? ''}
            label={`${name} editor`}
            language="python"
            draftKey={`drill-${props.id}-${name}`}
          />
        </div>
      ))}

      <h2>The failing test</h2>
      <pre>
        <code>{props.failingTest}</code>
      </pre>

      {ai && inProgress && (
        <fieldset>
          <legend>Before each prompt, write your hypothesis</legend>
          <label>
            What do you think is wrong, and why?
            <br />
            <textarea
              rows={3}
              cols={60}
              value={hypothesis}
              onChange={(e) => setHypothesis(e.target.value)}
            />
          </label>
          <p>
            <button type="button" onClick={addHypothesis} data-testid="add-hypothesis">
              Record hypothesis
            </button>
          </p>
          <p data-testid="hypothesis-count">Prompts planned so far: {hypotheses.length}.</p>
          <ul>
            {hypotheses.map((h, i) => (
              <li key={i}>{h}</li>
            ))}
          </ul>
          <label>
            Reflection: what did you ask, what did you check, what did you learn?
            <br />
            <textarea
              rows={3}
              cols={60}
              value={reflection}
              onChange={(e) => setReflection(e.target.value)}
            />
          </label>
        </fieldset>
      )}

      <p>
        <button type="button" onClick={() => void runTests()} disabled={busy || !inProgress}>
          Run tests
        </button>{' '}
        <button
          type="button"
          onClick={() => void finish(report?.passed === true, false)}
          disabled={busy || !inProgress || report?.passed !== true}
          data-testid="finish-pass"
        >
          Finish: tests pass
        </button>{' '}
        <button
          type="button"
          onClick={() => {
            setSolutionViewed(true);
            void finish(false, true);
          }}
          disabled={busy || !inProgress}
          data-testid="give-up"
        >
          Give up and show the bug
        </button>
      </p>
      <p role="status" aria-live="polite" data-testid="drill-status">
        {status}
      </p>

      {report && (
        <div data-testid="drill-report">
          {report.error && <pre data-testid="error">{report.error}</pre>}
          <ul>
            {report.tests.map((t) => (
              <li key={t.name} data-status={t.status}>
                <strong>
                  {t.status === 'passed' ? 'Passed' : t.status === 'failed' ? 'Failed' : 'Error'}:
                </strong>{' '}
                {t.name}
                {t.message && <pre>{t.message}</pre>}
              </li>
            ))}
          </ul>
        </div>
      )}

      {done && revealed && (
        <section aria-label="Result" data-testid="drill-result" data-passed={done.passed}>
          <h3>{done.passed ? 'Fixed' : 'Not fixed'}</h3>
          <p>
            Time: {formatClock(done.durationMs)}.{' '}
            {done.durationMs <= limitMs ? 'Within the time limit.' : 'Over the time limit.'}
            {solutionViewed ? ' You looked at the explanation, so this is not unaided.' : ''}
          </p>
          <h3>The bug</h3>
          <p>{revealed.bugExplanation}</p>
        </section>
      )}
    </section>
  );
}
