export type Severity = 'error' | 'warning';

export interface Issue {
  severity: Severity;
  /** Short rule name, for example "schema", "reference", "coverage". */
  rule: string;
  /** File or object the issue is about. */
  where: string;
  message: string;
}

export const error = (rule: string, where: string, message: string): Issue => ({
  severity: 'error',
  rule,
  where,
  message,
});

export const warning = (rule: string, where: string, message: string): Issue => ({
  severity: 'warning',
  rule,
  where,
  message,
});

/** A parsed content file. `data` is untyped until a schema check passes. */
export interface Doc {
  file: string;
  data: Record<string, unknown>;
}

export interface LessonPage {
  file: string;
  frontmatter: Record<string, unknown>;
  body: string;
}

export interface CurriculumLesson {
  id: string;
  title: string;
  durationMin: number;
  status: 'planned' | 'published';
}

export interface CurriculumWeek {
  id: string;
  week: number;
  lessons: CurriculumLesson[];
  lab: { milestone: string; minutes: number }[];
  gym: { focus: string; target: number };
}

/** Everything the validator looks at, loaded from disk (or built in memory by tests). */
export interface Content {
  curriculum: CurriculumWeek[];
  competencies: { id: string; track?: string; title?: string; evidence?: string; core?: boolean }[];
  lessons: LessonPage[];
  exercises: Doc[];
  quizzes: Doc[];
  practice: Doc[];
  cards: Doc[];
  interview: Doc[];
  problems: Doc[];
  drills: Doc[];
}

export const isSampleLesson = (id: string) => id === 'sample' || id.startsWith('sample-');
