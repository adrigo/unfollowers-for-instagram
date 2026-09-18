import { UserNode, UnfollowResult, ScanProgressCallback, V1FriendshipUser, V1FriendshipsResponse } from './types';

// Instagram web app ID — static client ID used by instagram.com's own frontend.
const INSTAGRAM_WEB_APP_ID = '936619743392459';

// Helper function to read cookies robustly
export const getCookie = (name: string): string | null => {
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match && match[1] ? decodeURIComponent(match[1]) : null;
};

// Robust CSRF token extraction from cookies or window globals
export const getCsrfToken = (): string => {
  const cookieToken = getCookie('csrftoken');
  if (cookieToken) return cookieToken;
  try {
    const win = window as any;
    if (win._sharedData?.config?.csrf_token) return win._sharedData.config.csrf_token;
    if (win.__initialData?.pending?.db?.config?.csrf_token) return win.__initialData.pending.db.config.csrf_token;
  } catch {
    // Ignore window access errors if restricted
  }
  return '';
};

// Helper to safely parse JSON responses and provide clear error messages for HTML/non-JSON
const parseJsonResponse = async <T>(res: Response, endpointName: string): Promise<T> => {
  const text = await res.text();
  if (!text || text.trim().length === 0) {
    throw new Error(`Empty response received from Instagram (${endpointName}).`);
  }
  try {
    return JSON.parse(text) as T;
  } catch {
    if (text.includes('<html') || text.includes('<!DOCTYPE') || text.includes('<body')) {
      throw new Error(`Instagram returned an HTML page (login/redirect) instead of data for ${endpointName}. Please make sure you are logged in on instagram.com.`);
    }
    throw new Error(`Unexpected non-JSON response received from Instagram (${endpointName}).`);
  }
};

// Fetch counts (following_count and follower_count) from the user info endpoint for accurate progress
const fetchUserCounts = async (
  userId: string,
  signal?: AbortSignal
): Promise<{ followingCount: number; followerCount: number }> => {
  try {
    const res = await fetch(`https://www.instagram.com/api/v1/users/${userId}/info/`, {
      signal,
      headers: {
        'x-ig-app-id': INSTAGRAM_WEB_APP_ID,
        'x-requested-with': 'XMLHttpRequest',
      },
      credentials: 'include',
    });
    if (!res.ok) return { followingCount: 0, followerCount: 0 };
    const data = await parseJsonResponse<any>(res, 'user info');
    return {
      followingCount: data?.user?.following_count ?? 0,
      followerCount: data?.user?.follower_count ?? 0,
    };
  } catch {
    return { followingCount: 0, followerCount: 0 };
  }
};

// Fetch a single page from Instagram private friendships REST API v1 (following or followers)
const fetchFriendshipsPage = async (
  userId: string,
  type: 'following' | 'followers',
  maxId: string,
  signal?: AbortSignal
): Promise<V1FriendshipsResponse> => {
  const params = new URLSearchParams({ count: '50' });
  if (maxId) params.set('max_id', maxId);

  const url = `https://www.instagram.com/api/v1/friendships/${userId}/${type}/?${params}`;
  const res = await fetch(url, {
    signal,
    headers: {
      'x-ig-app-id': INSTAGRAM_WEB_APP_ID,
      'x-requested-with': 'XMLHttpRequest',
      'x-asbd-id': '198387',
    },
    credentials: 'include',
  });

  if (!res.ok) {
    if (res.status === 429) {
      throw new Error('Rate limit exceeded (HTTP 429). Please wait a few minutes before scanning again.');
    }
    throw new Error(`Failed to query Instagram API (Status ${res.status}). Make sure you are logged in.`);
  }

  const data = await parseJsonResponse<V1FriendshipsResponse>(res, `${type} list page`);
  if (data.status !== 'ok') {
    throw new Error('Invalid API response. Please make sure you are logged in and try again.');
  }
  return data;
};

// Walk all pages of following or followers list and return deduplicated users.
const fetchAllFriendships = async (
  userId: string,
  type: 'following' | 'followers',
  onPageFetched: (fetched: number) => void,
  signal?: AbortSignal
): Promise<V1FriendshipUser[]> => {
  const seen = new Map<string, V1FriendshipUser>();
  let maxId = '';

  for (let page = 0; page < 400; page++) {
    if (signal?.aborted) {
      throw new DOMException('Scan aborted by user', 'AbortError');
    }

    const data = await fetchFriendshipsPage(userId, type, maxId, signal);
    for (const user of data.users) {
      seen.set(user.pk, user);
    }
    onPageFetched(seen.size);

    if (!data.next_max_id) break;
    maxId = data.next_max_id;

    // Randomized delay between 300ms and 600ms
    const delay = 300 + Math.random() * 300;
    await new Promise(resolve => setTimeout(resolve, delay));
  }

  return Array.from(seen.values());
};

// Fetch all followed users via Instagram private REST API v1.
export const fetchFollowings = async (
  userId: string,
  onProgress: ScanProgressCallback,
  signal?: AbortSignal
): Promise<UserNode[]> => {
  // Step 0 — get following and follower counts upfront for accurate progress percentage calculation
  const { followingCount, followerCount } = await fetchUserCounts(userId, signal);

  // Phase 1 — fetch the list of accounts this user follows
  const rawFollowing = await fetchAllFriendships(
    userId,
    'following',
    (count) => onProgress(count, followingCount, 'following'),
    signal
  );

  // Phase 2 — fetch the list of accounts that follow this user
  const rawFollowers = await fetchAllFriendships(
    userId,
    'followers',
    (count) => onProgress(count, followerCount, 'followers'),
    signal
  );

  const followerIds = new Set(rawFollowers.map(u => u.pk));

  // Map to internal UserNode shape (deduplicated)
  const followedUsers: UserNode[] = rawFollowing.map(u => ({
    id: u.pk,
    username: u.username,
    fullName: u.full_name || '',
    profilePicUrl: u.profile_pic_url,
    isPrivate: Boolean(u.is_private),
    isVerified: Boolean(u.is_verified),
    followsViewer: followerIds.has(u.pk),
  }));

  followedUsers.sort((a, b) => a.username.localeCompare(b.username));
  return followedUsers;
};

// Unfollow a specific user by ID
export const unfollowUser = async (userId: string, csrfToken: string): Promise<UnfollowResult> => {
  const token = csrfToken || getCsrfToken();
  const response = await fetch(`https://www.instagram.com/web/friendships/${userId}/unfollow/`, {
    method: 'POST',
    headers: {
      'content-type': 'application/x-www-form-urlencoded',
      'x-csrftoken': token,
      'x-ig-app-id': INSTAGRAM_WEB_APP_ID,
      'x-requested-with': 'XMLHttpRequest',
      'x-asbd-id': '198387',
      'x-instagram-ajax': '1',
    },
    mode: 'cors',
    credentials: 'include',
  });
  return { ok: response.ok, status: response.status };
};
