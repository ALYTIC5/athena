import type { APIRoute, GetStaticPaths } from 'astro';
import { getCollection } from 'astro:content';
import { publishedLessonIds } from '../../../lib/content/published';

export const getStaticPaths = (async () => {
  const published = await publishedLessonIds();
  const docs = (await getCollection('practice')).filter((d) => published.has(d.data.lesson));
  return docs.map((d) => ({ params: { id: d.data.id }, props: { practice: d.data } }));
}) satisfies GetStaticPaths;

export const GET: APIRoute = ({ props }) =>
  new Response(JSON.stringify(props.practice), { headers: { 'Content-Type': 'application/json' } });
