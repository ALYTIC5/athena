import { describe, expect, it } from 'vitest';
import {
  LABS,
  checklistKey,
  countChecklistItems,
  firstHeading,
  labForMilestone,
  milestoneHours,
  milestoneTitle,
  parseEvidenceUrl,
  toggleItem,
} from '../src/lib/labs/progress';

describe('parseEvidenceUrl', () => {
  it('accepts a plain https link and normalises it', () => {
    expect(parseEvidenceUrl('  https://github.com/someone/repo/commit/abc123 ')).toEqual({
      ok: true,
      url: 'https://github.com/someone/repo/commit/abc123',
    });
  });

  it.each([
    ['', /paste a link/i],
    ['not a link', /full link/i],
    ['http://example.com/x', /https/],
    ['javascript:alert(1)', /https/],
    ['https://user:secret@example.com/x', /user name or password/],
    [`https://example.com/${'a'.repeat(600)}`, /too long/],
  ])('rejects %j', (input, message) => {
    const result = parseEvidenceUrl(input);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(message);
  });
});

describe('toggleItem', () => {
  it('adds an index once and keeps the list in numeric order', () => {
    expect(toggleItem(['10', '2'], 1, true)).toEqual(['1', '2', '10']);
    expect(toggleItem(['1'], 1, true)).toEqual(['1']);
  });

  it('removes an index', () => {
    expect(toggleItem(['0', '1', '2'], 1, false)).toEqual(['0', '2']);
    expect(toggleItem([], 4, false)).toEqual([]);
  });
});

describe('markdown helpers', () => {
  const md = [
    '# wa-m2: a signed webhook endpoint (about 2.75 hours, week 12)',
    '',
    '- [ ] first',
    '- [x] second',
    '  - [ ] nested',
    '- not a task',
  ].join('\n');

  it('counts task items', () => {
    expect(countChecklistItems(md)).toBe(3);
    expect(countChecklistItems('no tasks here')).toBe(0);
  });

  it('reads the heading, title and hours', () => {
    const heading = firstHeading(md);
    expect(heading).toContain('wa-m2');
    expect(milestoneTitle(heading)).toBe('a signed webhook endpoint');
    expect(milestoneHours(heading)).toBe('2.75 hours');
    expect(milestoneHours('wa-m1: design note')).toBe('');
  });
});

describe('labs', () => {
  it('maps milestone ids to labs by prefix', () => {
    expect(labForMilestone('wa-m3')?.slug).toBe('webhook-agent');
    expect(labForMilestone('re-m1')?.slug).toBe('rag-evals');
    expect(labForMilestone('xx-m1')).toBeUndefined();
    expect(LABS).toHaveLength(2);
  });

  it('keeps checklist keys apart from lesson checklists', () => {
    expect(checklistKey('wa-m2')).toBe('lab-wa-m2');
  });
});
