import { useEffect, useRef, useState } from 'react';
import { gradePython, type GradeReport, type PythonExerciseSpec } from '../../lib/grader/grade';
import { recordGymAttempt, rateCommunication, type GymMode } from '../../lib/gym/attempts';
import {
  THINK_ALOUD_STEPS,
  formatClock,
  remainingMs,
  type ThinkAloudId,
} from '../../lib/gym/timer';
import { getPythonRunner } from '../../lib/runtime/python-client';
import { CodeEditor, type CodeEditorHandle } from '../CodeEditor';

export interface GymProblemProps {
  id: string;
  title: string;
  statement: string;
  examples: string[];
  constraints: string[];
  starter: string;
  visibleTests: string;
  difficulty: 'easy' | 'medium';
  timeLimitMin: number;
  dataUrl: string;
}

interface Revealed {
  pattern: string;
  hiddenTests: string;
  referenceSolutions: { code: string; time: string; space: string }[];
  patternExplanation: string;
  commonMistakes: string[];
  followUps: string[];
}

const MODES: GymMode[] = ['approach', 'timed', 'mixed', 'reattempt'];

const MODE_TEXT: Record<GymMode, string> = {
  approach: 'Approach practice: untimed. Tick the think-aloud steps as you say them out loud.',
  timed: 'Timed solo practice. The clock starts when you press Start.',
  mixed: 'Mixed set: the pattern stays hidden until you finish.',
  reattempt: 'Re-attempt of a problem you did not finish. The clock starts when you press Start.',
};

function modeFromUrl(): GymMode {
  const m = new URLSearchParams(window.location.search).get('mode');
  return MODES.includes(m as GymMode) ? (m as GymMode) : 'timed';
}

