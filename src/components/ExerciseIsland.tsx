import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { del, get, set } from 'idb-keyval';
import {
  creditFor,
  gradePython,
  gradeWriteTests,
  runPython,
  shouldNudgeStuck,
  solutionUnlocked,
  type GradeReport,
  type PythonExerciseSpec,
} from '../lib/grader/grade';
import {
  gradeSql,
  runSql,
  type SqlExerciseSpec,
  type SqlGradeReport,
} from '../lib/grader/sql-grade';
import { getPythonRunner } from '../lib/runtime/python-client';
import { getSqlRunner } from '../lib/runtime/sql-client';
import { update } from '../lib/store/store';

interface HiddenData {
  hiddenTests: string;
  feedback: { test: string; message: string }[];
  hints: string[];
  referenceSolution: string;
  explanation: string;
  implementations: { correct: string; buggy: { label: string; code: string }[] } | null;
  sql: {
    checks: SqlExerciseSpec['checks'];
    compare: SqlExerciseSpec['compare'];
    planCheck: SqlExerciseSpec['planCheck'] | null;
    queueClaim: boolean;
  } | null;
}

export interface ExerciseIslandProps {
  id: string;
  lessonTitle: string;
  kind: PythonExerciseSpec['kind'];
  runtime: 'python' | 'sql';
  schema?: string | undefined;
  extensions?: string[] | undefined;
  promptText: string;
  starter: string;
  visibleTests: string;
  timeoutMs: number;
  packages: string[];
  dataUrl: string;
  children?: ReactNode;
}

type EditorHandle = { getCode(): string; setCode(code: string): void; focus(): void };

const TUTOR_PLACEHOLDER = 'Tutor prompt (placeholder): phase 7 adds the real template.';

