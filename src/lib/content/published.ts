import { existsSync, readFileSync } from 'node:fs';
import { getCollection } from 'astro:content';
import type { LessonOrder, Question } from '../quiz/types';

/**
 * Content of planned lessons is schema-checked but never rendered or shipped. In end-to-end
 * builds (ATHENA_SAMPLES=1) the sample lessons count as published so components can be tested.
 */
export function samplesEnabled(): boolean {
  return process.env.ATHENA_SAMPLES === '1';
}

export function isSampleLesson(id: string): boolean {
  return id === 'sample' || id.startsWith('sample-');
}

export interface PublishedLesson extends LessonOrder {
  title: string;
  anatomy: 'full' | 'short' | 'orientation' | undefined;
}

/** Published lessons in course order: curriculum first, then samples (when enabled). */
export async function publishedLessons(): Promise<PublishedLesson[]> {
  const weeks = (await getCollection('curriculum'))
    .map((w) => w.data)
    .sort((a, b) => a.week - b.week);
  const out: PublishedLesson[] = [];
  for (const w of weeks) {
    for (const l of w.lessons) {
      if (l.status !== 'published') continue;
      out.push({
        id: l.id,
        order: out.length,
        week: w.week,
        title: l.title,
        anatomy: l.id === 'start-00' ? 'orientation' : undefined,
      });
    }
  }
  if (samplesEnabled()) {
    const ids = new Set<string>();
    for (const q of await getCollection('quizzes'))
      if (isSampleLesson(q.data.lesson)) ids.add(q.data.lesson);
    for (const e of await getCollection('exercises'))
      if (isSampleLesson(e.data.lesson)) ids.add(e.data.lesson);
    for (const id of [...ids].sort()) {
      out.push({ id, order: out.length, week: null, title: id, anatomy: 'full' });
    }
  }
  return out;
}

export async function publishedLessonIds(): Promise<Set<string>> {
  return new Set((await publishedLessons()).map((l) => l.id));
}

export function loadPredictTruth(): Record<string, string> {
  const file = 'src/generated/predict-truth.json';
  if (!existsSync(file)) {
    throw new Error('Missing src/generated/predict-truth.json. Run `npm run truth` first.');
  }
  return JSON.parse(readFileSync(file, 'utf8')) as Record<string, string>;
}

/** All questions of published lessons, with the lesson id attached and predict ground truth filled in. */
export async function publishedQuestions(): Promise<Question[]> {
  const published = await publishedLessonIds();
  const truth = loadPredictTruth();
  const items: Question[] = [];
  for (const doc of await getCollection('quizzes')) {
    if (!published.has(doc.data.lesson)) continue;
    for (const item of doc.data.items) {
      const base = { ...item, lesson: doc.data.lesson } as Record<string, unknown>;
      if (item.type === 'predict') {
        const expected = truth[item.id];
        if (expected === undefined) {
          throw new Error(`No ground truth for predict item ${item.id}. Run \`npm run truth\`.`);
        }
        base.expected = expected;
      }
      items.push(base as unknown as Question);
    }
  }
  return items;
}
