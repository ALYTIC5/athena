import { getCollection } from 'astro:content';
import { samplesEnabled } from './published';

/** Sample gym content only exists in end-to-end builds, like the sample lessons. */
export function gymVisible(id: string): boolean {
  return !id.startsWith('sample-') || samplesEnabled();
}

export async function visibleProblems() {
  return (await getCollection('problems')).filter((p) => gymVisible(p.data.id));
}

export async function visibleDrills() {
  return (await getCollection('drills')).filter((d) => gymVisible(d.data.id));
}
