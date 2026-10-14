import { useEffect, useState } from 'react';
import {
  FULL_LOOP,
  MOCK_LABELS,
  SCORE_LABELS,
  mockPrompt,
  type MockKind,
} from '../../lib/prompts/templates';
import { load } from '../../lib/store/store';
import { PromptCopy } from '../prompts/PromptCopy';
import { SessionLog } from '../prompts/SessionLog';

const KINDS = Object.keys(MOCK_LABELS) as MockKind[];

interface Inputs {
  competencyList: string;
  projectSummary: string;
  problemStatement: string;
  task: string;
  designProblem: string;
}

const FIELD_LABEL: Record<MockKind, { key: keyof Inputs; label: string } | null> = {
  concept: { key: 'competencyList', label: 'Competencies to be asked about (comma separated)' },
  project: { key: 'projectSummary', label: 'Your summary of the project' },
  behavioural: null,
  'live-coding': { key: 'problemStatement', label: 'The problem statement' },
  'ai-assisted': { key: 'task', label: 'The task' },
  'system-design': { key: 'designProblem', label: 'The design problem' },
};

function Round({ kind, track, inputs }: { kind: MockKind; track: string; inputs: Inputs }) {
  const [delivered, setDelivered] = useState(false);
  const sessionKind = kind === 'concept' ? 'concept' : kind;
  const competencies = inputs.competencyList
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  return (
    <div data-round={kind}>
      <PromptCopy
        label={`Copy the ${MOCK_LABELS[kind].toLowerCase()} prompt and open Claude`}
        prompt={mockPrompt(kind, { track, ...inputs })}
        onDelivered={() => setDelivered(true)}
      />
      {delivered && (
        <SessionLog
          kind={sessionKind}
          scoreLabels={SCORE_LABELS[kind]}
          competencies={competencies}
        />
      )}
    </div>
  );
}

export function MockHub() {
  const [track, setTrack] = useState('AI automation');
  const [kind, setKind] = useState<MockKind | 'full-loop'>('concept');
  const [inputs, setInputs] = useState<Inputs>({
    competencyList: '',
    projectSummary: '',
    problemStatement: '',
    task: '',
    designProblem: '',
  });

  useEffect(() => {
    const s = load(window.localStorage);
    if (s.status === 'ok') setTrack(s.data.settings.jobTrack);
  }, []);

  const field = kind === 'full-loop' ? null : FIELD_LABEL[kind];
  const set = (key: keyof Inputs, value: string) => setInputs((i) => ({ ...i, [key]: value }));

  return (
    <div>
      <p>
        Pick a round. The site builds a prompt, opens Claude in a new tab and copies the prompt for
        you to paste. Afterwards, log your scores and gaps here; any gap can become a review card.
      </p>
      <p>
        <label>
          Round{' '}
          <select value={kind} onChange={(e) => setKind(e.target.value as MockKind | 'full-loop')}>
            {KINDS.map((k) => (
              <option key={k} value={k}>
                {MOCK_LABELS[k]}
              </option>
            ))}
            <option value="full-loop">Full mock loop (week 28)</option>
          </select>
        </label>
      </p>

      {kind === 'full-loop' ? (
        <div>
          <p>
            Five rounds in this order, each logged as its own entry:{' '}
            {FULL_LOOP.map((k) => MOCK_LABELS[k]).join(', ')}.
          </p>
          <p>
            <label>
              Competencies for the concept round (comma separated)
              <br />
              <input
                type="text"
                size={60}
                value={inputs.competencyList}
                onChange={(e) => set('competencyList', e.target.value)}
              />
            </label>
          </p>
          <p>
            <label>
              Project summary
              <br />
              <textarea
                rows={3}
                cols={60}
                value={inputs.projectSummary}
                onChange={(e) => set('projectSummary', e.target.value)}
              />
            </label>
          </p>
          <p>
            <label>
              Live-coding problem
              <br />
              <textarea
                rows={3}
                cols={60}
                value={inputs.problemStatement}
                onChange={(e) => set('problemStatement', e.target.value)}
              />
            </label>
          </p>
          <p>
            <label>
              System design problem
              <br />
              <textarea
                rows={3}
                cols={60}
                value={inputs.designProblem}
                onChange={(e) => set('designProblem', e.target.value)}
              />
            </label>
          </p>
          {FULL_LOOP.map((k, i) => (
            <details key={k} open={i === 0}>
              <summary>
                Round {i + 1}: {MOCK_LABELS[k]}
              </summary>
              <Round kind={k} track={track} inputs={inputs} />
            </details>
          ))}
        </div>
      ) : (
        <div>
          {field && (
            <p>
              <label>
                {field.label}
                <br />
                <textarea
                  rows={3}
                  cols={60}
                  value={inputs[field.key]}
                  onChange={(e) => set(field.key, e.target.value)}
                />
              </label>
            </p>
          )}
          <Round key={kind} kind={kind} track={track} inputs={inputs} />
        </div>
      )}
    </div>
  );
}
