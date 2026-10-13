import { useMemo, useState } from 'react';
import { runPython } from '../../lib/grader/grade';
import { getPythonRunner } from '../../lib/runtime/python-client';
import { scoreQuestion, type Verdict } from '../../lib/quiz/scoring';
import { seededRng, shuffle } from '../../lib/quiz/selection';
import {
  CONFIDENCE_LABELS,
  type Confidence,
  type Question,
  type Response,
} from '../../lib/quiz/types';
import { SortableList, type SortItem } from './SortableList';

export interface AnswerResult {
  correct: boolean;
  confidence: Confidence;
  response: Response;
}

interface Props {
  question: Question;
  /** Show the verdict and explanations after submitting (off inside a mastery check). */
  showFeedback: boolean;
  onSubmit(result: AnswerResult): void;
  /** Position label, for example "Question 2 of 8". */
  heading?: string;
}

function hashSeed(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

function ConfidencePicker({
  name,
  value,
  onChange,
  disabled,
}: {
  name: string;
  value: Confidence | null;
  onChange(v: Confidence): void;
  disabled: boolean;
}) {
  return (
    <fieldset disabled={disabled}>
      <legend>How sure are you?</legend>
      {([1, 2, 3, 4] as const).map((c) => (
        <label key={c} style={{ marginRight: '1rem' }}>
          <input
            type="radio"
            name={name}
            checked={value === c}
            onChange={() => onChange(c)}
            value={c}
          />{' '}
          {CONFIDENCE_LABELS[c]}
        </label>
      ))}
    </fieldset>
  );
}

export function QuestionView({ question: q, showFeedback, onSubmit, heading }: Props) {
  const uid = `q-${q.id}`;
  const [confidence, setConfidence] = useState<Confidence | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [verdict, setVerdict] = useState<Verdict | null>(null);
  const [note, setNote] = useState('');

  // Answer state per type
  const [single, setSingle] = useState<number | null>(null);
  const [multi, setMulti] = useState<number[]>([]);
  const [text, setText] = useState('');
  const [bugLine, setBugLine] = useState<number | null>(null);

  const initialOrder = useMemo<SortItem[]>(
    () =>
      q.type === 'order'
        ? shuffle(q.steps, seededRng(hashSeed(q.id))).map((s, i) => ({
            key: `o${i}-${s}`,
            text: s,
            indent: 0,
          }))
        : [],
    [q],
  );
  const [orderItems, setOrderItems] = useState<SortItem[]>(initialOrder);

  const parsonsAll = useMemo<SortItem[]>(() => {
    if (q.type !== 'parsons') return [];
    const lines = [...q.lines, ...q.distractors].map((l, i) => ({
      key: `p${i}`,
      text: l.trim(),
      indent: 0,
    }));
    return shuffle(lines, seededRng(hashSeed(q.id)));
  }, [q]);
  const [available, setAvailable] = useState<SortItem[]>(parsonsAll);
  const [solution, setSolution] = useState<SortItem[]>([]);

  const [runOutput, setRunOutput] = useState<string | null>(null);
  const [running, setRunning] = useState(false);

  const buildResponse = (): Response => {
    switch (q.type) {
      case 'single':
        return { type: 'single', selected: single };
      case 'multiple':
        return { type: 'multiple', selected: multi };
      case 'short':
        return { type: 'short', text };
      case 'predict':
        return { type: 'predict', text };
      case 'parsons':
        return {
          type: 'parsons',
          lines: solution.map((s) => ({ text: s.text, indent: s.indent })),
        };
      case 'bug':
        return { type: 'bug', line: bugLine };
      case 'order':
        return { type: 'order', steps: orderItems.map((s) => s.text) };
    }
  };

  const answered = (): boolean => {
    switch (q.type) {
      case 'single':
        return single !== null;
      case 'multiple':
        return multi.length > 0;
      case 'short':
      case 'predict':
        return text.trim() !== '';
      case 'parsons':
        return solution.length > 0;
      case 'bug':
        return bugLine !== null;
      case 'order':
        return orderItems.length > 0;
    }
  };

  const submit = () => {
    if (!answered()) {
      setNote('Choose or write an answer first.');
      return;
    }
    if (confidence === null) {
      setNote('Pick how sure you are before submitting.');
      return;
    }
    const response = buildResponse();
    const v = scoreQuestion(q, response);
    setVerdict(v);
    setSubmitted(true);
    setNote('');
    onSubmit({ correct: v.correct, confidence, response });
  };

  const runPredict = async () => {
    if (q.type !== 'predict') return;
    setRunning(true);
    try {
      const r = await runPython(getPythonRunner(), q.code, [], 5000);
      setRunOutput([r.stdout, r.error].filter(Boolean).join('\n') || '(no output)');
    } finally {
      setRunning(false);
    }
  };

  const lines = (code: string) => code.replace(/\n$/, '').split('\n');

  return (
    <fieldset className="athena-question" data-question={q.id} data-type={q.type}>
      <legend>{heading ?? 'Question'}</legend>

      {'stem' in q && <p>{q.stem}</p>}
      {q.type === 'predict' && <p>What does this code print? Write the exact output.</p>}
      {q.type === 'bug' && <p>Which line has the bug?</p>}
      {q.type === 'parsons' && (
        <p>
          Build the function: add the lines you need, put them in order and set the indentation.
        </p>
      )}
      {'code' in q && q.code && q.type !== 'bug' && (
        <pre aria-label="Code">
          <code>{q.code}</code>
        </pre>
      )}

      {(q.type === 'single' || q.type === 'multiple') && (
        <div role={q.type === 'single' ? 'radiogroup' : 'group'} aria-label="Answer options">
          {q.options.map((o, i) => (
            <div key={i}>
              <label>
                <input
                  type={q.type === 'single' ? 'radio' : 'checkbox'}
                  name={uid}
                  disabled={submitted}
                  checked={q.type === 'single' ? single === i : multi.includes(i)}
                  onChange={() =>
                    q.type === 'single'
                      ? setSingle(i)
                      : setMulti((m) => (m.includes(i) ? m.filter((x) => x !== i) : [...m, i]))
                  }
                />{' '}
                {o.text}
              </label>
              {submitted && showFeedback && (
                <p className="athena-why" data-correct={o.correct}>
                  <strong>{o.correct ? 'Correct.' : 'Not this one.'}</strong> {o.why}
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      {q.type === 'short' && (
        <label>
          Your answer{' '}
          <input
            type="text"
            value={text}
            disabled={submitted}
            onChange={(e) => setText(e.target.value)}
          />
        </label>
      )}

      {q.type === 'predict' && (
        <label>
          Expected output
          <br />
          <textarea
            rows={3}
            cols={40}
            value={text}
            disabled={submitted}
            onChange={(e) => setText(e.target.value)}
            spellCheck={false}
          />
        </label>
      )}

      {q.type === 'bug' && (
        <div role="radiogroup" aria-label="Lines of code">
          {lines(q.code).map((l, i) => (
            <label key={i} style={{ display: 'block' }}>
              <input
                type="radio"
                name={uid}
                disabled={submitted}
                checked={bugLine === i + 1}
                onChange={() => setBugLine(i + 1)}
              />{' '}
              <code>
                {i + 1}: {l}
              </code>
            </label>
          ))}
        </div>
      )}

      {q.type === 'order' && (
        <SortableList
          label="Steps. Space picks up, arrow keys move, Enter drops."
          items={orderItems}
          onChange={setOrderItems}
          allowIndent={false}
          disabled={submitted}
        />
      )}

      {q.type === 'parsons' && (
        <div>
          <p>
            <strong>Available lines</strong>
          </p>
          <ul aria-label="Available lines" className="athena-available">
            {available.map((a) => (
              <li key={a.key}>
                <button
                  type="button"
                  disabled={submitted}
                  className="athena-code-line"
                  onClick={() => {
                    setAvailable((x) => x.filter((y) => y.key !== a.key));
                    setSolution((x) => [...x, a]);
                  }}
                  aria-label={`Add line: ${a.text}`}
                >
                  {a.text}
                </button>
              </li>
            ))}
          </ul>
          <p>
            <strong>Your solution</strong>
          </p>
          <p>
            <small>
              In your solution: Space picks up a line, arrow keys move it, Tab and Shift+Tab change
              the indentation while it is picked up, Enter drops it, Delete removes it.
            </small>
          </p>
          <SortableList
            label="Your solution"
            items={solution}
            onChange={setSolution}
            allowIndent
            code
            disabled={submitted}
            onRemove={(key) => {
              const item = solution.find((s) => s.key === key);
              if (!item) return;
              setSolution((x) => x.filter((y) => y.key !== key));
              setAvailable((x) => [...x, { ...item, indent: 0 }]);
            }}
          />
        </div>
      )}

      <ConfidencePicker
        name={`${uid}-conf`}
        value={confidence}
        onChange={setConfidence}
        disabled={submitted}
      />

      {!submitted && (
        <p>
          <button type="button" onClick={submit}>
            Submit answer
          </button>
        </p>
      )}
      {note && (
        <p role="alert" className="athena-note">
          {note}
        </p>
      )}

      {submitted && showFeedback && verdict && (
        <div role="status" data-testid="verdict" data-correct={verdict.correct}>
          <p>
            <strong>{verdict.correct ? 'Correct.' : 'Not quite.'}</strong>
            {q.type === 'predict' && !verdict.correct && (
              <>
                {' '}
                Expected output: <code>{q.expected}</code>
              </>
            )}
          </p>
          {verdict.explanation && <p>{verdict.explanation}</p>}
          {q.type === 'predict' && (
            <div>
              <p>
                <button type="button" onClick={() => void runPredict()} disabled={running}>
                  {running ? 'Running…' : 'Run it'}
                </button>
              </p>
              {runOutput !== null && <pre data-testid="predict-output">{runOutput}</pre>}
              {q.investigate.length > 0 && (
                <ul>
                  {q.investigate.map((s, i) => (
                    <li key={i}>{s}</li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      )}
      {submitted && !showFeedback && <p role="status">Answer saved.</p>}
    </fieldset>
  );
}
