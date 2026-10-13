import * as z from 'zod/mini';

export const STORE_VERSION = 1;
export const STORAGE_KEY = 'athena';

const isoDate = z.string().check(z.regex(/^\d{4}-\d{2}-\d{2}$/));
const isoTime = z.string().check(z.regex(/^\d{4}-\d{2}-\d{2}T[\d:.]+(?:Z|[+-]\d{2}:\d{2})$/));
const meta = { updatedAt: isoTime };
const level05 = z.union([
  z.literal(0),
  z.literal(1),
  z.literal(2),
  z.literal(3),
  z.literal(4),
  z.literal(5),
]);
const score15 = z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5)]);
const rating14 = z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]);
const hints03 = z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3)]);

const settings = z.object({
  ...meta,
  startDate: z.optional(isoDate),
  hoursPerWeek: z.number().check(z.gt(0), z.lte(40)),
  jobTrack: z.string(),
  createdAt: isoTime,
  lastExportAt: z.optional(isoTime),
  reviewCaps: z.object({
    reviews: z.int().check(z.gte(0)),
    newCards: z.int().check(z.gte(0)),
  }),
  shortcutsEnabled: z.boolean(),
  persistentStorage: z.optional(z.boolean()),
});

const lesson = z.object({
  ...meta,
  status: z.enum(['not-started', 'in-progress', 'mastered', 'needs-review']),
  startedAt: z.optional(isoTime),
  masteredAt: z.optional(isoTime),
  masteryAttempts: z.array(
    z.object({
      at: isoTime,
      score: z.number(),
      passed: z.boolean(),
      missedCompetencies: z.array(z.string()),
    }),
  ),
});

const exercise = z.object({
  ...meta,
  attempts: z.array(
    z.object({
      at: isoTime,
      passed: z.boolean(),
      hintsUsed: hints03,
      tutorUsed: z.boolean(),
      solutionViewed: z.boolean(),
      durationMs: z.number(),
    }),
  ),
  bestCredit: z.number().check(z.gte(0), z.lte(1)),
});

const answer = z.object({
  ...meta,
  attempts: z.array(
    z.object({
      at: isoTime,
      correct: z.boolean(),
      confidence: z.optional(z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)])),
      source: z.enum(['check', 'warmup', 'mastery']),
    }),
  ),
});

const card = z.object({
  ...meta,
  state: z.object({
    due: isoTime,
    stability: z.number(),
    difficulty: z.number(),
    reps: z.int(),
    lapses: z.int(),
    state: z.enum(['new', 'learning', 'review', 'relearning']),
    lastReview: z.optional(isoTime),
    learningSteps: z.optional(z.int()),
  }),
  custom: z.optional(
    z.object({ front: z.string(), back: z.string(), competencies: z.array(z.string()) }),
  ),
});

const gym = z.object({
  ...meta,
  attempts: z.array(
    z.object({
      at: isoTime,
      mode: z.enum(['approach', 'timed', 'mixed', 'reattempt']),
      passed: z.boolean(),
      durationMs: z.number(),
      hintsUsed: z.number(),
      checklist: z.array(z.string()),
      communication: z.optional(score15),
    }),
  ),
  reattempt: z.optional(
    z.object({
      due: isoTime,
      stability: z.number(),
      difficulty: z.number(),
      reps: z.int(),
      lapses: z.int(),
    }),
  ),
});

const drill = z.object({
  ...meta,
  attempts: z.array(
    z.object({
      at: isoTime,
      passed: z.boolean(),
      durationMs: z.number(),
      hintsUsed: z.number(),
      solutionViewed: z.boolean(),
      reflection: z.optional(z.string()),
    }),
  ),
});

const session = z.object({
  id: z.string(),
  at: isoTime,
  kind: z.enum([
    'explain',
    'concept',
    'project',
    'behavioural',
    'live-coding',
    'ai-assisted',
    'system-design',
  ]),
  lessonId: z.optional(z.string()),
  exerciseId: z.optional(z.string()),
  competencies: z.array(z.string()),
  scores: z.record(z.string(), score15),
  gaps: z.array(z.string()),
  notes: z.optional(z.string()),
});

const story = z.object({
  ...meta,
  id: z.string(),
  title: z.string(),
  situation: z.string(),
  task: z.string(),
  action: z.string(),
  result: z.string(),
  learned: z.string(),
});

export const learnerDataSchema = z.object({
  version: z.literal(STORE_VERSION),
  settings,
  lessons: z.record(z.string(), lesson),
  exercises: z.record(z.string(), exercise),
  answers: z.record(z.string(), answer),
  cards: z.record(z.string(), card),
  reviewLog: z.array(z.object({ cardId: z.string(), at: isoTime, rating: rating14 })),
  gym: z.record(z.string(), gym),
  drills: z.record(z.string(), drill),
  sessions: z.array(session),
  stories: z.array(story),
  checklists: z.record(z.string(), z.object({ ...meta, done: z.array(z.string()) })),
  rubrics: z.record(
    z.string(),
    z.object({ ...meta, scores: z.record(z.string(), z.number()), notes: z.optional(z.string()) }),
  ),
  labs: z.record(
    z.string(),
    z.object({
      ...meta,
      done: z.boolean(),
      evidenceUrl: z.optional(z.string()),
      at: z.optional(isoTime),
    }),
  ),
  weeklyLog: z.record(
    z.string().check(z.regex(/^\d{4}-W\d{2}$/)),
    z.object({
      ...meta,
      hours: z.number(),
      applications: z.number(),
      pitches: z.number(),
      commitDays: z.number(),
    }),
  ),
  selfRatings: z.record(z.string(), z.object({ ...meta, level: level05 })),
});

export type LearnerData = z.infer<typeof learnerDataSchema>;
