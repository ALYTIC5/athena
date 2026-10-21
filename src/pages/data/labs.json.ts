import type { APIRoute } from 'astro';
import { labMilestones } from '../../lib/content/labs';
import { LABS } from '../../lib/labs/progress';

/** Lab and milestone metadata for the Labs pages. No lab text is shipped here, only titles and counts. */
export const GET: APIRoute = async () => {
  const milestones = await labMilestones();
  const body = LABS.map((lab) => ({
    slug: lab.slug,
    name: lab.name,
    summary: lab.summary,
    milestones: milestones
      .filter((m) => m.lab === lab.slug)
      .map(({ id, title, hours, weeks, checks }) => ({ id, title, hours, weeks, checks })),
  }));
  return new Response(JSON.stringify(body), { headers: { 'Content-Type': 'application/json' } });
};
