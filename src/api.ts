import { UserNode, UnfollowResult, ScanProgressCallback, GraphQLResponse } from './types';

// Helper function to read cookies robustly
export const getCookie = (name: string): string | null => {
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match && match[1] ? decodeURIComponent(match[1]) : null;
};

// Fetch all followed users via Instagram GraphQL API
export const fetchFollowings = async (
  userId: string,
  onProgress: ScanProgressCallback,
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

    const resJson: GraphQLResponse = await res.json();
    if (resJson.errors && resJson.errors.length > 0) {
      throw new Error(resJson.errors[0]?.message || 'Instagram API Error');
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
        isPrivate: Boolean(node.is_private),
        isVerified: Boolean(node.is_verified),
        followsViewer: Boolean(node.follows_viewer)
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
