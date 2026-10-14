import type { APIRoute, GetStaticPaths } from 'astro';
import { visibleProblems } from '../../../lib/content/gym';

/** Hidden tests, reference solutions and the pattern: fetched only when the learner checks or finishes. */
export const getStaticPaths = (async () => {
  const problems = await visibleProblems();
  return problems.map((p) => ({
    params: { id: p.data.id },
    props: {
      data: {
        pattern: p.data.pattern,
        hiddenTests: p.data.hiddenTests,
        referenceSolutions: p.data.referenceSolutions,
        patternExplanation: p.data.patternExplanation,
        commonMistakes: p.data.commonMistakes,
        followUps: p.data.followUps,
      },
    },
  }));
}) satisfies GetStaticPaths;

export const GET: APIRoute = ({ props }) =>
  new Response(JSON.stringify(props.data), { headers: { 'Content-Type': 'application/json' } });
