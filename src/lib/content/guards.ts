import { getCollection } from 'astro:content';
import { publishedLessons } from './published';

/** A lesson component may only use content of a published lesson (planned content is never rendered). */
export async function assertPublished(lesson: string, component: string): Promise<void> {
  const published = await publishedLessons();
  if (!published.some((l) => l.id === lesson)) {
    throw new Error(
      `${component}: lesson "${lesson}" is not published, so its content cannot be rendered.`,
    );
  }
}

/** The orientation lesson has no warm-up, mastery check or cards. */
export async function assertNotOrientation(lesson: string, component: string): Promise<void> {
  const found = (await publishedLessons()).find((l) => l.id === lesson);
  if (found?.anatomy === 'orientation') {
    throw new Error(
      `${component}: the orientation lesson "${lesson}" has no warm-up or mastery check.`,
    );
  }
}

export async function assertItem(
  lesson: string,
  item: string,
  type: string,
  component: string,
): Promise<void> {
  await assertPublished(lesson, component);
  const doc = (await getCollection('quizzes')).find((q) => q.data.lesson === lesson);
  const found = doc?.data.items.find((i) => i.id === item);
  if (!found) throw new Error(`${component}: no item "${item}" in lesson "${lesson}".`);
  if (found.type !== type) {
    throw new Error(`${component}: item "${item}" is a ${found.type} item, not ${type}.`);
  }
}
