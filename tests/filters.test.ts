import { describe, expect, it } from 'vitest';
import { filterUsers, sortUsers } from '../src/filters';
import type { UserFilterState, UserNode } from '../src/types';

const user = (username: string, overrides: Partial<UserNode> = {}): UserNode => ({
  id: String(username.length),
  username,
  fullName: '',
  profilePicUrl: '',
  isPrivate: false,
  isVerified: false,
  followsViewer: false,
  ...overrides,
});

// Matches the sidebar defaults in renderList
const defaults: UserFilterState = {
  showNonFollowers: true,
  showFollowers: false,
  showFans: false,
  showNewUnfollowersOnly: false,
  showVerified: true,
  showPrivate: true,
};

const names = (users: UserNode[]) => users.map((u) => u.username);

describe('filterUsers', () => {
  const nonFollower = user('nonfollower');
  const follower = user('follower', { followsViewer: true });
  const fan = user('fan', { followsViewer: true, isFan: true });
  const all = [nonFollower, follower, fan];

  it('shows only non-followers with the default filters', () => {
    expect(names(filterUsers(all, defaults, ''))).toEqual(['nonfollower']);
  });

  it('shows followers and fans only when their filters are on', () => {
    expect(names(filterUsers(all, { ...defaults, showFollowers: true }, ''))).toEqual(['nonfollower', 'follower']);
    expect(names(filterUsers(all, { ...defaults, showFans: true }, ''))).toEqual(['nonfollower', 'fan']);
  });

  it('never treats fans as followers', () => {
    const onlyFollowers = { ...defaults, showNonFollowers: false, showFollowers: true };
    expect(names(filterUsers(all, onlyFollowers, ''))).toEqual(['follower']);
  });

  it('limits to new unfollowers when requested', () => {
    const users = [user('old'), user('new', { isNew: true })];
    expect(names(filterUsers(users, { ...defaults, showNewUnfollowersOnly: true }, ''))).toEqual(['new']);
  });

  it('hides verified and private accounts when those filters are off', () => {
    const users = [user('plain'), user('verified', { isVerified: true }), user('private', { isPrivate: true })];
    expect(names(filterUsers(users, { ...defaults, showVerified: false }, ''))).toEqual(['plain', 'private']);
    expect(names(filterUsers(users, { ...defaults, showPrivate: false }, ''))).toEqual(['plain', 'verified']);
  });

  it('searches username and full name, case-insensitive and trimmed', () => {
    const users = [user('alice', { fullName: 'Alice Smith' }), user('bob', { fullName: 'Robert Jones' })];
    expect(names(filterUsers(users, defaults, '  ALI '))).toEqual(['alice']);
    expect(names(filterUsers(users, defaults, 'jones'))).toEqual(['bob']);
    expect(names(filterUsers(users, defaults, 'nobody'))).toEqual([]);
  });
});

describe('sortUsers', () => {
  const users = [
    user('charlie'),
    user('alice', { isPrivate: true }),
    user('bob', { isNew: true, isVerified: true }),
    user('dave', { isNew: true }),
  ];

  it('sorts by username in both directions', () => {
    expect(names(sortUsers(users, 'name-asc'))).toEqual(['alice', 'bob', 'charlie', 'dave']);
    expect(names(sortUsers(users, 'name-desc'))).toEqual(['dave', 'charlie', 'bob', 'alice']);
  });

  it('puts flagged accounts first, then sorts alphabetically', () => {
    expect(names(sortUsers(users, 'unfollowed-recent'))).toEqual(['bob', 'dave', 'alice', 'charlie']);
    expect(names(sortUsers(users, 'private-first'))).toEqual(['alice', 'bob', 'charlie', 'dave']);
    expect(names(sortUsers(users, 'verified-first'))).toEqual(['bob', 'alice', 'charlie', 'dave']);
  });

  it('does not mutate the input array', () => {
    const before = names(users);
    sortUsers(users, 'name-desc');
    expect(names(users)).toEqual(before);
  });
});
