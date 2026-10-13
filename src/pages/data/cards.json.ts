import type { APIRoute } from 'astro';
import { publishedCards } from '../../lib/content/published';

/** Review cards of published lessons (planned lessons are never shipped). */
export const GET: APIRoute = async () =>
  new Response(JSON.stringify(await publishedCards()), {
    headers: { 'Content-Type': 'application/json' },
  });
