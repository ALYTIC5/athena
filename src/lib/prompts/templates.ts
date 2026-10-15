/**
 * Claude prompt templates, word for word from docs/SPEC.md section 11. Placeholders in braces in
 * the spec are filled from the page. Do not reword these: tests compare them to the spec.
 */

export interface TutorArgs {
  lessonTitle: string;
  exercisePrompt: string;
  code: string;
  lastOutputOrFailingTest: string;
}

export function tutorPrompt(a: TutorArgs): string {
  return [
    `You are my programming tutor. I'm learning: ${a.lessonTitle}.`,
    `Exercise: ${a.exercisePrompt}`,
    `My code:`,
    a.code,
    `What happens when I run it:`,
    a.lastOutputOrFailingTest,
    `Rules: do not write the solution, and do not write more than one line of code at a time. Ask me one question that helps me find the problem myself. If I'm still stuck after two exchanges, explain the concept I'm missing with a different, small example.`,
  ].join('\n');
}

export interface ExplainBackArgs {
  track: string;
  objectives: string[];
  code: string;
}

export function explainBackPrompt(a: ExplainBackArgs): string {
  return [
    `You are a strict but fair technical interviewer for a junior ${a.track} role. I'm practising.`,
    `The objectives I'm working towards:`,
    a.objectives.map((o) => `- ${o}`).join('\n'),
    `Here is my code or answer:`,
    a.code,
    `Rules:`,
    `- Ask me one question at a time and wait for my answer.`,
    `- Start by asking me to explain what my code does and why I made each choice.`,
    `- Push on why, edge cases, complexity, failure modes and alternatives.`,
    `- Don't give me the answer. If I'm stuck after two tries, give a small hint.`,
    `- After 8 to 10 questions, or when I say "score", stop and give:`,
    `  1. A score from 1 to 5 for correctness, depth of understanding and clarity.`,
    `  2. The three biggest gaps, each written as a short question I should be able to answer.`,
    `  3. One thing I did well.`,
  ].join('\n');
}

export type MockKind =
  'concept' | 'project' | 'behavioural' | 'live-coding' | 'ai-assisted' | 'system-design';

export interface MockArgs {
  track: string;
  /** Concept round: the competencies to be asked about. */
  competencyList?: string;
  /** Project deep-dive: the learner's own summary. */
  projectSummary?: string;
  /** Live coding: the problem statement. */
  problemStatement?: string;
  /** AI-assisted round: the task. */
  task?: string;
  /** System design: the problem. */
  designProblem?: string;
}

export function mockPrompt(kind: MockKind, a: MockArgs): string {
  switch (kind) {
    case 'concept':
      return `Interview me for a junior ${a.track} role. Ask 8 questions about ${a.competencyList ?? ''}, one at a time, starting easy and getting harder. Don't teach during the round. At the end, score correctness, depth and clarity from 1 to 5 and list my three biggest gaps as questions.`;
    case 'project':
      return `Act as a sceptical senior engineer interviewing me about a project. Here is my summary: ${a.projectSummary ?? ''}. Ask one question at a time about design decisions, trade-offs, failure modes, testing and what I'd change. Then score depth, honesty about limitations and clarity from 1 to 5 and list my three biggest gaps.`;
    case 'behavioural':
      return `Ask me 5 behavioural questions typical for a junior developer, one at a time. After each answer, rate my STAR structure from 1 to 5 and say what was missing. Finish with my strongest and weakest story.`;
    case 'live-coding':
      return `Act as the interviewer for this problem: ${a.problemStatement ?? ''}. Let me ask clarifying questions first. Don't hint unless I ask. Evaluate how I communicate, my approach before coding, correctness, testing and complexity analysis, each from 1 to 5.`;
    case 'ai-assisted':
      return `Act as an interviewer running an AI-assisted coding round. The task: ${a.task ?? ''}. I'll tell you what I'd ask my AI assistant and why, and how I'd check its output. Evaluate whether I stay in control, verify output and explain my reasoning, each from 1 to 5.`;
    case 'system-design':
      return `Act as an interviewer running a 30-minute system design round for a junior ${a.track} role. The problem: ${a.designProblem ?? ''}. Let me ask clarifying questions first, then ask one question at a time about components, data model, API, failure handling, scaling and trade-offs. Don't design it for me. At the end, score requirements, design, failure handling and communication from 1 to 5 and list my three biggest gaps as questions.`;
  }
}

/** Score names the learner logs after each kind of session. */
export const SCORE_LABELS: Record<MockKind | 'explain', string[]> = {
  explain: ['correctness', 'depth of understanding', 'clarity'],
  concept: ['correctness', 'depth', 'clarity'],
  project: ['depth', 'honesty about limitations', 'clarity'],
  behavioural: ['STAR structure'],
  'live-coding': [
    'communication',
    'approach before coding',
    'correctness',
    'testing',
    'complexity analysis',
  ],
  'ai-assisted': ['staying in control', 'verifying output', 'explaining reasoning'],
  'system-design': ['requirements', 'design', 'failure handling', 'communication'],
};

export const MOCK_LABELS: Record<MockKind, string> = {
  concept: 'Concept round',
  project: 'Project deep-dive',
  behavioural: 'Behavioural',
  'live-coding': 'Live coding',
  'ai-assisted': 'AI-assisted round',
  'system-design': 'System design',
};

/** The week-28 full mock loop: five rounds in this order, logged as five entries. */
export const FULL_LOOP: MockKind[] = [
  'concept',
  'live-coding',
  'system-design',
  'project',
  'behavioural',
];
