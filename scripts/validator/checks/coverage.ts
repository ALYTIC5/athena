import { basename } from 'node:path';
import { componentUses } from '../mdx';
import { error, isSampleLesson, type Content, type Issue } from '../types';

const stem = (file: string) => basename(file).replace(/\.(yaml|mdx)$/, '');

type Item = {
  id: string;
  pools: string[];
  chunk?: number;
  objective?: number;
  competencies: string[];
};

/** Counts from CONTENT_GUIDE section 5 and TEACHING section 5. */
export const FULL_MASTERY_MIN = 24;
export const SHORT_MASTERY_MIN = 16;
export const FULL_WARMUP_MIN = 10;
export const SHORT_WARMUP_MIN = 6;
export const CARDS_MIN = 8;
export const CARDS_MAX = 15;

/**
 * Rules 4 and 5: coverage and interleaving. Applies to published lessons (not the orientation lesson
 * and not sample content, which is schema-checked and graded but never published).
 */
export function checkCoverage(content: Content): Issue[] {
  const issues: Issue[] = [];
  const published = new Set<string>();
  const order: string[] = [];
  for (const w of [...content.curriculum].sort((a, b) => a.week - b.week)) {
    for (const l of w.lessons) {
      order.push(l.id);
      if (l.status === 'published') published.add(l.id);
    }
  }

  const mastery = new Map<string, Item[]>();
  const itemsByLesson = new Map<string, Item[]>();
  for (const q of content.quizzes) {
    const lesson = String(q.data['lesson']);
    const items = (q.data['items'] as Item[]) ?? [];
    itemsByLesson.set(lesson, items);
    mastery.set(
      lesson,
      items.filter((i) => i.pools.includes('mastery')),
    );
  }

  for (const page of content.lessons) {
    const id = stem(page.file);
    if (!published.has(id) || isSampleLesson(id)) continue;
    const fm = page.frontmatter;
    const anatomy = String(fm['anatomy'] ?? '');
    if (anatomy === 'orientation') continue;

    const full = anatomy === 'full';
    const duration = Number(fm['durationMin'] ?? 0);
    const items = itemsByLesson.get(id) ?? [];
    const masteryItems = mastery.get(id) ?? [];
    const objectives = (fm['objectives'] as string[] | undefined) ?? [];
    const lessonCompetencies = (fm['competencies'] as string[] | undefined) ?? [];

    // At least 2 check items per chunk (1 for lessons of two hours or less, which use fewer).
    const chunks = componentUses(page.body)
      .filter((c) => c.name === 'Chunk')
      .map((c) => Number(c.attrs['n']));
    const perChunk = duration > 120 ? 2 : 1;
    for (const n of chunks) {
      const count = items.filter((i) => i.pools.includes('check') && i.chunk === n).length;
      if (count < perChunk) {
        issues.push(
          error(
            'coverage',
            page.file,
            `Chunk ${n} has ${count} check item(s); at least ${perChunk} are required.`,
          ),
        );
      }
    }

    const min = full ? FULL_MASTERY_MIN : SHORT_MASTERY_MIN;
    if (masteryItems.length < min) {
      issues.push(
        error(
          'coverage',
          page.file,
          `${masteryItems.length} mastery questions; at least ${min} are required.`,
        ),
      );
    }
    const warmMin = full ? FULL_WARMUP_MIN : SHORT_WARMUP_MIN;
    const warm = items.filter((i) => i.pools.includes('warmup')).length;
    if (warm < warmMin) {
      issues.push(
        error(
          'coverage',
          page.file,
          `${warm} warm-up eligible items; at least ${warmMin} are required.`,
        ),
      );
    }

    objectives.forEach((_, idx) => {
      if (!masteryItems.some((i) => i.objective === idx + 1)) {
        issues.push(
          error('coverage', page.file, `Objective ${idx + 1} is not assessed by any mastery item.`),
        );
      }
    });
    for (const c of lessonCompetencies) {
      const n = masteryItems.filter((i) => i.competencies.includes(c)).length;
      if (n < 2) {
        issues.push(
          error(
            'coverage',
            page.file,
            `Competency ${c} has ${n} mastery item(s); at least 2 are required.`,
          ),
        );
      }
    }

    // Two mastery make exercises, different from the lesson's own make exercise.
    const exercises = content.exercises.filter((e) => e.data['lesson'] === id);
    const masteryMake = exercises.filter(
      (e) => (e.data['pools'] as string[]).includes('mastery') && e.data['kind'] === 'make',
    );
    const overlap = masteryMake.filter((e) => (e.data['pools'] as string[]).includes('lesson'));
    if (masteryMake.length < 2) {
      issues.push(
        error(
          'coverage',
          page.file,
          `${masteryMake.length} mastery make exercise(s); at least 2 are required.`,
        ),
      );
    }
    for (const e of overlap) {
      issues.push(
        error(
          'coverage',
          e.file,
          'A mastery make exercise must be different from the lesson make exercise.',
        ),
      );
    }

    // Cards: 8 to 15 per lesson.
    const cards = content.cards.find((c) => c.data['lesson'] === id);
    const cardCount = ((cards?.data['cards'] as unknown[]) ?? []).length;
    if (cardCount < CARDS_MIN || cardCount > CARDS_MAX) {
      issues.push(
        error(
          'coverage',
          page.file,
          `${cardCount} cards; a lesson needs ${CARDS_MIN} to ${CARDS_MAX}.`,
        ),
      );
    }

    // Interleaving: once earlier published lessons supply 8 or more mastery items, a check can draw 30%.
    const earlier = order.slice(0, order.indexOf(id)).filter((l) => published.has(l));
    const supply = earlier.reduce((s, l) => s + (mastery.get(l)?.length ?? 0), 0);
    if (supply >= 8) {
      const drawn = Math.ceil(0.3 * (full ? 8 : 6));
      if (supply < drawn) {
        issues.push(
          error(
            'interleaving',
            page.file,
            'Earlier lessons cannot supply 30% of the mastery check.',
          ),
        );
      }
    }
  }
  return issues;
}
