import { z } from 'astro/zod';

const id = z
  .string()
  .regex(/^[a-z0-9]+(?:[.-][a-z0-9]+)*$/, 'lowercase letters, digits and hyphens');
const competencyIds = z.array(z.string().regex(/^[a-z]+\.[a-z0-9-]+$/)).min(1);

export const lessonFields = z.object({
  lessonId: id.optional(),
  week: z.number().int().min(1).max(28).optional(),
  track: z.string().optional(),
  durationMin: z.number().int().positive().optional(),
  anatomy: z.enum(['full', 'short', 'orientation']).optional(),
  competencies: z.array(z.string()).optional(),
  prerequisites: z.array(z.string()).optional(),
  /** Lab milestones this lesson links to; used for local-evidence competency levels. */
  labMilestones: z.array(z.string()).optional(),
  whyItMatters: z.string().optional(),
  objectives: z.array(z.string()).optional(),
  sources: z.array(z.object({ title: z.string(), url: z.url() })).optional(),
});

export const competencySchema = z.object({
  id: z.string().regex(/^[a-z]+\.[a-z0-9-]+$/),
  track: z.string(),
  title: z.string(),
  evidence: z.enum(['browser', 'interview', 'local']),
  core: z.boolean().default(true),
});

export const curriculumWeekSchema = z.object({
  id,
  week: z.number().int().min(1).max(28),
  lessons: z.array(
    z.object({
      id,
      title: z.string(),
      durationMin: z.number().int().positive(),
      status: z.enum(['planned', 'published']),
    }),
  ),
  lab: z.array(z.object({ milestone: id, minutes: z.number().int().positive() })),
  gym: z.object({ focus: z.string(), target: z.number().int().min(0) }),
});

const sqlCheck = z.union([
  z.string(),
  z.object({ sql: z.string(), expectError: z.string().regex(/^[0-9A-Z]{5}$/) }),
]);

export const exerciseSchema = z
  .object({
    id,
    lesson: id,
    runtime: z.enum(['python', 'sql']),
    kind: z.enum(['faded', 'debug', 'make', 'write-tests']),
    pools: z.array(z.enum(['lesson', 'mastery'])).min(1),
    title: z.string().optional(),
    difficulty: z.number().int().min(1).max(5).optional(),
    competencies: competencyIds,
    timeoutMs: z.number().int().positive().default(5000),
    packages: z.array(z.string()).default([]),
    estMin: z.number().positive().optional(),
    prompt: z.string(),
    starter: z.string(),
    visibleTests: z.string().optional(),
    hiddenTests: z.string().optional(),
    feedback: z.array(z.object({ test: z.string(), message: z.string() })).default([]),
    hints: z.array(z.string()).length(3).optional(),
    referenceSolution: z.string(),
    wrongSolutions: z.array(z.object({ label: z.string(), code: z.string() })).min(2),
    implementations: z
      .object({
        correct: z.string(),
        buggy: z.array(z.object({ label: z.string(), code: z.string() })).min(3),
      })
      .optional(),
    extensions: z.array(z.string()).default([]),
    schema: z.string().optional(),
    compare: z
      .union([
        z.literal('none'),
        z.object({
          orderMatters: z.boolean().default(false),
          numericTolerance: z.number().nonnegative().default(0),
        }),
      ])
      .optional(),
    checks: z.array(sqlCheck).default([]),
    planCheck: z.object({ query: z.string(), accept: z.array(z.string()).min(1) }).optional(),
    queueClaim: z.boolean().optional(),
    explanation: z.string(),
  })
  .refine((e) => e.runtime !== 'sql' || e.schema !== undefined, {
    message: 'SQL exercises need a schema',
  })
  .refine((e) => e.kind !== 'write-tests' || e.implementations !== undefined, {
    message: 'write-tests exercises need implementations',
  });

