import { basename } from 'node:path';
import { componentUses } from '../mdx';
import { error, isSampleLesson, type Content, type Issue } from '../types';

const stem = (file: string) => basename(file).replace(/\.(yaml|mdx)$/, '');

/** Minutes per item (CONTENT_GUIDE section 8, rule 6). */
interface Rates {
  warmup: number;
  chunk: number;
  check: number;
  faded: number;
  parsons: number;
  debug: number;
  make: number;
  sqlQuery: number;
  explain: number;
  masteryQuestion: number;
  masteryMake: number;
  interview: number;
  checklistStep: number;
  rubric: number;
}

const OVER_TWO_HOURS: Rates = {
  warmup: 8,
  chunk: 10,
  check: 2,
  faded: 8,
  parsons: 5,
  debug: 15,
  make: 30,
  sqlQuery: 3,
  explain: 15,
  masteryQuestion: 1.5,
  masteryMake: 25,
  interview: 4,
  checklistStep: 3,
  rubric: 10,
};
const TWO_HOURS: Rates = { ...OVER_TWO_HOURS, make: 20, explain: 10, masteryMake: 15 };
const SHORT: Rates = { ...TWO_HOURS };

export const OVERRUN_ALLOWED = 1.15;
export const WEEK_CAP_MIN = 165; // 2.75 hours

export function ratesFor(anatomy: string, durationMin: number): Rates {
  if (anatomy !== 'full') return SHORT;
  return durationMin > 120 ? OVER_TWO_HOURS : TWO_HOURS;
}

type Exercise = { id: string; lesson: string; kind: string; runtime: string; estMin?: number };
type Practice = { id: string; kind: string; steps?: unknown[]; estMin?: number };
type Question = { id: string; type: string; pools: string[]; chunk?: number };

export interface Estimate {
  total: number;
  parts: Record<string, number>;
}

/** Estimate a lesson's time from what the learner sees, not from the pools. */
export function estimateLesson(args: {
  body: string;
  anatomy: string;
  durationMin: number;
  exercises: Map<string, Exercise>;
  practice: Map<string, Practice>;
  questions: Question[];
  interviewCount: number;
}): Estimate {
  const r = ratesFor(args.anatomy, args.durationMin);
  const parts: Record<string, number> = {};
  const add = (key: string, minutes: number) => {
    parts[key] = (parts[key] ?? 0) + minutes;
  };
  for (const c of componentUses(args.body)) {
    const a = c.attrs;
    switch (c.name) {
      case 'WarmUp':
        add('warm-up', r.warmup);
        break;
      case 'Chunk':
        add('chunks', r.chunk);
        break;
      case 'Quiz': {
        const chunk = a['chunk'] === undefined ? undefined : Number(a['chunk']);
        const shown = args.questions.filter(
          (q) =>
            q.pools.includes('check') &&
            q.type !== 'predict' &&
            q.type !== 'parsons' &&
            (chunk === undefined || q.chunk === chunk),
        ).length;
        add('quiz', shown * r.check);
        break;
      }
      case 'Predict':
        add('predict', r.check);
        break;
      case 'Parsons':
        add('parsons', r.parsons);
        break;
      case 'Exercise': {
        const ex = args.exercises.get(a['id'] ?? '');
        if (!ex) break;
        const byKind =
          ex.runtime === 'sql'
            ? r.sqlQuery
            : ex.kind === 'faded'
              ? r.faded
              : ex.kind === 'debug'
                ? r.debug
                : r.make;
        add('exercises', ex.estMin ?? byKind);
        break;
      }
      case 'ExplainBack':
        add('explain-back', r.explain);
        break;
      case 'MasteryCheck': {
        const count =
          a['count'] === undefined ? (args.anatomy === 'full' ? 8 : 6) : Number(a['count']);
        add('mastery', count * r.masteryQuestion + r.masteryMake);
        break;
      }
      case 'InterviewCorner':
        add('interview', args.interviewCount * r.interview);
        break;
      case 'Checklist': {
        const p = args.practice.get(a['id'] ?? '');
        if (p) add('checklists', p.estMin ?? (p.steps?.length ?? 0) * r.checklistStep);
        break;
      }
      case 'Rubric': {
        const p = args.practice.get(a['id'] ?? '');
        if (p) add('rubrics', p.estMin ?? r.rubric);
        break;
      }
    }
  }
  const total = Object.values(parts).reduce((s, n) => s + n, 0);
  return { total, parts };
}

/** Rule 6: the estimate may exceed durationMin by at most 15%, and each week is capped at 2.75 hours. */
export function checkTime(content: Content): Issue[] {
  const issues: Issue[] = [];
  const published = new Set<string>();
  for (const w of content.curriculum)
    for (const l of w.lessons) if (l.status === 'published') published.add(l.id);

  const exercises = new Map(
    content.exercises.map((e) => [String(e.data['id']), e.data as unknown as Exercise]),
  );
  const practice = new Map(
    content.practice.map((p) => [String(p.data['id']), p.data as unknown as Practice]),
  );

  for (const page of content.lessons) {
    const id = stem(page.file);
    if (!published.has(id) || isSampleLesson(id)) continue;
    const anatomy = String(page.frontmatter['anatomy'] ?? '');
    if (anatomy === 'orientation') continue; // every item in start-00 sets estMin; no pool rules
    const durationMin = Number(page.frontmatter['durationMin'] ?? 0);
    const quiz = content.quizzes.find((q) => q.data['lesson'] === id);
    const interview = content.interview.find((q) => q.data['lesson'] === id);
    const est = estimateLesson({
      body: page.body,
      anatomy,
      durationMin,
      exercises,
      practice,
      questions: (quiz?.data['items'] as Question[]) ?? [],
      interviewCount: ((interview?.data['questions'] as unknown[]) ?? []).length,
    });
    if (est.total > durationMin * OVERRUN_ALLOWED) {
      issues.push(
        error(
          'time',
          page.file,
          `Estimated ${Math.round(est.total)} min against a target of ${durationMin} min (more than 15% over). Cut content rather than raising the target.`,
        ),
      );
    }
  }

  for (const w of content.curriculum) {
    const total =
      w.lessons.reduce((s, l) => s + l.durationMin, 0) + w.lab.reduce((s, l) => s + l.minutes, 0);
    if (total > WEEK_CAP_MIN) {
      issues.push(
        error(
          'time',
          'src/content/curriculum.yaml',
          `Week ${w.week} totals ${total} min; the cap is ${WEEK_CAP_MIN} (2.75 hours).`,
        ),
      );
    }
  }
  return issues;
}
