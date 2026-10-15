import { getCollection } from 'astro:content';
import type { ContentIndex } from '../competency/types';
import { visibleDrills, visibleProblems } from './gym';
import { publishedLessonIds } from './published';

/** A description of published content for computing competency levels. Contains no answers or tests. */
export async function buildContentIndex(): Promise<ContentIndex> {
  const published = await publishedLessonIds();
  const quizzes = (await getCollection('quizzes')).filter((q) => published.has(q.data.lesson));
  const exercises = (await getCollection('exercises')).filter((e) => published.has(e.data.lesson));
  const cards = (await getCollection('cards')).filter((c) => published.has(c.data.lesson));
  const practice = (await getCollection('practice')).filter((p) => published.has(p.data.lesson));
  const docs = await getCollection('docs');
  return {
    questions: quizzes.flatMap((q) =>
      q.data.items.map((i) => ({ id: i.id, lesson: q.data.lesson, competencies: i.competencies })),
    ),
    exercises: exercises.map((e) => ({
      id: e.id,
      lesson: e.data.lesson,
      kind: e.data.kind,
      competencies: e.data.competencies,
    })),
    cards: cards.flatMap((c) =>
      c.data.cards.map((x) => ({
        id: x.id,
        lesson: c.data.lesson,
        type: x.type,
        competencies: x.competencies,
      })),
    ),
    problems: (await visibleProblems()).map((p) => ({
      id: p.data.id,
      competencies: p.data.competencies,
      timeLimitMin: p.data.timeLimitMin,
    })),
    drills: (await visibleDrills()).map((d) => ({
      id: d.data.id,
      kind: d.data.kind,
      competencies: d.data.competencies,
      timeLimitMin: d.data.timeLimitMin,
    })),
    practice: practice.map((p) => ({
      id: p.data.id,
      lesson: p.data.lesson,
      kind: p.data.kind,
      competencies: p.data.competencies,
      steps: p.data.steps?.length ?? 0,
    })),
    lessons: [...published].map((id) => ({
      id,
      labMilestones: docs.find((d) => d.id === `lessons/${id}`)?.data.labMilestones ?? [],
    })),
  };
}
