export type QuestionPool = 'check' | 'mastery' | 'warmup';

export interface BaseQuestion {
  id: string;
  lesson: string;
  pools: QuestionPool[];
  chunk?: number;
  objective?: number;
  competencies: string[];
}

export interface OptionItem {
  text: string;
  correct: boolean;
  why: string;
}

export type Question =
  | (BaseQuestion & {
      type: 'single' | 'multiple';
      stem: string;
      code?: string;
      options: OptionItem[];
    })
  | (BaseQuestion & {
      type: 'short';
      stem: string;
      accepted: string[];
      patterns: string[];
      explanation: string;
    })
  | (BaseQuestion & {
      type: 'predict';
      code: string;
      investigate: string[];
      /** Ground truth produced at build time by the Node grader; authors never type it. */
      expected: string;
    })
  | (BaseQuestion & { type: 'parsons'; lines: string[]; distractors: string[] })
  | (BaseQuestion & { type: 'bug'; code: string; buggyLine: number; explanation: string })
  | (BaseQuestion & { type: 'order'; stem: string; steps: string[] });

/** What the learner submitted, per question type. */
export type Response =
  | { type: 'single'; selected: number | null }
  | { type: 'multiple'; selected: number[] }
  | { type: 'short'; text: string }
  | { type: 'predict'; text: string }
  | { type: 'parsons'; lines: { text: string; indent: number }[] }
  | { type: 'bug'; line: number | null }
  | { type: 'order'; steps: string[] };

/** 1 guessing, 2 unsure, 3 fairly sure, 4 certain (matches the store's confidence field). */
export type Confidence = 1 | 2 | 3 | 4;

export const CONFIDENCE_LABELS: Record<Confidence, string> = {
  1: 'Guessing',
  2: 'Unsure',
  3: 'Fairly sure',
  4: 'Certain',
};

export interface LessonOrder {
  id: string;
  /** Position in the course: lower is earlier. */
  order: number;
  week: number | null;
}

export interface QuizPool {
  lessons: LessonOrder[];
  items: Question[];
}
