import type { SortOption, UserFilterState, UserNode } from './types';

// Return the users matching the search term and sidebar filters.
export const filterUsers = (users: UserNode[], filterState: UserFilterState, searchTerm: string): UserNode[] => {
  const term = searchTerm.toLowerCase().trim();

  return users.filter((u) => {
    // Search filter
    const matchesSearch = u.username.toLowerCase().includes(term) || u.fullName.toLowerCase().includes(term);
    if (!matchesSearch) return false;

    // Follower filter: fans have their own toggle, independent of followers/non-followers
    const matchesStatus = u.isFan
      ? filterState.showFans
      : (filterState.showNonFollowers && !u.followsViewer) || (filterState.showFollowers && u.followsViewer);
    if (!matchesStatus) return false;

    // New Unfollowers filter
    if (filterState.showNewUnfollowersOnly && !u.isNew) return false;

    // Verified and private filters hide matching accounts when unchecked
    if (u.isVerified && !filterState.showVerified) return false;
    if (u.isPrivate && !filterState.showPrivate) return false;

    return true;
  });
};

const byUsername = (a: UserNode, b: UserNode) => a.username.localeCompare(b.username);

// Put accounts with the flag first, then sort alphabetically
const flagFirst =
  (flag: (u: UserNode) => boolean | undefined) =>
  (a: UserNode, b: UserNode): number =>
    Number(Boolean(flag(b))) - Number(Boolean(flag(a))) || byUsername(a, b);

const COMPARATORS: Record<SortOption, (a: UserNode, b: UserNode) => number> = {
  'unfollowed-recent': flagFirst((u) => u.isNew),
  'name-asc': byUsername,
  'name-desc': (a, b) => byUsername(b, a),
  'private-first': flagFirst((u) => u.isPrivate),
  'verified-first': flagFirst((u) => u.isVerified),
};

// Return a sorted copy; the input array is left untouched.
export const sortUsers = (users: UserNode[], sortBy: SortOption): UserNode[] => [...users].sort(COMPARATORS[sortBy]);

export interface UserStats {
  newUnfollowers: number;
  nonFollowers: number;
  followers: number;
  fans: number;
  verified: number;
  private: number;
}

// Sidebar statistics. Fans are counted on their own; the rest describe accounts you follow.
export const countStats = (users: UserNode[]): UserStats => {
  const stats: UserStats = { newUnfollowers: 0, nonFollowers: 0, followers: 0, fans: 0, verified: 0, private: 0 };
  for (const u of users) {
    if (u.isFan) {
      stats.fans++;
      continue;
    }
    if (u.followsViewer) {
      stats.followers++;
    } else {
      stats.nonFollowers++;
      if (u.isNew) stats.newUnfollowers++;
    }
    if (u.isVerified) stats.verified++;
    if (u.isPrivate) stats.private++;
  }
  return stats;
};
