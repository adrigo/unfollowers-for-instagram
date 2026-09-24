import { describe, expect, it } from 'vitest';
import { estimatePhaseShare, expectedTotalsFromCache, overallProgressPercent } from '../src/progress';
import type { UserNode } from '../src/types';

const user = (id: string, overrides: Partial<UserNode> = {}): UserNode => ({
  id,
  username: `user${id}`,
  fullName: '',
  profilePicUrl: '',
  isPrivate: false,
  isVerified: false,
  followsViewer: false,
  ...overrides,
});

describe('expectedTotalsFromCache', () => {
  it('knows nothing without a previous scan', () => {
    expect(expectedTotalsFromCache(null)).toEqual({});
    expect(expectedTotalsFromCache({ timestamp: 0, users: [] })).toEqual({});
  });

  it('counts following (non-fans) and followers (mutuals + fans)', () => {
    const users = [
      user('1'),
      user('2', { followsViewer: true }),
      user('3', { followsViewer: true, isFan: true }),
      user('4', { followsViewer: true, isFan: true }),
    ];
    expect(expectedTotalsFromCache({ timestamp: 0, users })).toEqual({ following: 2, followers: 3 });
  });

  it('leaves followers unknown for caches saved before fans existed', () => {
    const users = [user('1'), user('2', { followsViewer: true })];
    expect(expectedTotalsFromCache({ timestamp: 0, users })).toEqual({ following: 2, followers: undefined });
  });
});

describe('estimatePhaseShare', () => {
  it('is complete once the phase is done, whatever the count', () => {
    expect(estimatePhaseShare(10, 1000, true)).toBe(1);
    expect(estimatePhaseShare(10, undefined, true)).toBe(1);
  });

  it('is linear against the expected total', () => {
    expect(estimatePhaseShare(500, 1000, false)).toBe(0.5);
  });

  it('never looks finished before the list ends, even if it grew', () => {
    expect(estimatePhaseShare(1000, 1000, false)).toBe(0.95);
    expect(estimatePhaseShare(1500, 1000, false)).toBe(0.95);
  });

  it('follows a curve below 1 without an expected total', () => {
    expect(estimatePhaseShare(0, undefined, false)).toBe(0);
    expect(estimatePhaseShare(300, undefined, false)).toBe(0.5);
    expect(estimatePhaseShare(100_000, undefined, false)).toBeLessThan(1);
  });
});

describe('overallProgressPercent', () => {
  it('gives following the first 5% of the bar', () => {
    expect(overallProgressPercent('following', 0)).toBe(0);
    expect(overallProgressPercent('following', 1)).toBe(5);
  });

  it('gives followers the remaining 95%', () => {
    expect(overallProgressPercent('followers', 0)).toBe(5);
    expect(overallProgressPercent('followers', 0.5)).toBe(52.5);
    expect(overallProgressPercent('followers', 1)).toBe(100);
  });
});
