import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import { labMilestones } from '../../lib/content/labs';

/** The 28-week plan, plus which lab milestone pages exist (the others show "coming soon"). */
export const GET: APIRoute = async () => {
  const weeks = (await getCollection('curriculum'))
    .map((w) => w.data)
    .sort((a, b) => a.week - b.week);
  const labPages = (await labMilestones()).map((m) => m.id);
  return new Response(JSON.stringify({ weeks, labPages }), {
    headers: { 'Content-Type': 'application/json' },
  });
};
