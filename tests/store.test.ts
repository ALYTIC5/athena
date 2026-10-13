import { describe, expect, it } from 'vitest';
import {
  STORAGE_KEY,
  createDefault,
  exportFileName,
  importData,
  isMonday,
  load,
  mergeData,
  migrate,
  needsExportBanner,
  parseJson,
  serialise,
  subscribe,
  toLocalDate,
  update,
  type KeyValueStorage,
  type LearnerData,
} from '../src/lib/store/store';

class MemoryStorage implements KeyValueStorage {
  private map = new Map<string, string>();
  getItem(k: string) {
    return this.map.get(k) ?? null;
  }
  setItem(k: string, v: string) {
    this.map.set(k, v);
  }
  removeItem(k: string) {
    this.map.delete(k);
  }
}

const T0 = new Date('2026-10-13T10:00:00.000Z');
const iso = (s: string) => new Date(s).toISOString();

function withExercise(at: string, updatedAt: string, credit: number): LearnerData {
  const d = createDefault(T0);
  d.exercises['py-01-make'] = {
    updatedAt: iso(updatedAt),
    attempts: [
      {
        at: iso(at),
        passed: true,
        hintsUsed: 0,
        tutorUsed: false,
        solutionViewed: false,
        durationMs: 1000,
      },
    ],
    bestCredit: credit,
  };
  return d;
}

describe('isMonday', () => {
  it('accepts a Monday and rejects other days', () => {
    expect(isMonday('2026-10-12')).toBe(true);
    expect(isMonday('2026-10-13')).toBe(false);
    expect(isMonday('2026-10-11')).toBe(false);
  });
  it('rejects malformed and impossible dates', () => {
    expect(isMonday('2026-02-30')).toBe(false);
    expect(isMonday('12/10/2026')).toBe(false);
    expect(isMonday('')).toBe(false);
  });
});

describe('migrate and parse', () => {
  it('accepts a default store', () => {
    expect(migrate(createDefault(T0)).ok).toBe(true);
  });
  it('rejects non-objects, missing version and future versions', () => {
    expect(migrate(null).ok).toBe(false);
    expect(migrate([]).ok).toBe(false);
    expect(migrate({}).ok).toBe(false);
    expect(migrate({ ...createDefault(T0), version: 2 }).ok).toBe(false);
  });
  it('rejects invalid shapes and names where', () => {
    const bad = { ...createDefault(T0), settings: { nope: true } };
    const r = migrate(bad);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain('settings');
  });
  it('rejects invalid JSON text', () => {
    expect(parseJson('{not json').ok).toBe(false);
  });
});

describe('load and update', () => {
  it('reports empty, ok and corrupt', () => {
    const s = new MemoryStorage();
    expect(load(s).status).toBe('empty');
    update(s, T0, (d) => d);
    expect(load(s).status).toBe('ok');
    s.setItem(STORAGE_KEY, '{"version":1,"oops":');
    const bad = load(s);
    expect(bad.status).toBe('corrupt');
    if (bad.status === 'corrupt') expect(bad.raw).toContain('oops');
  });
  it('refuses to overwrite corrupt data', () => {
    const s = new MemoryStorage();
    s.setItem(STORAGE_KEY, 'garbage');
    expect(() => update(s, T0, (d) => d)).toThrow();
    expect(s.getItem(STORAGE_KEY)).toBe('garbage');
  });
  it('re-reads storage on each write so two tabs do not clobber each other', () => {
    const s = new MemoryStorage();
    update(s, T0, (d) => d);
    update(s, T0, (d) => {
      d.settings.jobTrack = 'Backend Python';
      return d;
    });
    update(s, T0, (d) => {
      d.settings.hoursPerWeek = 6;
      return d;
    });
    const r = load(s);
    expect(r.status === 'ok' && r.data.settings.jobTrack).toBe('Backend Python');
    expect(r.status === 'ok' && r.data.settings.hoursPerWeek).toBe(6);
  });
  it('does not save data that fails validation', () => {
    const s = new MemoryStorage();
    update(s, T0, (d) => d);
    expect(() =>
      update(s, T0, (d) => {
        d.settings.hoursPerWeek = -1;
        return d;
      }),
    ).toThrow();
  });
});

