import { describe, expect, it } from 'vitest';
import {
  consistencyStreak,
  courseComplete,
  isoWeekKey,
  jobSearchTargets,
  previousWeekKey,
  weekNumber,
} from '../src/lib/schedule/week';

describe('week number (local calendar dates)', () => {
  it('is week 1 from the start date until the next Monday, and never below 1', () => {
    expect(weekNumber('2026-10-12', '2026-10-12')).toBe(1);
    expect(weekNumber('2026-10-12', '2026-10-18')).toBe(1);
    expect(weekNumber('2026-10-12', '2026-10-19')).toBe(2);
    expect(weekNumber('2026-10-12', '2026-10-05')).toBe(1);
  });

  it('is not shifted by daylight-saving changes', () => {
    // Europe springs forward on 2026-03-29, the US on 2026-03-08.
    expect(weekNumber('2026-03-23', '2026-03-29')).toBe(1);
    expect(weekNumber('2026-03-23', '2026-03-30')).toBe(2);
    expect(weekNumber('2026-03-02', '2026-03-08')).toBe(1);
    expect(weekNumber('2026-03-02', '2026-03-09')).toBe(2);
    // Clocks go back in Europe on 2026-10-25.
    expect(weekNumber('2026-10-19', '2026-10-25')).toBe(1);
    expect(weekNumber('2026-10-19', '2026-10-26')).toBe(2);
  });

  it('runs past 28 once the course is over', () => {
    expect(weekNumber('2026-10-12', '2027-04-26')).toBe(29);
    expect(courseComplete(28)).toBe(false);
    expect(courseComplete(29)).toBe(true);
  });

  it('rejects something that is not a calendar date', () => {
    expect(() => weekNumber('2026-10-12', 'today')).toThrow();
  });
});

describe('ISO week keys', () => {
  it('names weeks like 2026-W43', () => {
    expect(isoWeekKey('2026-10-12')).toBe('2026-W42');
    expect(isoWeekKey('2026-10-18')).toBe('2026-W42');
    expect(isoWeekKey('2026-10-19')).toBe('2026-W43');
  });
  it('handles the year boundary', () => {
    expect(isoWeekKey('2024-12-30')).toBe('2025-W01');
    expect(isoWeekKey('2021-01-03')).toBe('2020-W53');
    expect(isoWeekKey('2026-12-28')).toBe('2026-W53');
    expect(isoWeekKey('2027-01-03')).toBe('2026-W53');
    expect(isoWeekKey('2027-01-04')).toBe('2027-W01');
  });
  it('steps back one week, across years too', () => {
    expect(previousWeekKey('2026-W43')).toBe('2026-W42');
    expect(previousWeekKey('2027-W01')).toBe('2026-W53');
    expect(previousWeekKey('2026-W01')).toBe('2025-W52');
  });
});

describe('consistency streak', () => {
  const log = (hours: Record<string, number>) =>
    Object.fromEntries(Object.entries(hours).map(([k, h]) => [k, { hours: h }]));

  it('counts weeks in a row that met the target, from the current week if it already counts', () => {
    const l = log({ '2026-W43': 5, '2026-W42': 5, '2026-W41': 6 });
    expect(consistencyStreak(l, 5, '2026-W43')).toBe(3);
  });
  it('does not let the week in progress break the streak', () => {
    const l = log({ '2026-W43': 1, '2026-W42': 5, '2026-W41': 5 });
    expect(consistencyStreak(l, 5, '2026-W43')).toBe(2);
  });
  it('stops at the first week that missed the target', () => {
    const l = log({ '2026-W42': 5, '2026-W41': 3, '2026-W40': 5 });
    expect(consistencyStreak(l, 5, '2026-W43')).toBe(1);
  });
  it('is zero with no log and works across a year boundary', () => {
    expect(consistencyStreak({}, 5, '2026-W43')).toBe(0);
    const l = log({ '2027-W01': 5, '2026-W53': 5, '2026-W52': 5 });
    expect(consistencyStreak(l, 5, '2027-W01')).toBe(3);
  });
});

describe('job search targets', () => {
  it('start in week 2', () => {
    expect(jobSearchTargets(1)).toBeNull();
    expect(jobSearchTargets(2)?.applications).toContain('1 to 3');
    expect(jobSearchTargets(2)?.pitches).toContain('1 or 2');
  });
});
