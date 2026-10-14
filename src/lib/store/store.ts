import * as z from 'zod/mini';
import { STORAGE_KEY, STORE_VERSION, learnerDataSchema, type LearnerData } from './schema';

export type { LearnerData };
export { STORAGE_KEY, STORE_VERSION };

export type ParseResult = { ok: true; data: LearnerData } | { ok: false; error: string };

export const EXPORT_BANNER_DAYS = 7;

/** Migrations keyed by the version they upgrade from. Add one entry per schema change. */
const migrations: Record<number, (raw: Record<string, unknown>) => Record<string, unknown>> = {};

export function createDefault(now: Date): LearnerData {
  const t = now.toISOString();
  return {
    version: STORE_VERSION,
    settings: {
      updatedAt: t,
      hoursPerWeek: 5,
      jobTrack: 'AI automation',
      createdAt: t,
      reviewCaps: { reviews: 30, newCards: 10 },
      shortcutsEnabled: true,
    },
    lessons: {},
    exercises: {},
    answers: {},
    cards: {},
    reviewLog: [],
    gym: {},
    drills: {},
    sessions: [],
    stories: [],
    checklists: {},
    rubrics: {},
    labs: {},
    weeklyLog: {},
    selfRatings: {},
  };
}

export function migrate(raw: unknown): ParseResult {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    return { ok: false, error: 'Data is not an object.' };
  }
  let obj = raw as Record<string, unknown>;
  let version = obj.version;
  if (typeof version !== 'number' || !Number.isInteger(version) || version < 1) {
    return { ok: false, error: 'Data has no valid version.' };
  }
  if (version > STORE_VERSION) {
    return { ok: false, error: `Data is from a newer version of Athena (${version}).` };
  }
  while (version < STORE_VERSION) {
    const step = migrations[version];
    if (!step) return { ok: false, error: `No migration from version ${version}.` };
    obj = step(obj);
    version += 1;
    obj.version = version;
  }
  const parsed = z.safeParse(learnerDataSchema, obj);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    const where = first ? first.path.join('.') || '(root)' : '(unknown)';
    return { ok: false, error: `Data failed validation at ${where}.` };
  }
  return { ok: true, data: parsed.data };
}

export function parseJson(text: string): ParseResult {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, error: 'Data is not valid JSON.' };
  }
  return migrate(raw);
}

/** Local calendar date as YYYY-MM-DD (never UTC). */
export function toLocalDate(d: Date): string {
  const y = String(d.getFullYear()).padStart(4, '0');
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function isMonday(date: string): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!m) return false;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const dt = new Date(Date.UTC(y, mo - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) {
    return false;
  }
  return dt.getUTCDay() === 1;
}

export function exportFileName(now: Date): string {
  return `athena-progress-${toLocalDate(now)}.json`;
}

export function needsExportBanner(data: LearnerData, now: Date): boolean {
  const since = data.settings.lastExportAt ?? data.settings.createdAt;
  const ms = now.getTime() - new Date(since).getTime();
  return ms > EXPORT_BANNER_DAYS * 24 * 60 * 60 * 1000;
}

type Stamped = { updatedAt: string };

function laterWins<T extends Stamped>(a: T, b: T): T {
  return b.updatedAt > a.updatedAt ? b : a;
}

function mergeRecords<T extends Stamped>(
  a: Record<string, T>,
  b: Record<string, T>,
  combine: (x: T, y: T) => T = laterWins,
): Record<string, T> {
  const out: Record<string, T> = { ...a };
  for (const [k, v] of Object.entries(b)) {
    const existing = out[k];
    out[k] = existing === undefined ? v : combine(existing, v);
  }
  return out;
}

function unionBy<T>(a: T[], b: T[], key: (x: T) => string, order: (x: T) => string): T[] {
  const seen = new Map<string, T>();
  for (const x of [...a, ...b]) if (!seen.has(key(x))) seen.set(key(x), x);
  return [...seen.values()].sort((x, y) => order(x).localeCompare(order(y)));
}

function withAttempts<T extends Stamped & { attempts: { at: string }[] }>(x: T, y: T): T {
  const winner = laterWins(x, y);
  return {
    ...winner,
    attempts: unionBy(
      x.attempts,
      y.attempts,
      (at) => JSON.stringify(at),
      (at) => at.at,
    ),
    updatedAt: winner.updatedAt,
  };
}