describe('export and import', () => {
  it('round-trips with replace', () => {
    const a = new MemoryStorage();
    const data = withExercise('2026-10-12T09:00:00.000Z', '2026-10-12T09:00:00.000Z', 1);
    a.setItem(STORAGE_KEY, JSON.stringify(data));
    const text = serialise((load(a) as { data: LearnerData }).data);
    const b = new MemoryStorage();
    expect(importData(b, text, 'replace').ok).toBe(true);
    expect(load(b)).toEqual({ status: 'ok', data });
  });
  it('rejects corrupt import and leaves storage untouched', () => {
    const b = new MemoryStorage();
    update(b, T0, (d) => d);
    const before = b.getItem(STORAGE_KEY);
    expect(importData(b, '{"version":1}', 'replace').ok).toBe(false);
    expect(b.getItem(STORAGE_KEY)).toBe(before);
  });
  it('names the export file by local date', () => {
    expect(exportFileName(new Date(2026, 9, 13, 23, 59))).toBe('athena-progress-2026-10-13.json');
    expect(toLocalDate(new Date(2026, 0, 5))).toBe('2026-01-05');
  });
});

describe('merge', () => {
  it('unions attempts and keeps the best credit', () => {
    const a = withExercise('2026-10-10T09:00:00.000Z', '2026-10-10T09:00:00.000Z', 0.5);
    const b = withExercise('2026-10-12T09:00:00.000Z', '2026-10-12T09:00:00.000Z', 1);
    const m = mergeData(a, b).exercises['py-01-make'];
    expect(m?.attempts).toHaveLength(2);
    expect((m?.attempts[0]?.at ?? '') < (m?.attempts[1]?.at ?? '')).toBe(true);
    expect(m?.bestCredit).toBe(1);
  });
  it('does not duplicate identical attempts', () => {
    const a = withExercise('2026-10-10T09:00:00.000Z', '2026-10-10T09:00:00.000Z', 1);
    expect(mergeData(a, a).exercises['py-01-make']?.attempts).toHaveLength(1);
  });
  it('lets the later updatedAt win for plain records', () => {
    const a = createDefault(T0);
    const b = createDefault(T0);
    a.selfRatings['py.mutability'] = { updatedAt: iso('2026-10-10T00:00:00Z'), level: 2 };
    b.selfRatings['py.mutability'] = { updatedAt: iso('2026-10-11T00:00:00Z'), level: 4 };
    expect(mergeData(a, b).selfRatings['py.mutability']?.level).toBe(4);
    expect(mergeData(b, a).selfRatings['py.mutability']?.level).toBe(4);
  });
  it('merge import combines with existing data', () => {
    const s = new MemoryStorage();
    s.setItem(
      STORAGE_KEY,
      JSON.stringify(withExercise('2026-10-10T09:00:00.000Z', '2026-10-10T09:00:00.000Z', 0.5)),
    );
    const incoming = withExercise('2026-10-12T09:00:00.000Z', '2026-10-12T09:00:00.000Z', 1);
    importData(s, serialise(incoming), 'merge');
    const r = load(s);
    expect(r.status === 'ok' && r.data.exercises['py-01-make']?.attempts).toHaveLength(2);
  });
});

describe('export banner', () => {
  it('shows after 7 days without an export and not before', () => {
    const d = createDefault(new Date('2026-10-01T00:00:00Z'));
    expect(needsExportBanner(d, new Date('2026-10-07T00:00:00Z'))).toBe(false);
    expect(needsExportBanner(d, new Date('2026-10-09T00:00:00Z'))).toBe(true);
    d.settings.lastExportAt = iso('2026-10-08T00:00:00Z');
    expect(needsExportBanner(d, new Date('2026-10-09T00:00:00Z'))).toBe(false);
  });
});

describe('subscribe', () => {
  it('fires for the athena key only and unsubscribes', () => {
    const handlers: ((e: Event) => void)[] = [];
    const target = {
      addEventListener: (_: string, h: (e: Event) => void) => void handlers.push(h),
      removeEventListener: (_: string, h: (e: Event) => void) => {
        handlers.splice(handlers.indexOf(h), 1);
      },
    };
    let calls = 0;
    const off = subscribe(target, () => calls++);
    handlers[0]?.({ key: 'other' } as unknown as Event);
    handlers[0]?.({ key: STORAGE_KEY } as unknown as Event);
    expect(calls).toBe(1);
    off();
    expect(handlers).toHaveLength(0);
  });
});
