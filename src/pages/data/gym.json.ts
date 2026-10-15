import type { APIRoute } from 'astro';
import { visibleDrills, visibleProblems } from '../../lib/content/gym';

/** Public listing of gym problems and drills. Tests, solutions and explanations are not included. */
export const GET: APIRoute = async () => {
  const problems = (await visibleProblems()).map((p) => ({
    id: p.data.id,
    title: p.data.title,
    pattern: p.data.pattern,
    difficulty: p.data.difficulty,
    timeLimitMin: p.data.timeLimitMin,
    competencies: p.data.competencies,
  }));
  const drills = (await visibleDrills()).map((d) => ({
    id: d.data.id,
    kind: d.data.kind,
    title: d.data.title,
    timeLimitMin: d.data.timeLimitMin,
  }));
  return new Response(JSON.stringify({ problems, drills }), {
    headers: { 'Content-Type': 'application/json' },
  });
};
