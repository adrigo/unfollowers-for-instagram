import { nextPageWait } from './pacing';
import type {
  RawV1FriendshipUser,
  ScanBreakCallback,
  ScanProgressCallback,
  ScanResult,
  ScanRetryCallback,
  UnfollowResult,
  UserNode,
  V1FriendshipsResponse,
  V1FriendshipUser,
} from './types';

// Instagram web app ID — static client ID used by instagram.com's own frontend.
const INSTAGRAM_WEB_APP_ID = '936619743392459';

// Backoff schedule used when Instagram rate limits us or the network drops mid-scan.
const RETRY_DELAYS_MS = [30_000, 60_000, 120_000];

// Accounts per followers page. Instagram caps these pages at ~25 whatever count is
// requested, and may return a few less (deactivated or restricted accounts are dropped).
const FOLLOWERS_PAGE_SIZE = 25;

// Safety net against a pagination cursor that never ends (125k accounts).
const MAX_PAGES = 5000;

// Errors worth retrying after a pause (rate limits, server errors, network drops).
class RetryableError extends Error {}

// Instagram refused the request by redirecting it (to the home page, a login page, or a
// security check). This happens after too many scans in a short time; retrying makes it worse.
export class ScanBlockedError extends Error {
  constructor(readonly list: 'following' | 'followers') {
    super(`Instagram redirected the ${list} list request instead of returning data.`);
    this.name = 'ScanBlockedError';
  }
}

const abortError = () => new DOMException('Scan aborted by user', 'AbortError');

// setTimeout that rejects immediately when the scan is aborted
const sleep = (ms: number, signal?: AbortSignal): Promise<void> =>
  new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(abortError());
    const onAbort = () => {
      clearTimeout(timer);
      reject(abortError());
    };
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    signal?.addEventListener('abort', onAbort, { once: true });
  });

// Helper function to read cookies robustly
export const getCookie = (name: string): string | null => {
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match?.[1] ? decodeURIComponent(match[1]) : null;
};

// Robust CSRF token extraction from cookies or window globals
export const getCsrfToken = (): string => {
  const cookieToken = getCookie('csrftoken');
  if (cookieToken) return cookieToken;
  try {
    // Legacy globals Instagram has exposed the token on
    const win = window as unknown as {
      _sharedData?: { config?: { csrf_token?: string } };
      __initialData?: { pending?: { db?: { config?: { csrf_token?: string } } } };
    };
    const legacyToken = win._sharedData?.config?.csrf_token ?? win.__initialData?.pending?.db?.config?.csrf_token;
    if (legacyToken) return legacyToken;
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
      throw new Error(
        `Instagram returned an HTML page (login/redirect) instead of data for ${endpointName}. Please make sure you are logged in on instagram.com.`
      );
    }
    throw new Error(`Unexpected non-JSON response received from Instagram (${endpointName}).`);
  }
};

