import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  CLAUDE_URL,
  COPIED_MESSAGE,
  deliverPrompt,
  type DeliverEnv,
} from '../src/lib/prompts/deliver';
import { gapToCard, logSession } from '../src/lib/prompts/sessions';
import {
  explainBackPrompt,
  FULL_LOOP,
  mockPrompt,
  tutorPrompt,
  type MockKind,
} from '../src/lib/prompts/templates';
import { buildQueue } from '../src/lib/srs/queue';
import { createDefault, load, type KeyValueStorage } from '../src/lib/store/store';

const spec = readFileSync('docs/SPEC.md', 'utf8');
const section = spec.slice(
  spec.indexOf('## 11. Claude prompt templates'),
  spec.indexOf('## 12. Data model'),
);

/** The fenced block under a "### Heading" in section 11. */
function block(heading: string): string {
  const start = section.indexOf(`### ${heading}`);
  const open = section.indexOf('```', start);
  const close = section.indexOf('```', open + 3);
  return section
    .slice(open + 3, close)
    .replace(/^\n/, '')
    .replace(/\n$/, '');
}

/** The quoted text of a bullet like `- **Concept round:** "..."`. */
function bullet(label: string): string {
  const line = section.split('\n').find((l) => l.startsWith(`- **${label}:**`)) ?? '';
  const m = /:\*\* "(.*)"$/.exec(line);
  return m?.[1] ?? '';
}

describe('prompt templates match docs/SPEC.md section 11 word for word', () => {
  it('tutor', () => {
    const expected = block('Tutor ("I\'m stuck")')
      .replace('{lesson_title}', 'Names and values')
      .replace('{exercise_prompt}', 'Write f.')
      .replace('{code}', 'def f(): pass')
      .replace('{last_output_or_failing_test}', 'AssertionError');
    expect(
      tutorPrompt({
        lessonTitle: 'Names and values',
        exercisePrompt: 'Write f.',
        code: 'def f(): pass',
        lastOutputOrFailingTest: 'AssertionError',
      }),
    ).toBe(expected);
  });

  it('explain-back', () => {
    const expected = block('Explain-back')
      .replace('{track}', 'AI automation')
      .replace('{objectives}', '- Explain A\n- Predict B')
      .replace('{code}', 'x = 1');
    expect(
      explainBackPrompt({
        track: 'AI automation',
        objectives: ['Explain A', 'Predict B'],
        code: 'x = 1',
      }),
    ).toBe(expected);
  });

  const fill = (s: string) =>
    s
      .replace('{track}', 'backend Python')
      .replace('{competency_list}', 'py.sets, py.dicts')
      .replace('{project_summary}', 'A webhook service.')
      .replace('{problem_statement}', 'Find the first repeated caller.')
      .replace('{task}', 'Add retries.')
      .replace('{design_problem}', 'Design a booking queue.');

  const cases: [MockKind, string][] = [
    ['concept', 'Concept round'],
    ['project', 'Project deep-dive'],
    ['behavioural', 'Behavioural'],
    ['live-coding', 'Live coding'],
    ['ai-assisted', 'AI-assisted round'],
    ['system-design', 'System design'],
  ];
  for (const [kind, label] of cases) {
    it(`mock: ${label}`, () => {
      const expected = fill(bullet(label));
      expect(expected.length).toBeGreaterThan(40);
      expect(
        mockPrompt(kind, {
          track: 'backend Python',
          competencyList: 'py.sets, py.dicts',
          projectSummary: 'A webhook service.',
          problemStatement: 'Find the first repeated caller.',
          task: 'Add retries.',
          designProblem: 'Design a booking queue.',
        }),
      ).toBe(expected);
    });
  }

  it('the full mock loop is five rounds in the specified order', () => {
    expect(FULL_LOOP).toEqual([
      'concept',
      'live-coding',
      'system-design',
      'project',
      'behavioural',
    ]);
  });
});

describe('delivering a prompt', () => {
  it('opens the Claude tab first, then copies, then reports', async () => {
    const calls: string[] = [];
    const env: DeliverEnv = {
      open: (url, target) => {
        calls.push(`open ${url} ${target}`);
      },
      writeText: async (t) => {
        calls.push(`copy ${t}`);
      },
    };
    const r = await deliverPrompt('hello', env);
    expect(calls).toEqual([`open ${CLAUDE_URL} _blank`, 'copy hello']);
    expect(r).toEqual({ ok: true, message: COPIED_MESSAGE });
    expect(COPIED_MESSAGE).toBe('Prompt copied: paste it into Claude.');
  });

  it('reports a clipboard failure without throwing', async () => {
    const env: DeliverEnv = {
      open: () => undefined,
      writeText: async () => {
        throw new Error('denied');
      },
    };
    const r = await deliverPrompt('x', env);
    expect(r.ok).toBe(false);
  });
});

class MemoryStorage implements KeyValueStorage {
  private map = new Map<string, string>();
  getItem(k: string) {
    return this.map.get(k) ?? null;
  }
  setItem(k: string, v: string) {
    this.map.set(k, v);
  }
  removeItem(k: string) {
    this.map.delete(k);
  }
}

describe('logging a session', () => {
  const now = new Date('2026-10-14T10:00:00.000Z');

  it('stores scores and gaps', () => {
    const s = new MemoryStorage();
    logSession(s, now, {
      kind: 'concept',
      competencies: ['py.sets'],
      scores: { correctness: 4, depth: 3, clarity: 5 },
      gaps: ['  Why is a set lookup O(1)?  ', '', 'What is hashing?'],
    });
    const r = load(s);
    expect(r.status === 'ok' && r.data.sessions).toHaveLength(1);
    if (r.status !== 'ok') return;
    expect(r.data.sessions[0]?.gaps).toEqual(['Why is a set lookup O(1)?', 'What is hashing?']);
    expect(r.data.sessions[0]?.scores['depth']).toBe(3);
  });

  it('a gap becomes a review card in one step and shows up in the queue', () => {
    const s = new MemoryStorage();
    gapToCard(s, now, 'Why is a set lookup O(1)?', ['py.sets']);
    const r = load(s);
    expect(r.status).toBe('ok');
    if (r.status !== 'ok') return;
    const q = buildQueue({ content: [], data: r.data, now });
    expect(q.queue.map((c) => c.front)).toEqual(['Why is a set lookup O(1)?']);
    void createDefault;
  });
});