/** Merge rules from SPEC §12: union of attempt lists, later `updatedAt` wins elsewhere. */
export function mergeData(local: LearnerData, incoming: LearnerData): LearnerData {
  const lessons = mergeRecords(local.lessons, incoming.lessons, (x, y) => {
    const winner = laterWins(x, y);
    return {
      ...winner,
      masteryAttempts: unionBy(
        x.masteryAttempts,
        y.masteryAttempts,
        (m) => JSON.stringify(m),
        (m) => m.at,
      ),
    };
  });
  const exercises = mergeRecords(local.exercises, incoming.exercises, (x, y) => ({
    ...withAttempts(x, y),
    bestCredit: Math.max(x.bestCredit, y.bestCredit),
  }));
  const settings = laterWins(local.settings, incoming.settings);
  return {
    version: STORE_VERSION,
    settings: {
      ...settings,
      createdAt:
        local.settings.createdAt < incoming.settings.createdAt
          ? local.settings.createdAt
          : incoming.settings.createdAt,
    },
    lessons,
    exercises,
    answers: mergeRecords(local.answers, incoming.answers, withAttempts),
    cards: mergeRecords(local.cards, incoming.cards),
    reviewLog: unionBy(
      local.reviewLog,
      incoming.reviewLog,
      (r) => `${r.cardId}|${r.at}`,
      (r) => r.at,
    ),
    gym: mergeRecords(local.gym, incoming.gym, (x, y) => ({
      ...withAttempts(x, y),
      reattempt: laterWins(x, y).reattempt,
    })),
    drills: mergeRecords(local.drills, incoming.drills, withAttempts),
    sessions: unionBy(
      local.sessions,
      incoming.sessions,
      (s) => s.id,
      (s) => s.at,
    ),
    stories: Object.values(
      mergeRecords(
        Object.fromEntries(local.stories.map((s) => [s.id, s])),
        Object.fromEntries(incoming.stories.map((s) => [s.id, s])),
      ),
    ),
    checklists: mergeRecords(local.checklists, incoming.checklists),
    rubrics: mergeRecords(local.rubrics, incoming.rubrics),
    labs: mergeRecords(local.labs, incoming.labs),
    weeklyLog: mergeRecords(local.weeklyLog, incoming.weeklyLog),
    selfRatings: mergeRecords(local.selfRatings, incoming.selfRatings),
  };
}

/** Same-tab change signal: the `storage` event only fires in other tabs. */
export const STORE_CHANGED_EVENT = 'athena-store-changed';

function notifyChanged(): void {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(STORE_CHANGED_EVENT));
}

/** The minimal slice of the Web Storage API the store needs. */
export type KeyValueStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

export type LoadResult =
  | { status: 'ok'; data: LearnerData }
  | { status: 'empty' }
  | { status: 'corrupt'; raw: string; error: string };

export function load(storage: KeyValueStorage): LoadResult {
  const raw = storage.getItem(STORAGE_KEY);
  if (raw === null) return { status: 'empty' };
  const parsed = parseJson(raw);
  return parsed.ok
    ? { status: 'ok', data: parsed.data }
    : { status: 'corrupt', raw, error: parsed.error };
}

/** Read-modify-write against the current stored value, so another tab's changes are not lost. */
export function update(
  storage: KeyValueStorage,
  now: Date,
  change: (data: LearnerData) => LearnerData,
): LearnerData {
  const current = load(storage);
  if (current.status === 'corrupt') {
    throw new Error('Stored data is corrupt; recover or reset it before saving.');
  }
  const base = current.status === 'ok' ? current.data : createDefault(now);
  const next = change(structuredClone(base));
  const checked = migrate(next);
  if (!checked.ok) throw new Error(checked.error);
  storage.setItem(STORAGE_KEY, JSON.stringify(checked.data));
  notifyChanged();
  return checked.data;
}

export function serialise(data: LearnerData): string {
  return JSON.stringify(data, null, 2);
}

export type ImportMode = 'replace' | 'merge';

export function importData(storage: KeyValueStorage, text: string, mode: ImportMode): ParseResult {
  const parsed = parseJson(text);
  if (!parsed.ok) return parsed;
  const current = load(storage);
  const merged =
    mode === 'merge' && current.status === 'ok'
      ? mergeData(current.data, parsed.data)
      : parsed.data;
  storage.setItem(STORAGE_KEY, JSON.stringify(merged));
  notifyChanged();
  return { ok: true, data: merged };
}

export function reset(storage: KeyValueStorage): void {
  storage.removeItem(STORAGE_KEY);
  notifyChanged();
}

/** Calls `onChange` when another tab writes the store. Returns an unsubscribe function. */
export function subscribe(
  target: Pick<Window, 'addEventListener' | 'removeEventListener'>,
  onChange: () => void,
): () => void {
  const handler = (e: Event) => {
    if (e.type === STORE_CHANGED_EVENT) return onChange();
    const key = (e as StorageEvent).key;
    if (key === null || key === STORAGE_KEY) onChange();
  };
  target.addEventListener('storage', handler);
  target.addEventListener(STORE_CHANGED_EVENT, handler);
  return () => {
    target.removeEventListener('storage', handler);
    target.removeEventListener(STORE_CHANGED_EVENT, handler);
  };
}
