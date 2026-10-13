import { describe, expect, it } from 'vitest';
import { url } from '../src/lib/url';

describe('url', () => {
  it('prefixes the base and keeps a trailing slash', () => {
    expect(url('review', '/athena')).toBe('/athena/review/');
    expect(url('/gym/', '/athena/')).toBe('/athena/gym/');
  });
  it('leaves file paths alone', () => {
    expect(url('data/pool.json', '/athena')).toBe('/athena/data/pool.json');
  });
});
