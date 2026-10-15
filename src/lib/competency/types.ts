export interface CompetencyDef {
  id: string;
  track: string;
  title: string;
  evidence: 'browser' | 'interview' | 'local';
  core: boolean;
}

/** What the site knows about content, so levels can be computed from the learner's records. */
export interface ContentIndex {
  questions: { id: string; lesson: string; competencies: string[] }[];
  exercises: {
    id: string;
    lesson: string;
    kind: 'faded' | 'debug' | 'make' | 'write-tests';
    competencies: string[];
  }[];
  cards: { id: string; lesson: string; type: string; competencies: string[] }[];
  problems: { id: string; competencies: string[]; timeLimitMin: number }[];
  drills: {
    id: string;
    kind: 'code-reading' | 'ai-assisted';
    competencies: string[];
    timeLimitMin: number;
  }[];
  practice: {
    id: string;
    lesson: string;
    kind: 'checklist' | 'rubric';
    competencies: string[];
    steps: number;
  }[];
  lessons: { id: string; labMilestones: string[] }[];
}

export interface CompetencyResult {
  /** 0 Not started, 1 Recognise, 2 Explain, 3 Apply with help, 4 Apply unaided, 5 Debug and teach. */
  level: 0 | 1 | 2 | 3 | 4 | 5;
  /** Plain-language reasons, one per rule that was met. */
  evidence: string[];
  /** Cards overdue by more than 14 days, or with recent lapses. The level does not drop. */
  rusty: boolean;
  /** Questions answered "certain" but wrong in the last 30 days. */
  overconfident: string[];
}

export const LEVEL_NAMES = [
  'Not started',
  'Recognise',
  'Explain',
  'Apply with help',
  'Apply unaided',
  'Debug and teach',
] as const;
