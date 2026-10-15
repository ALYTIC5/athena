import { toLocalDate } from '../store/store';

export const COURSE_WEEKS = 28;
const DAY_MS = 24 * 60 * 60 * 1000;

/** Days since the epoch for a YYYY-MM-DD calendar date, with no time zone or daylight-saving effect. */
function dayNumber(date: string): number {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!m) throw new Error(`Not a calendar date: ${date}`);
  return Math.round(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])) / DAY_MS);
}

/**
 * Week of the course (SPEC section 13): whole weeks between the start date and today, counted on
 * local calendar dates (not milliseconds, so a daylight-saving change cannot shift a week), plus 1,
 * and never below 1. The result can exceed 28 once the course is over.
 */
export function weekNumber(startDate: string, today: string): number {
  const days = dayNumber(today) - dayNumber(startDate);
  return Math.max(1, Math.floor(days / 7) + 1);
}

export function currentWeek(startDate: string, now: Date): number {
  return weekNumber(startDate, toLocalDate(now));
}

export function courseComplete(week: number): boolean {
  return week > COURSE_WEEKS;
}

/** ISO week key such as `2026-W43` for a calendar date (weeks start on Monday). */
export function isoWeekKey(date: string): string {
  const n = dayNumber(date);
  // Thursday of this ISO week decides which year the week belongs to.
  const weekday = (((n + 3) % 7) + 7) % 7; // 0 = Monday
  const thursday = n - weekday + 3;
  const year = new Date(thursday * DAY_MS).getUTCFullYear();
  const jan1 = Math.round(Date.UTC(year, 0, 1) / DAY_MS);
  const week = Math.floor((thursday - jan1) / 7) + 1;
  return `${year}-W${String(week).padStart(2, '0')}`;
}

/** The ISO week key one week before the given key. */
export function previousWeekKey(key: string): string {
  const m = /^(\d{4})-W(\d{2})$/.exec(key);
  if (!m) throw new Error(`Not a week key: ${key}`);
  // Any date in the week works: find the Monday of week 1, then step.
  const year = Number(m[1]);
  const jan4 = Math.round(Date.UTC(year, 0, 4) / DAY_MS);
  const mondayOfWeek1 = jan4 - ((((jan4 + 3) % 7) + 7) % 7);
  const monday = mondayOfWeek1 + (Number(m[2]) - 1) * 7;
  const prev = monday - 7;
  const d = new Date(prev * DAY_MS);
  return isoWeekKey(
    `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`,
  );
}

export interface WeeklyLogEntry {
  hours: number;
}

/**
 * Consistency streak: weeks in a row that met the hours target. It counts back from the current
 * week if that week already meets the target, otherwise from last week (the current week is still
 * in progress and does not break the streak).
 */
export function consistencyStreak(
  log: Record<string, WeeklyLogEntry>,
  targetHours: number,
  currentKey: string,
): number {
  const met = (key: string) => (log[key]?.hours ?? 0) >= targetHours;
  let key = met(currentKey) ? currentKey : previousWeekKey(currentKey);
  let streak = 0;
  while (met(key)) {
    streak += 1;
    key = previousWeekKey(key);
  }
  return streak;
}

/** Job-search targets for a week: from week 2, 1 to 3 applications and 1 or 2 freelance pitches. */
export function jobSearchTargets(week: number): { applications: string; pitches: string } | null {
  if (week < 2) return null;
  return { applications: '1 to 3 tailored applications', pitches: '1 or 2 freelance pitches' };
}
