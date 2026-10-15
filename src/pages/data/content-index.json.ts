import type { APIRoute } from 'astro';
import { buildContentIndex } from '../../lib/content/index-data';

export const GET: APIRoute = async () =>
  new Response(JSON.stringify(await buildContentIndex()), {
    headers: { 'Content-Type': 'application/json' },
  });
