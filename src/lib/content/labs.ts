import { getCollection, type CollectionEntry } from 'astro:content';
import {
  LABS,
  countChecklistItems,
  firstHeading,
  labForMilestone,
  milestoneHours,
  milestoneTitle,
  type LabSlug,
} from '../labs/progress';

export interface LabMilestone {
  id: string;
  lab: LabSlug;
  title: string;
  hours: string;
  weeks: number[];
  checks: number;
  entry: CollectionEntry<'labs'>;
}

/** Every milestone page, in lab order then milestone order, with the weeks that schedule it. */
export async function labMilestones(): Promise<LabMilestone[]> {
  const weeks = await getCollection('curriculum');
  const entries = await getCollection('labs');
  const out: LabMilestone[] = [];
  for (const lab of LABS) {
    const own = entries
      .filter((e) => e.id.startsWith(`${lab.slug}/milestones/`))
      .sort((a, b) => a.id.localeCompare(b.id, 'en', { numeric: true }));
    for (const entry of own) {
      const id = entry.id.slice(entry.id.lastIndexOf('/') + 1);
      if (labForMilestone(id)?.slug !== lab.slug) throw new Error(`${entry.id}: wrong lab prefix`);
      const heading = firstHeading(entry.body ?? '');
      out.push({
        id,
        lab: lab.slug,
        title: milestoneTitle(heading),
        hours: milestoneHours(heading),
        weeks: weeks
          .filter((w) => w.data.lab.some((l) => l.milestone === id))
          .map((w) => w.data.week)
          .sort((a, b) => a - b),
        checks: countChecklistItems(entry.body ?? ''),
        entry,
      });
    }
  }
  return out;
}

/** A lab's CONTRACT.md or README.md entry. */
export async function labDocument(
  lab: LabSlug,
  name: 'contract' | 'readme',
): Promise<CollectionEntry<'labs'>> {
  const entry = (await getCollection('labs')).find((e) => e.id === `${lab}/${name}`);
  if (!entry) throw new Error(`labs/${lab}: ${name.toUpperCase()}.md not found`);
  return entry;
}

export function hasLabPage(milestone: string, all: readonly { id: string }[]): boolean {
  return all.some((m) => m.id === milestone);
}