// Fetch a single page from Instagram private friendships REST API v1 (following or followers)
const fetchFriendshipsPage = async (
  userId: string,
  type: 'following' | 'followers',
  maxId: string,
  signal?: AbortSignal
): Promise<V1FriendshipsResponse> => {
  const params = new URLSearchParams();
  if (type === 'following') {
    // The following list is ranked by default, and that ranking can change between page
    // requests, making the offset cursor skip accounts. Follow date is a stable order.
    // With it, Instagram returns the whole list in one response, so no count is sent.
    params.set('order', 'date_followed_latest');
  } else {
    // The followers endpoint has no ordering option and is always paginated
    params.set('count', String(FOLLOWERS_PAGE_SIZE));
  }
  if (maxId) params.set('max_id', maxId);

  const url = `https://www.instagram.com/api/v1/friendships/${userId}/${type}/?${params}`;
  let res: Response;
  try {
    res = await fetch(url, {
      signal,
      headers: {
        'x-ig-app-id': INSTAGRAM_WEB_APP_ID,
        'x-requested-with': 'XMLHttpRequest',
        'x-asbd-id': '198387',
      },
      credentials: 'include',
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') throw err;
    throw new RetryableError('Network error while contacting Instagram. Check your connection and try again.');
  }

  // fetch follows redirects, so a refused request shows up as a redirected response
  if (res.redirected) {
    throw new ScanBlockedError(type);
  }

  if (!res.ok) {
    if (res.status === 429) {
      throw new RetryableError('Rate limit exceeded (HTTP 429). Please wait a few minutes before scanning again.');
    }
    if (res.status >= 500) {
      throw new RetryableError(`Instagram is having trouble right now (Status ${res.status}). Please try again later.`);
    }
    throw new Error(`Failed to query Instagram API (Status ${res.status}). Make sure you are logged in.`);
  }

  const data = await parseJsonResponse<V1FriendshipsResponse>(res, `${type} list page`);
  if (data.status !== 'ok') {
    throw new Error('Invalid API response. Please make sure you are logged in and try again.');
  }
  return data;
};

// Fetch a page, pausing and retrying on rate limits or transient failures.
const fetchFriendshipsPageWithRetry = async (
  userId: string,
  type: 'following' | 'followers',
  maxId: string,
  onRetry: ScanRetryCallback | undefined,
  signal?: AbortSignal
): Promise<V1FriendshipsResponse> => {
  for (let attempt = 0; ; attempt++) {
    try {
      return await fetchFriendshipsPage(userId, type, maxId, signal);
    } catch (err) {
      if (!(err instanceof RetryableError) || attempt >= RETRY_DELAYS_MS.length) throw err;
      const waitMs = RETRY_DELAYS_MS[attempt];
      onRetry?.(waitMs, attempt + 1, RETRY_DELAYS_MS.length, err.message);
      await sleep(waitMs, signal);
    }
  }
};

// IDs are compared as strings everywhere (Set lookups, data-id attributes, import
// validation), so normalize them as soon as they arrive, whatever type Instagram sends.
export const normalizeFriendshipUser = (raw: RawV1FriendshipUser): V1FriendshipUser => ({
  ...raw,
  pk: String(raw.pk_id ?? raw.pk),
});

// Walk all pages of following or followers list and return deduplicated users.
// `truncated` is set only when the MAX_PAGES safety net cut the walk short.
const fetchAllFriendships = async (
  userId: string,
  type: 'following' | 'followers',
  onPageFetched: (fetched: number) => void,
  onRetry: ScanRetryCallback | undefined,
  onBreak: ScanBreakCallback | undefined,
  signal?: AbortSignal
): Promise<{ users: V1FriendshipUser[]; truncated: boolean }> => {
  const seen = new Map<string, V1FriendshipUser>();
  let maxId = '';
  let truncated = true;
  let pages = 0;

  for (let page = 0; page < MAX_PAGES; page++) {
    if (signal?.aborted) throw abortError();

    const data = await fetchFriendshipsPageWithRetry(userId, type, maxId, onRetry, signal);
    pages++;
    for (const raw of data.users) {
      const user = normalizeFriendshipUser(raw);
      seen.set(user.pk, user);
    }
    onPageFetched(seen.size);

    // No cursor, or a repeated one (Instagram repeats it on the last page), means the end
    if (!data.next_max_id || data.next_max_id === maxId) {
      truncated = false;
      break;
    }
    maxId = data.next_max_id;

    // Short randomized pause between pages, and a longer break every few pages (see pacing.ts)
    const { ms, isBreak } = nextPageWait(pages);
    if (isBreak) onBreak?.(ms);
    await sleep(ms, signal);
  }

  console.log(
    `[Unfollowers] ${type}: ${seen.size} unique accounts in ${pages} pages${truncated ? ' (stopped early)' : ''}`
  );
  return { users: Array.from(seen.values()), truncated };
};

// Fetch all followed users via Instagram private REST API v1.
export const fetchFollowings = async (
  userId: string,
  onProgress: ScanProgressCallback,
  onRetry?: ScanRetryCallback,
  onBreak?: ScanBreakCallback,
  signal?: AbortSignal
): Promise<ScanResult> => {
  // Phase 1 — fetch the list of accounts this user follows
  const { users: rawFollowing, truncated: followingTruncated } = await fetchAllFriendships(
    userId,
    'following',
    (count) => onProgress(count, 'following', false),
    onRetry,
    onBreak,
    signal
  );
  onProgress(rawFollowing.length, 'following', true);

  // Phase 2 — fetch the list of accounts that follow this user
  const { users: rawFollowers, truncated: followersTruncated } = await fetchAllFriendships(
    userId,
    'followers',
    (count) => onProgress(count, 'followers', false),
    onRetry,
    onBreak,
    signal
  );
  onProgress(rawFollowers.length, 'followers', true);

  const followerIds = new Set(rawFollowers.map((u) => u.pk));
  const followingIds = new Set(rawFollowing.map((u) => u.pk));

  // Map to internal UserNode shape (deduplicated)
  const toUserNode = (u: V1FriendshipUser, followsViewer: boolean): UserNode => ({
    id: u.pk,
    username: u.username,
    fullName: u.full_name || '',
    profilePicUrl: u.profile_pic_url,
    isPrivate: Boolean(u.is_private),
    isVerified: Boolean(u.is_verified),
    followsViewer,
  });

  const followedUsers = rawFollowing.map((u) => toUserNode(u, followerIds.has(u.pk)));

  // Fans: accounts that follow the viewer but aren't followed back
  const fans = rawFollowers
    .filter((u) => !followingIds.has(u.pk))
    .map((u): UserNode => ({ ...toUserNode(u, true), isFan: true }));
  followedUsers.push(...fans);

  followedUsers.sort((a, b) => a.username.localeCompare(b.username));

  // A partial followers list would wrongly flag real followers as non-followers.
  let warning: string | undefined;
  if (followersTruncated) {
    warning = `The followers list stopped early after ${rawFollowers.length} accounts. Some accounts marked as non-followers may actually follow you, so double-check before unfollowing.`;
  } else if (followingTruncated) {
    warning = `The following list stopped early after ${rawFollowing.length} accounts. The list may be missing some accounts.`;
  }

  return { users: followedUsers, warning };
};

// Unfollow a specific user by ID
// The CSRF token is read fresh on every call, since Instagram can rotate it mid-session.
export const unfollowUser = async (userId: string): Promise<UnfollowResult> => {
  const token = getCsrfToken();
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
