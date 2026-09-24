import { describe, expect, it } from 'vitest';
import { normalizeFriendshipUser } from '../src/api';
import type { RawV1FriendshipUser } from '../src/types';

const raw = (overrides: Partial<RawV1FriendshipUser>): RawV1FriendshipUser => ({
  pk: '1',
  username: 'jane',
  full_name: 'Jane',
  profile_pic_url: 'https://cdn/a.jpg',
  is_private: false,
  is_verified: false,
  ...overrides,
});

describe('normalizeFriendshipUser', () => {
  it('keeps string IDs as they are', () => {
    expect(normalizeFriendshipUser(raw({ pk: '123' })).pk).toBe('123');
  });

  it('converts numeric IDs to strings', () => {
    expect(normalizeFriendshipUser(raw({ pk: 123 })).pk).toBe('123');
  });

  it('prefers pk_id when present', () => {
    expect(normalizeFriendshipUser(raw({ pk: 123, pk_id: '123' })).pk).toBe('123');
  });

  it('matches the same account across lists that use different ID types', () => {
    // If one list sent numbers and the other strings, every follower would look like a non-follower
    const followerIds = new Set([normalizeFriendshipUser(raw({ pk: 42 })).pk]);
    expect(followerIds.has(normalizeFriendshipUser(raw({ pk: '42' })).pk)).toBe(true);
  });

  it('keeps the other fields untouched', () => {
    const user = normalizeFriendshipUser(raw({ pk: 7, username: 'bob', is_verified: true }));
    expect(user).toMatchObject({ pk: '7', username: 'bob', is_verified: true, profile_pic_url: 'https://cdn/a.jpg' });
  });
});
