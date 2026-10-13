import type { APIRoute } from 'astro';
import { publishedLessons, publishedQuestions } from '../../lib/content/published';

/** Question pools for warm-ups, quizzes and mastery checks: published lessons only. */
export const GET: APIRoute = async () => {
  const lessons = (await publishedLessons()).map(({ id, order, week }) => ({ id, order, week }));
  const items = await publishedQuestions();
  return new Response(JSON.stringify({ lessons, items }), {
    headers: { 'Content-Type': 'application/json' },
  });
};
