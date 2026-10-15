import type { APIRoute, GetStaticPaths } from 'astro';
import { visibleDrills } from '../../../lib/content/gym';

/** The fixed files and the bug explanation: shown only after a pass or when the learner gives up. */
export const getStaticPaths = (async () => {
  const drills = await visibleDrills();
  return drills.map((d) => ({
    params: { id: d.data.id },
    props: { data: { bugExplanation: d.data.bugExplanation, fixedFiles: d.data.fixedFiles } },
  }));
}) satisfies GetStaticPaths;

export const GET: APIRoute = ({ props }) =>
  new Response(JSON.stringify(props.data), { headers: { 'Content-Type': 'application/json' } });
