import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  formatCacheAge,
  getCachedFollowings,
  mergeCacheWithFreshScan,
  setCachedFollowings,
  validateAndParseCacheData,
} from '../src/storage';
import type { CacheData, UserNode } from '../src/types';

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

const cache = (users: UserNode[]): CacheData => ({ timestamp: 0, users });

describe('mergeCacheWithFreshScan', () => {
  it('marks nobody as new on the first scan', () => {
    const merged = mergeCacheWithFreshScan([user('1'), user('2', { followsViewer: true })], null);
    expect(merged.map((u) => u.isNew)).toEqual([false, undefined]);
  });

  it('flags accounts that followed you before but not anymore', () => {
    const merged = mergeCacheWithFreshScan([user('1')], cache([user('1', { followsViewer: true })]));
    expect(merged[0].isNew).toBe(true);
  });

  it('does not flag accounts that already did not follow you', () => {
    const merged = mergeCacheWithFreshScan([user('1', { isNew: true })], cache([user('1')]));
    expect(merged[0].isNew).toBe(false);
  });

  it('does not flag accounts you started following since the last scan', () => {
    const merged = mergeCacheWithFreshScan([user('2')], cache([user('1', { followsViewer: true })]));
    expect(merged[0].isNew).toBe(false);
  });

  it('flags a previous fan you now follow who stopped following you', () => {
    const previousFan = user('1', { followsViewer: true, isFan: true });
    const merged = mergeCacheWithFreshScan([user('1')], cache([previousFan]));
    expect(merged[0].isNew).toBe(true);
  });

  it('leaves followers and fans untouched', () => {
    const follower = user('1', { followsViewer: true });
    const fan = user('2', { followsViewer: true, isFan: true });
    expect(mergeCacheWithFreshScan([follower, fan], cache([]))).toEqual([follower, fan]);
  });
});

describe('validateAndParseCacheData', () => {
  const valid = (users: unknown[]) => JSON.stringify({ timestamp: 123, users });

  it('accepts a valid export and normalizes optional fields', () => {
    const result = validateAndParseCacheData(valid([{ id: '42', username: 'jane.doe_1', isFan: true }]));
    expect(result.error).toBeUndefined();
    expect(result.data).toEqual({
      timestamp: 123,
      users: [
        {
          id: '42',
          username: 'jane.doe_1',
          fullName: '',
          profilePicUrl: '',
          isPrivate: false,
          isVerified: false,
          followsViewer: false,
          isNew: false,
          isFan: true,
        },
      ],
    });
  });

  it.each([
    ['invalid JSON', '{not json'],
    ['an array', '[]'],
    ['a missing timestamp', JSON.stringify({ users: [] })],
    ['a non-array users field', JSON.stringify({ timestamp: 1, users: {} })],
    ['a user without id', valid([{ username: 'jane' }])],
  ])('rejects %s', (_label, input) => {
    expect(validateAndParseCacheData(input).error).toBeDefined();
  });

  it('rejects non-numeric IDs and invalid usernames that could inject markup', () => {
    expect(validateAndParseCacheData(valid([{ id: '1" onerror="x', username: 'jane' }])).error).toBeDefined();
    expect(validateAndParseCacheData(valid([{ id: '1', username: '<img src=x>' }])).error).toBeDefined();
  });

  it('drops avatar URLs that are not https', () => {
    for (const url of ['javascript:alert(1)', 'http://example.com/a.jpg', 'data:image/png;base64,AAAA']) {
      const result = validateAndParseCacheData(valid([{ id: '1', username: 'jane', profilePicUrl: url }]));
      expect(result.data?.users[0].profilePicUrl).toBe('');
    }
  });

  it('keeps https avatar URLs', () => {
    const url = 'https://scontent.cdninstagram.com/a.jpg';
    const result = validateAndParseCacheData(valid([{ id: '1', username: 'jane', profilePicUrl: url }]));
    expect(result.data?.users[0].profilePicUrl).toBe(url);
  });
});

describe('formatCacheAge', () => {
  const now = new Date('2026-01-01T12:00:00Z').getTime();

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(now);
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it.each([
    [0, 'just now'],
    [-5000, 'just now'],
    [1000, '1 second ago'],
    [60_000, '1 min ago'],
    [2 * 3600_000, '2 hours ago'],
    [86_400_000 + 3600_000, '1 day and 1 hour ago'],
    [2 * 86_400_000 + 3 * 3600_000 + 5 * 60_000, '2 days, 3 hours and 5 mins ago'],
  ])('formats an age of %i ms as "%s"', (ageMs, expected) => {
    expect(formatCacheAge(now - ageMs)).toBe(expected);
  });
});

describe('setCachedFollowings / getCachedFollowings', () => {
  // Minimal in-memory localStorage with an optional size quota
  const stubStorage = (quota = Number.POSITIVE_INFINITY) => {
    const store = new Map<string, string>();
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => {
        if (value.length > quota) throw new DOMException('Quota exceeded', 'QuotaExceededError');
        store.set(key, value);
      },
    });
    return store;
  };

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('round-trips the cache per user', () => {
    stubStorage();
    const users = [user('1', { profilePicUrl: 'https://cdn/a.jpg' })];
    setCachedFollowings('me', users, 999);
    expect(getCachedFollowings('me')).toEqual({ timestamp: 999, users });
    expect(getCachedFollowings('someone-else')).toBeNull();
  });

  it('retries without avatar URLs when the quota is exceeded', () => {
    const users = [user('1', { profilePicUrl: `https://cdn/${'x'.repeat(500)}.jpg` })];
    stubStorage(300);
    setCachedFollowings('me', users, 1);
    expect(getCachedFollowings('me')?.users[0].profilePicUrl).toBe('');
  });

  it('gives up quietly when even the slim cache does not fit', () => {
    stubStorage(10);
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => setCachedFollowings('me', [user('1')], 1)).not.toThrow();
    expect(getCachedFollowings('me')).toBeNull();
    expect(error).toHaveBeenCalled();
  });

  it('returns null for corrupted cache data', () => {
    const store = stubStorage();
    store.set('iu_cache_me', '{broken');
    expect(getCachedFollowings('me')).toBeNull();
  });
});