export function GymProblemIsland(props: GymProblemProps) {
  // The page is rendered on the server first, so read the URL after hydration.
  const [mode, setMode] = useState<GymMode>('timed');
  useEffect(() => setMode(modeFromUrl()), []);
  const timed = mode !== 'approach';
  const limitMs = props.timeLimitMin * 60_000;
  const editor = useRef<CodeEditorHandle>(null);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [now, setNow] = useState(Date.now());
  const [ticks, setTicks] = useState<Set<ThinkAloudId>>(new Set());
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const [report, setReport] = useState<GradeReport | null>(null);
  const [finished, setFinished] = useState<null | { passed: boolean; durationMs: number }>(null);
  const [revealed, setRevealed] = useState<Revealed | null>(null);
  const [rated, setRated] = useState<number | null>(null);
  const hidden = useRef<Revealed | null>(null);

  useEffect(() => {
    if (startedAt === null || finished) return;
    const t = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(t);
  }, [startedAt, finished]);

  const left = startedAt === null ? limitMs : remainingMs(startedAt, limitMs, now);
  const over = timed && startedAt !== null && left === 0;

  const loadHidden = async (): Promise<Revealed> => {
    if (hidden.current) return hidden.current;
    const res = await fetch(props.dataUrl);
    if (!res.ok) throw new Error('Could not load the checks.');
    hidden.current = (await res.json()) as Revealed;
    return hidden.current;
  };

  const spec = (h?: Revealed): PythonExerciseSpec => ({
    kind: 'make',
    timeoutMs: 5000,
    packages: [],
    visibleTests: props.visibleTests,
    hiddenTests: h?.hiddenTests,
    feedback: [],
  });

  const start = () => {
    setStartedAt(Date.now());
    setNow(Date.now());
    editor.current?.focus();
  };

  const finish = async (passed: boolean) => {
    const began = startedAt ?? Date.now();
    const durationMs = Date.now() - began;
    try {
      recordGymAttempt(window.localStorage, new Date(), {
        problemId: props.id,
        mode,
        passed,
        durationMs,
        hintsUsed: 0,
        checklist: [...ticks],
      });
    } catch {
      setStatus('Your attempt could not be saved. Open Settings to check your data.');
    }
    setFinished({ passed, durationMs });
    setRevealed(await loadHidden());
  };

  const run = async (check: boolean) => {
    setBusy(true);
    setStatus(check ? 'Checking…' : 'Running tests…');
    try {
      const h = check ? await loadHidden() : undefined;
      const code = editor.current?.getCode() ?? props.starter;
      const r = await gradePython(
        getPythonRunner((s) => setStatus(`${s}…`)),
        spec(h),
        code,
        check,
      );
      setReport(r);
      if (check && r.passed) {
        setStatus('All checks pass.');
        await finish(true);
      } else {
        setStatus(
          check
            ? 'Not yet. Read the feedback below.'
            : r.passed
              ? 'Visible tests pass.'
              : 'Some tests fail.',
        );
      }
    } catch (e) {
      setStatus(e instanceof Error ? e.message : 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  };

  const toggle = (id: ThinkAloudId) =>
    setTicks((t) => {
      const next = new Set(t);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const inProgress = !finished;
  const canStart = timed && startedAt === null && inProgress;
  const withinLimit = finished ? finished.durationMs <= limitMs : false;

  return (
    <section
      aria-label={`Problem: ${props.title}`}
      data-pagefind-ignore
      data-gym-problem={props.id}
    >
      <p>
        <small data-testid="mode-text">{MODE_TEXT[mode]}</small>
      </p>

      {timed && (
        <p>
          <span role="timer" aria-live="off" data-testid="clock">
            Time left: {formatClock(left)}
          </span>{' '}
          {canStart && (
            <button type="button" onClick={start} data-testid="start-timer">
              Start
            </button>
          )}
        </p>
      )}
      {over && inProgress && (
        <p role="status" data-testid="time-up">
          Time is up. You can keep going, but this attempt will not count as within the time limit.
        </p>
      )}

      <h2>{props.title}</h2>
      <div style={{ whiteSpace: 'pre-wrap' }}>{props.statement}</div>
      <h3>Examples</h3>
      <ul>
        {props.examples.map((e, i) => (
          <li key={i}>
            <code>{e}</code>
          </li>
        ))}
      </ul>
      {props.constraints.length > 0 && (
        <>
          <h3>Constraints</h3>
          <ul>
            {props.constraints.map((c, i) => (
              <li key={i}>{c}</li>
            ))}
          </ul>
        </>
      )}

      <fieldset>
        <legend>Think-aloud checklist</legend>
        {THINK_ALOUD_STEPS.map((s) => (
          <label key={s.id} style={{ display: 'block' }}>
            <input
              type="checkbox"
              checked={ticks.has(s.id)}
              onChange={() => toggle(s.id)}
              disabled={!inProgress}
            />{' '}
            {s.label}
          </label>
        ))}
      </fieldset>

      <h3>Your code</h3>
      <CodeEditor
        ref={editor}
        initial={props.starter}
        label="Python code editor"
        language="python"
        draftKey={`gym-${props.id}`}
      />

      <p>
        <button type="button" onClick={() => void run(false)} disabled={busy || !inProgress}>
          Run tests
        </button>{' '}
        <button type="button" onClick={() => void run(true)} disabled={busy || !inProgress}>
          Check
        </button>{' '}
        <button
          type="button"
          onClick={() => void finish(false)}
          disabled={busy || !inProgress}
          data-testid="finish-attempt"
        >
          Finish attempt without passing
        </button>
      </p>
      <p role="status" aria-live="polite" data-testid="gym-status">
        {status}
      </p>

      {report && (
        <div data-testid="gym-report">
          {report.error && <pre data-testid="error">{report.error}</pre>}
          <ul>
            {report.tests.map((t) => (
              <li key={t.name} data-status={t.status}>
                <strong>
                  {t.status === 'passed' ? 'Passed' : t.status === 'failed' ? 'Failed' : 'Error'}:
                </strong>{' '}
                {t.name}
                {t.hidden ? ' (hidden test)' : ''}
                {t.message && <pre>{t.message}</pre>}
              </li>
            ))}
          </ul>
        </div>
      )}

      {finished && revealed && (
        <section aria-label="Result" data-testid="gym-result" data-passed={finished.passed}>
          <h3>{finished.passed ? 'Passed' : 'Not passed'}</h3>
          <p>
            Time: {formatClock(finished.durationMs)}.{' '}
            {timed
              ? withinLimit
                ? 'Within the time limit.'
                : 'Over the time limit.'
              : 'Untimed practice.'}{' '}
            {!finished.passed && 'This problem will come back in your re-attempt queue.'}
          </p>
          <p>
            Pattern: <strong data-testid="pattern">{revealed.pattern}</strong>
          </p>
          <p>{revealed.patternExplanation}</p>
          <h4>Reference solution</h4>
          {revealed.referenceSolutions.map((s, i) => (
            <div key={i}>
              <pre>
                <code>{s.code}</code>
              </pre>
              <p>
                Time {s.time}, space {s.space}.
              </p>
            </div>
          ))}
          <h4>Common mistakes</h4>
          <ul>
            {revealed.commonMistakes.map((m, i) => (
              <li key={i}>{m}</li>
            ))}
          </ul>
          <h4>Follow-up questions</h4>
          <ul>
            {revealed.followUps.map((m, i) => (
              <li key={i}>{m}</li>
            ))}
          </ul>
          <fieldset>
            <legend>How well did you communicate out loud? (1 to 5)</legend>
            {[1, 2, 3, 4, 5].map((n) => (
              <label key={n} style={{ marginInlineEnd: '1rem' }}>
                <input
                  type="radio"
                  name="communication"
                  checked={rated === n}
                  onChange={() => {
                    setRated(n);
                    try {
                      rateCommunication(
                        window.localStorage,
                        new Date(),
                        props.id,
                        n as 1 | 2 | 3 | 4 | 5,
                      );
                    } catch {
                      // corrupt data: Settings shows the recovery screen
                    }
                  }}
                />{' '}
                {n}
              </label>
            ))}
          </fieldset>
        </section>
      )}
    </section>
  );
}
