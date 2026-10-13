import type { APIRoute, GetStaticPaths } from 'astro';
import { getCollection } from 'astro:content';
import { publishedLessonIds } from '../../../lib/content/published';

/**
 * Hidden tests, hints, feedback and reference solutions, fetched by the island only when the
 * learner presses Check, asks for a hint or unlocks the solution. Wrong solutions never ship.
 */
export const getStaticPaths = (async () => {
  const published = await publishedLessonIds();
  const exercises = (await getCollection('exercises')).filter((e) => published.has(e.data.lesson));
  return exercises.map((e) => ({
    params: { id: e.id },
    props: {
      data: {
        hiddenTests: e.data.hiddenTests ?? '',
        feedback: e.data.feedback,
        hints: e.data.hints ?? [],
        referenceSolution: e.data.referenceSolution,
        explanation: e.data.explanation,
        implementations: e.data.implementations ?? null,
        sql:
          e.data.runtime === 'sql'
            ? {
                checks: e.data.checks,
                compare: e.data.compare ?? { orderMatters: false, numericTolerance: 0 },
                planCheck: e.data.planCheck ?? null,
                queueClaim: e.data.queueClaim ?? false,
              }
            : null,
      },
    },
  }));
}) satisfies GetStaticPaths;

export const GET: APIRoute = ({ props }) =>
  new Response(JSON.stringify(props.data), { headers: { 'Content-Type': 'application/json' } });
