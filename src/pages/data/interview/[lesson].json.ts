import type { APIRoute, GetStaticPaths } from 'astro';
import { getCollection } from 'astro:content';
import { publishedLessonIds } from '../../../lib/content/published';

export const getStaticPaths = (async () => {
  const published = await publishedLessonIds();
  const docs = (await getCollection('interview')).filter((d) => published.has(d.data.lesson));
  return docs.map((d) => ({
    params: { lesson: d.data.lesson },
    props: { questions: d.data.questions },
  }));
}) satisfies GetStaticPaths;

export const GET: APIRoute = ({ props }) =>
  new Response(JSON.stringify(props.questions), {
    headers: { 'Content-Type': 'application/json' },
  });
