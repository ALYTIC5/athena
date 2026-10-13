import { toLocalDate, type LearnerData } from '../store/store';
import { isDue, newSchedule, type CardSchedule } from './fsrs';

export type CardType = 'basic' | 'cloze' | 'predict' | 'explain';

/** A card as authored in `src/content/cards/<lesson>.yaml`, with its lesson attached. */
export interface ContentCard {
  id: string;
  lesson: string;
  type: CardType;
  competencies: string[];
  front: string;
  back: string;
  /** Predict cards: ground truth produced at build time. */
  expected?: string;
}

export interface QueueItem extends ContentCard {
  isNew: boolean;
  schedule: CardSchedule;
  custom: boolean;
}

export const CUSTOM_LESSON = 'custom';

/** Content cards of a lesson are added to the queue once the lesson is mastered. */
export function unlockedLessons(data: LearnerData): Set<string> {
  const out = new Set<string>();
  for (const [id, rec] of Object.entries(data.lessons)) {
    if (rec.status === 'mastered' || rec.status === 'needs-review') out.add(id);
  }
  return out;
}

/** Learner-made cards (for example gaps from a mock interview) can be added at any time. */
export function customCards(data: LearnerData): ContentCard[] {
  return Object.entries(data.cards).flatMap(([id, rec]) =>
    rec.custom
      ? [
          {
            id,
            lesson: CUSTOM_LESSON,
            type: 'explain' as const,
            competencies: rec.custom.competencies,
            front: rec.custom.front,
            back: rec.custom.back,
          },
        ]
      : [],
  );
}

export interface DayCounts {
  reviews: number;
  newCards: number;
}

/** Reviews and new cards already done on the local calendar day of `now`. */
export function doneToday(data: LearnerData, now: Date): DayCounts {
  const today = toLocalDate(now);
  const firstSeen = new Map<string, string>();
  for (const entry of data.reviewLog) {
    const prev = firstSeen.get(entry.cardId);
    if (prev === undefined || entry.at < prev) firstSeen.set(entry.cardId, entry.at);
  }
  let reviews = 0;
  let newCards = 0;
  for (const entry of data.reviewLog) {
    if (toLocalDate(new Date(entry.at)) !== today) continue;
    if (firstSeen.get(entry.cardId) === entry.at) newCards += 1;
    else reviews += 1;
  }
  return { reviews, newCards };
}

function stateOf(card: ContentCard, data: LearnerData, now: Date) {
  const rec = data.cards[card.id];
  if (!rec) return { schedule: newSchedule(now), isNew: true };
  return { schedule: rec.state as CardSchedule, isNew: rec.state.state === 'new' };
}

/** Round-robin across lessons so topics are interleaved; order inside a lesson is by due time. */
export function interleave<T extends { lesson: string }>(items: T[]): T[] {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const g = groups.get(item.lesson) ?? [];
    g.push(item);
    groups.set(item.lesson, g);
  }
  const lists = [...groups.values()];
  const out: T[] = [];
  for (let i = 0; out.length < items.length; i++) {
    for (const list of lists) {
      const next = list[i];
      if (next !== undefined) out.push(next);
    }
  }
  return out;
}

export interface BuiltQueue {
  /** Today's session: due cards then new cards, interleaved, within the daily caps. */
  queue: QueueItem[];
  /** Number shown in the header and on Home. */
  dueCount: number;
  dueTotal: number;
  newAvailable: number;
  done: DayCounts;
}

export function buildQueue(args: {
  content: ContentCard[];
  data: LearnerData;
  now: Date;
}): BuiltQueue {
  const { data, now } = args;
  const unlocked = unlockedLessons(data);
  const cards = [...args.content.filter((c) => unlocked.has(c.lesson)), ...customCards(data)];
  const caps = data.settings.reviewCaps;
  const done = doneToday(data, now);

  const due: QueueItem[] = [];
  const fresh: QueueItem[] = [];
  for (const card of cards) {
    const { schedule, isNew } = stateOf(card, data, now);
    const item: QueueItem = { ...card, isNew, schedule, custom: card.lesson === CUSTOM_LESSON };
    if (isNew) fresh.push(item);
    else if (isDue(schedule, now)) due.push(item);
  }
  due.sort((a, b) => a.schedule.due.localeCompare(b.schedule.due));

  const reviewRoom = Math.max(0, caps.reviews - done.reviews);
  const newRoom = Math.max(0, caps.newCards - done.newCards);
  const queue = interleave([...due.slice(0, reviewRoom)]).concat(
    interleave(fresh.slice(0, newRoom)),
  );

  return {
    queue,
    dueCount: queue.length,
    dueTotal: due.length,
    newAvailable: fresh.length,
    done,
  };
}
