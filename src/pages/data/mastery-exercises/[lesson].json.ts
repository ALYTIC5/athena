import type { APIRoute, GetStaticPaths } from 'astro';
import { getCollection } from 'astro:content';
import { publishedLessonIds } from '../../../lib/content/published';

/**
 * Public fields of a lesson's mastery make exercises. Hidden tests and solutions stay in
 * `/data/exercises/<id>.json` and are fetched only on Check.
 */
export const getStaticPaths = (async () => {
  const published = await publishedLessonIds();
  const all = await getCollection('exercises');
  return [...published].map((lesson) => ({
    params: { lesson },
    props: {
      exercises: all
        .filter(
          (e) =>
            e.data.lesson === lesson && e.data.pools.includes('mastery') && e.data.kind === 'make',
        )
        .map((e) => ({
          id: e.id,
          kind: e.data.kind,
          runtime: e.data.runtime,
          title: e.data.title ?? e.id,
          prompt: e.data.prompt,
          starter: e.data.starter,
          visibleTests: e.data.visibleTests ?? '',
          timeoutMs: e.data.timeoutMs,
          packages: e.data.packages,
          schema: e.data.schema ?? null,
          extensions: e.data.extensions,
        })),
    },
  }));
}) satisfies GetStaticPaths;

export const GET: APIRoute = ({ props }) =>
  new Response(JSON.stringify(props.exercises), {
    headers: { 'Content-Type': 'application/json' },
  });
