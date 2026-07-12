import { UserNode, CacheData, UnfollowResult } from './types';

// Helper function to read cookies
export const getCookie = (name: string): string | null => {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop()!.split(';').shift()!;
  return null;
};

// Fetch all followed users via Instagram GraphQL API
export const fetchFollowings = async (
  userId: string,
  onProgress: (scanned: number, total: number) => void,
  signal?: AbortSignal
): Promise<UserNode[]> => {
  const followedUsers: UserNode[] = [];
  let hasNext = true;
  let endCursor = '';
  let totalFollowings = 0;
  let scannedCount = 0;

  while (hasNext) {
    if (signal?.aborted) {
      throw new DOMException('Scan aborted by user', 'AbortError');
    }

    const variables = JSON.stringify({
      id: userId,
      include_reel: false,
      fetch_mutual: false,
      first: 50,
      after: endCursor || undefined
    });
    const url = `https://www.instagram.com/graphql/query/?query_hash=3dec7e2c57367ef3da3d987d89f9dbc8&variables=${encodeURIComponent(variables)}`;

    const res = await fetch(url, { signal });
    if (!res.ok) {
      if (res.status === 429) {
        throw new Error('Rate limit exceeded (HTTP 429). Please wait a few minutes before scanning again.');
      }
      throw new Error(`Failed to query Instagram API (Status ${res.status})`);
    }

    const resJson = await res.json();
    if (resJson.errors && resJson.errors.length > 0) {
      throw new Error(resJson.errors[0].message || 'Instagram API Error');
    }
    if (!resJson.data?.user?.edge_follow) {
      throw new Error('Invalid API response structure. Please make sure you are logged in and try again.');
    }
    const edgeFollow = resJson.data.user.edge_follow;

    if (totalFollowings === 0) {
      totalFollowings = edgeFollow.count;
    }

    scannedCount += edgeFollow.edges.length;

    // Trigger progress update callback
    onProgress(scannedCount, totalFollowings);

    for (const edge of edgeFollow.edges) {
      const node = edge.node;
      followedUsers.push({
        id: node.id,
        username: node.username,
        fullName: node.full_name || '',
        profilePicUrl: node.profile_pic_url,
        isPrivate: node.is_private,
        isVerified: node.is_verified,
        followsViewer: node.follows_viewer
      });
    }

    hasNext = edgeFollow.page_info.has_next_page;
    endCursor = edgeFollow.page_info.end_cursor;

    // Yield thread to keep browser UI active
    await new Promise(resolve => setTimeout(resolve, 50));
  }

  // Sort alphabetically by username
  followedUsers.sort((a, b) => a.username.localeCompare(b.username));
  return followedUsers;
};

// Unfollow a specific user by ID
export const unfollowUser = async (userId: string, csrfToken: string): Promise<UnfollowResult> => {
  const response = await fetch(`https://www.instagram.com/web/friendships/${userId}/unfollow/`, {
    method: 'POST',
    headers: {
      'content-type': 'application/x-www-form-urlencoded',
      'x-csrftoken': csrfToken
    },
    mode: 'cors',
    credentials: 'include'
  });
  return { ok: response.ok, status: response.status };
};

// Get cached followings list
export const getCachedFollowings = (userId: string): CacheData | null => {
  try {
    const dataStr = localStorage.getItem(`iu_cache_${userId}`);
    if (!dataStr) return null;
    return JSON.parse(dataStr);
  } catch (e) {
    return null;
  }
};

// Save followings list to cache
export const setCachedFollowings = (userId: string, users: UserNode[]): void => {
  try {
    const data: CacheData = {
      timestamp: Date.now(),
      users
    };
    localStorage.setItem(`iu_cache_${userId}`, JSON.stringify(data));
  } catch (e) {
    console.error('Failed to save followings cache:', e);
  }
};

// Merge fresh scan results with previous cached entries to preserve unfollower metadata
export const mergeCacheWithFreshScan = (
  freshUsers: UserNode[],
  previousCache: CacheData | null
): UserNode[] => {
  const previousMap = new Map<string, UserNode>();
  if (previousCache?.users) {
    for (const u of previousCache.users) {
      previousMap.set(u.id, u);
    }
  }

  const now = Date.now();

  return freshUsers.map(u => {
    // If they follow us back, they don't have unfollower metadata
    if (u.followsViewer) {
      return u;
    }

    const prevUser = previousMap.get(u.id);

    if (previousCache) {
      if (prevUser) {
        if (prevUser.followsViewer) {
          // Confirmed new unfollower: they followed us in previous scan, but not now
          return {
            ...u,
            detectedAt: now,
            isNew: true
          };
        } else {
          // Already an unfollower: carry over their original detection timestamp
          return {
            ...u,
            detectedAt: prevUser.detectedAt || previousCache.timestamp,
            isNew: false
          };
        }
      } else {
        // New following: not in previous cache, and they don't follow us back
        return {
          ...u,
          detectedAt: now,
          isNew: false
        };
      }
    } else {
      // First scan: baseline detection
      return {
        ...u,
        detectedAt: now,
        isNew: false
      };
    }
  });
};