export function ExerciseIsland(props: ExerciseIslandProps) {
  const { id, kind, starter, visibleTests, timeoutMs, packages, dataUrl, runtime } = props;
  const isSql = runtime === 'sql';
  const languageName = isSql ? 'SQL' : 'Python';
  const host = useRef<HTMLDivElement>(null);
  const editor = useRef<EditorHandle | null>(null);
  const [editing, setEditing] = useState(false);
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState('');
  const [report, setReport] = useState<GradeReport | null>(null);
  const [findings, setFindings] = useState<string[] | null>(null);
  const [sqlReport, setSqlReport] = useState<SqlGradeReport | null>(null);
  const [hints, setHints] = useState<string[]>([]);
  const [hintsShown, setHintsShown] = useState(0);
  const [tutorUsed, setTutorUsed] = useState(false);
  const [failedChecks, setFailedChecks] = useState(0);
  const [passed, setPassed] = useState(false);
  const [solution, setSolution] = useState<{ code: string; explanation: string } | null>(null);
  const [solutionViewed, setSolutionViewed] = useState(false);
  const [nudge, setNudge] = useState(false);
  const startedAt = useRef(Date.now());
  const hidden = useRef<HiddenData | null>(null);

  const loadHidden = useCallback(async (): Promise<HiddenData> => {
    if (hidden.current) return hidden.current;
    const res = await fetch(dataUrl);
    if (!res.ok) throw new Error('Could not load the exercise checks.');
    hidden.current = (await res.json()) as HiddenData;
    return hidden.current;
  }, [dataUrl]);

  const mountEditor = useCallback(async () => {
    if (editor.current || !host.current) return;
    setEditing(true);
    const [{ EditorView, basicSetup }, languageExtension, { keymap }, { indentWithTab }] =
      await Promise.all([
        import('codemirror'),
        isSql
          ? import('@codemirror/lang-sql').then((m) => m.sql())
          : import('@codemirror/lang-python').then((m) => m.python()),
        import('@codemirror/view'),
        import('@codemirror/commands'),
      ]);
    const saved = await get<string>(`draft:${id}`).catch(() => undefined);
    let timer: ReturnType<typeof setTimeout> | undefined;
    const view = new EditorView({
      doc: saved ?? starter,
      parent: host.current,
      extensions: [
        basicSetup,
        languageExtension,
        keymap.of([indentWithTab]),
        EditorView.contentAttributes.of({ 'aria-label': `${languageName} code editor` }),
        EditorView.updateListener.of((u) => {
          if (!u.docChanged) return;
          clearTimeout(timer);
          timer = setTimeout(
            () => void set(`draft:${id}`, u.state.doc.toString()).catch(() => undefined),
            400,
          );
        }),
      ],
    });
    editor.current = {
      getCode: () => view.state.doc.toString(),
      setCode: (code) =>
        view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: code } }),
      focus: () => view.focus(),
    };
    view.focus();
  }, [id, starter, isSql, languageName]);

  useEffect(() => {
    const t = setInterval(() => {
      setNudge(shouldNudgeStuck({ passed, startedAt: startedAt.current, now: Date.now() }));
    }, 30000);
    return () => clearInterval(t);
  }, [passed]);

  const spec = useCallback(
    (hiddenTests: string | undefined, feedback: HiddenData['feedback']): PythonExerciseSpec => ({
      kind,
      timeoutMs,
      packages,
      visibleTests,
      hiddenTests,
      feedback,
      implementations: hidden.current?.implementations ?? undefined,
    }),
    [kind, timeoutMs, packages, visibleTests],
  );

  const currentCode = async (): Promise<string> => {
    await mountEditor();
    return editor.current?.getCode() ?? starter;
  };

  const withBusy = async (label: string, fn: () => Promise<void>) => {
    setBusy(label);
    setStatus(`${label}…`);
    try {
      await fn();
    } catch (e) {
      setStatus(e instanceof Error ? e.message : 'Something went wrong.');
    } finally {
      setBusy('');
    }
  };

  const onProgress = (stage: string) => setStatus(stage + '…');

  const sqlSpec = (): SqlExerciseSpec => ({
    schema: props.schema ?? '',
    extensions: props.extensions ?? [],
    referenceSolution: hidden.current?.referenceSolution ?? '',
    compare: hidden.current?.sql?.compare ?? 'none',
    checks: hidden.current?.sql?.checks ?? [],
    planCheck: hidden.current?.sql?.planCheck ?? undefined,
    queueClaim: hidden.current?.sql?.queueClaim ?? false,
    timeoutMs,
  });

  const onRun = () =>
    withBusy('Running', async () => {
      const code = await currentCode();
      if (isSql) {
        const r = await runSql(getSqlRunner(onProgress), sqlSpec(), code);
        setSqlReport(r);
        setReport(null);
        setStatus(r.error ? 'Your query raised an error.' : 'Finished running.');
        return;
      }
      const r = await runPython(getPythonRunner(onProgress), code, packages, timeoutMs);
      setReport(r);
      setFindings(null);
      setStatus(r.error ? 'Your code raised an error.' : 'Finished running.');
    });

  const onRunTests = () =>
    withBusy('Running tests', async () => {
      const code = await currentCode();
      const r = await gradePython(getPythonRunner(onProgress), spec(undefined, []), code, false);
      setReport(r);
      setFindings(null);
      setStatus(
        r.passed
          ? 'Visible tests pass. Press Check for the full set.'
          : 'Some tests do not pass yet.',
      );
    });

  const record = (ok: boolean, shownHints: number, viewed: boolean) => {
    const hintsUsed = Math.min(3, shownHints) as 0 | 1 | 2 | 3;
    const credit = creditFor({ passed: ok, hintsUsed, tutorUsed, solutionViewed: viewed });
    try {
      update(window.localStorage, new Date(), (d) => {
        const prev = d.exercises[id];
        const at = new Date().toISOString();
        return {
          ...d,
          exercises: {
            ...d.exercises,
            [id]: {
              updatedAt: at,
              attempts: [
                ...(prev?.attempts ?? []),
                {
                  at,
                  passed: ok,
                  hintsUsed,
                  tutorUsed,
                  solutionViewed: viewed,
                  durationMs: Date.now() - startedAt.current,
                },
              ],
              bestCredit: Math.max(prev?.bestCredit ?? 0, credit),
            },
          },
        };
      });
    } catch {
      setStatus((s) => s + ' (Progress could not be saved: open Settings to check your data.)');
    }
  };

  const onCheck = () =>
    withBusy('Checking', async () => {
      const code = await currentCode();
      const h = await loadHidden();
      setHints(h.hints);
      let ok: boolean;
      if (isSql) {
        const r = await gradeSql(getSqlRunner(onProgress), sqlSpec(), code);
        setSqlReport(r);
        setReport(null);
        setFindings(null);
        ok = r.passed;
      } else if (kind === 'write-tests') {
        const r = await gradeWriteTests(getPythonRunner(onProgress), spec(undefined, []), code);
        setFindings(r.findings);
        setReport(null);
        ok = r.passed;
      } else {
        const r = await gradePython(
          getPythonRunner(onProgress),
          spec(h.hiddenTests, h.feedback),
          code,
          true,
        );
        setReport(r);
        setFindings(null);
        ok = r.passed;
      }
      setPassed(ok);
      if (!ok) setFailedChecks((n) => n + 1);
      record(ok, hintsShown, solutionViewed);
      setStatus(ok ? 'All checks pass.' : 'Not yet. Read the feedback below.');
    });

  const onReset = () => {
    if (!window.confirm('Reset to the starter code? Your changes will be lost.')) return;
    editor.current?.setCode(starter);
    void del(`draft:${id}`).catch(() => undefined);
    setReport(null);
    setSqlReport(null);
    setFindings(null);
    setStatus('Starter code restored.');
  };

  const onHint = () =>
    withBusy('Loading hint', async () => {
      const h = await loadHidden();
      setHints(h.hints);
      setHintsShown((n) => Math.min(h.hints.length, n + 1));
      setStatus('');
    });

  const onStuck = async () => {
    const code = editor.current?.getCode() ?? starter;
    const text = `${TUTOR_PLACEHOLDER}\n\nExercise: ${props.promptText}\n\nMy code:\n${code}`;
    try {
      await navigator.clipboard.writeText(text);
      setStatus('Prompt copied: paste it into Claude.');
    } catch {
      setStatus('Could not copy the prompt.');
    }
    setTutorUsed(true);
  };

  const onSolution = () =>
    withBusy('Loading solution', async () => {
      const h = await loadHidden();
      setSolution({ code: h.referenceSolution, explanation: h.explanation });
      setSolutionViewed(true);
      setStatus('');
    });

  const canSolution = solutionUnlocked({ passed, failedChecks, hintsUsed: hintsShown });

  return (
    <section aria-label={`Exercise: ${props.lessonTitle}`} data-pagefind-ignore data-exercise={id}>
      <div>{props.promptText}</div>
      <p>
        <small>
          Write this yourself. Claude can be your tutor (use the I&apos;m stuck button) but not your
          author.
        </small>
      </p>

      <div ref={host} data-testid="editor-host" onFocus={() => void mountEditor()} />
      {!editing && (
        <div data-testid="static-starter">
          {props.children}
          <button type="button" onClick={() => void mountEditor()}>
            Edit code
          </button>
        </div>
      )}
      {editing && (
        <p>
          <small>Press Esc, then Tab, to leave the editor.</small>
        </p>
      )}

      <p>
        <button
          type="button"
          onClick={() => void onRun()}
          disabled={busy !== '' || kind === 'write-tests'}
        >
          Run
        </button>{' '}
        <button
          type="button"
          onClick={() => void onRunTests()}
          disabled={busy !== '' || kind === 'write-tests'}
          hidden={isSql}
        >
          Run tests
        </button>{' '}
        <button type="button" onClick={() => void onCheck()} disabled={busy !== ''}>
          Check
        </button>{' '}
        <button type="button" onClick={onReset} disabled={busy !== ''}>
          Reset
        </button>{' '}
        <button type="button" onClick={() => void onStuck()} disabled={busy !== ''}>
          I&apos;m stuck
        </button>{' '}
        <button
          type="button"
          onClick={() => void onHint()}
          disabled={busy !== '' || hintsShown >= 3}
        >
          Show hint
        </button>{' '}
        {canSolution && (
          <button type="button" onClick={() => void onSolution()} disabled={busy !== ''}>
            Show solution
          </button>
        )}
      </p>

      <p role="status" aria-live="polite" data-testid="exercise-status">
        {status}
      </p>
      {nudge && !passed && (
        <p role="note">
          You have been working on this for a while. Try the first hint or the I&apos;m stuck
          button.
        </p>
      )}

      {hints.slice(0, hintsShown).map((h, i) => (
        <p key={i} data-testid="hint">
          <strong>Hint {i + 1}:</strong> <code style={{ whiteSpace: 'pre-wrap' }}>{h}</code>
        </p>
      ))}

      {report && (
        <div data-testid="report">
          {report.error && <pre data-testid="error">{report.error}</pre>}
          {report.stdout && <pre data-testid="stdout">{report.stdout}</pre>}
          <ul>
            {report.tests.map((t) => (
              <li key={t.name} data-status={t.status}>
                <strong>
                  {t.status === 'passed' ? 'Passed' : t.status === 'failed' ? 'Failed' : 'Error'}:
                </strong>{' '}
                {t.name}
                {t.hidden ? ' (hidden test)' : ''}
                {t.feedback && <div>{t.feedback}</div>}
                {t.message && <pre>{t.message}</pre>}
              </li>
            ))}
          </ul>
        </div>
      )}
      {sqlReport && (
        <div data-testid="sql-report">
          {sqlReport.error && <pre data-testid="error">{sqlReport.error}</pre>}
          {sqlReport.result && (
            <table data-testid="sql-result">
              <thead>
                <tr>
                  {sqlReport.result.fields.map((f, i) => (
                    <th key={i} scope="col">
                      {f}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sqlReport.result.rows.map((row, r) => (
                  <tr key={r}>
                    {row.map((cell, c) => (
                      <td key={c}>{cell === null ? 'NULL' : String(cell)}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {sqlReport.mismatch && <p data-testid="mismatch">{sqlReport.mismatch}</p>}
          {sqlReport.failures.length > 0 && (
            <ul data-testid="failures">
              {sqlReport.failures.map((f, i) => (
                <li key={i}>{f}</li>
              ))}
            </ul>
          )}
        </div>
      )}
      {findings && (
        <div data-testid="findings">
          {findings.length === 0 ? (
            <p>Your tests accept the correct code and catch every bug.</p>
          ) : (
            <ul>
              {findings.map((f, i) => (
                <li key={i}>{f}</li>
              ))}
            </ul>
          )}
        </div>
      )}
      {solution && (
        <div data-testid="solution">
          <pre>{solution.code}</pre>
          <div>{solution.explanation}</div>
        </div>
      )}
    </section>
  );
}
