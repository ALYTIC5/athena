import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';

export const GET: APIRoute = async () => {
  const defs = (await getCollection('competencies')).map((c) => c.data);
  return new Response(JSON.stringify(defs), { headers: { 'Content-Type': 'application/json' } });
};