const questionBase = {
  id,
  pools: z.array(z.enum(['check', 'mastery', 'warmup'])).min(1),
  chunk: z.number().int().positive().optional(),
  objective: z.number().int().positive().optional(),
  competencies: competencyIds,
};

const option = z.object({ text: z.string(), correct: z.boolean(), why: z.string() });

export const questionSchema = z.discriminatedUnion('type', [
  z.object({
    ...questionBase,
    type: z.enum(['single', 'multiple']),
    stem: z.string(),
    code: z.string().optional(),
    options: z.array(option).min(2),
  }),
  z.object({
    ...questionBase,
    type: z.literal('short'),
    stem: z.string(),
    accepted: z.array(z.string()).min(1),
    patterns: z.array(z.string()).default([]),
    explanation: z.string(),
  }),
  z.object({
    ...questionBase,
    type: z.literal('predict'),
    code: z.string(),
    investigate: z.array(z.string()).default([]),
    expected: z.string().optional(),
  }),
  z.object({
    ...questionBase,
    type: z.literal('parsons'),
    lines: z.array(z.string()).min(2),
    distractors: z.array(z.string()).default([]),
  }),
  z.object({
    ...questionBase,
    type: z.literal('bug'),
    code: z.string(),
    buggyLine: z.number().int().positive(),
    explanation: z.string(),
  }),
  z.object({
    ...questionBase,
    type: z.literal('order'),
    stem: z.string(),
    steps: z.array(z.string()).min(2),
  }),
]);

export const quizSchema = z.object({ lesson: id, items: z.array(questionSchema).min(1) });

export const practiceSchema = z.object({
  id,
  lesson: id,
  kind: z.enum(['checklist', 'rubric']),
  competencies: competencyIds,
  title: z.string(),
  estMin: z.number().positive().optional(),
  steps: z.array(z.object({ do: z.string(), expect: z.string().optional() })).optional(),
  criteria: z
    .array(
      z.object({
        name: z.string(),
        levels: z.array(z.object({ score: z.number().int(), description: z.string() })).min(2),
      }),
    )
    .optional(),
});

export const cardsSchema = z.object({
  lesson: id,
  cards: z
    .array(
      z.object({
        id,
        type: z.enum(['basic', 'cloze', 'predict', 'explain']),
        competencies: competencyIds,
        front: z.string(),
        back: z.string(),
      }),
    )
    .min(1),
});

export const interviewSchema = z.object({
  lesson: id,
  questions: z
    .array(
      z.object({
        id,
        competencies: competencyIds,
        question: z.string(),
        modelAnswer: z.string(),
        listenFor: z.array(z.string()).min(1),
      }),
    )
    .min(1),
});

export const problemSchema = z.object({
  id,
  title: z.string(),
  pattern: z.string(),
  competencies: competencyIds,
  difficulty: z.enum(['easy', 'medium']),
  timeLimitMin: z.number().int().positive(),
  statement: z.string(),
  examples: z.array(z.string()).min(1),
  constraints: z.array(z.string()),
  starter: z.string(),
  visibleTests: z.string(),
  hiddenTests: z.string(),
  referenceSolutions: z
    .array(z.object({ code: z.string(), time: z.string(), space: z.string() }))
    .min(1),
  wrongSolutions: z.array(z.object({ label: z.string(), code: z.string() })).min(2),
  patternExplanation: z.string(),
  commonMistakes: z.array(z.string()),
  followUps: z.array(z.string()),
});

export const drillSchema = z.object({
  id,
  kind: z.enum(['code-reading', 'ai-assisted']),
  title: z.string(),
  competencies: competencyIds,
  files: z.record(z.string(), z.string()),
  /** AI-assisted drills: what the learner is asked to do. */
  task: z.string().optional(),
  failingTest: z.string(),
  bugExplanation: z.string(),
  fixedFiles: z.record(z.string(), z.string()),
  timeLimitMin: z.number().int().positive().default(30),
});
