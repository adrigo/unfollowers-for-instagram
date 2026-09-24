export interface UserNode {
  id: string;
  username: string;
  fullName: string;
  profilePicUrl: string;
  isPrivate: boolean;
  isVerified: boolean;
  followsViewer: boolean;
  isNew?: boolean;
  // Follows the viewer, but the viewer doesn't follow them back
  isFan?: boolean;
}

export interface CacheData {
  timestamp: number;
  users: UserNode[];
}

export interface UnfollowResult {
  ok: boolean;
  status: number;
}

// Instagram private REST API v1 — /api/v1/friendships/<userId>/following/
// User as returned by Instagram. The ID type isn't guaranteed: pk may arrive as a
// string or a number, and some responses also include a string pk_id.
export interface RawV1FriendshipUser {
  pk: string | number;
  pk_id?: string;
  username: string;
  full_name: string;
  profile_pic_url: string;
  is_private: boolean;
  is_verified: boolean;
}

// Same user after normalization, with pk always a string
export interface V1FriendshipUser {
  pk: string;
  username: string;
  full_name: string;
  profile_pic_url: string;
  is_private: boolean;
  is_verified: boolean;
}

export interface V1FriendshipsResponse {
  users: RawV1FriendshipUser[];
  next_max_id?: string;
  big_list?: boolean;
  status: string;
}

// Instagram private REST API v1 — POST /api/v1/friendships/show_many/
export interface FriendshipStatus {
  following: boolean;
  followed_by: boolean; // true = that user follows the authenticated user
  is_private?: boolean;
}

export interface ShowManyResponse {
  friendship_statuses: Record<string, FriendshipStatus>;
  status: string;
}

export type SortOption = 'unfollowed-recent' | 'name-asc' | 'name-desc' | 'private-first' | 'verified-first';

// `done` is true once the phase's list has been fully fetched
export type ScanProgressCallback = (scanned: number, phase: 'following' | 'followers', done: boolean) => void;

export type ScanRetryCallback = (waitMs: number, attempt: number, maxAttempts: number, reason: string) => void;

export interface ScanResult {
  users: UserNode[];
  // Set when a list stopped paginating before reaching its end
  warning?: string;
}

export interface UserFilterState {
  showNonFollowers: boolean;
  showFollowers: boolean;
  showFans: boolean;
  showNewUnfollowersOnly: boolean;
  showVerified: boolean;
  showPrivate: boolean;
}

declare global {
  // eslint-disable-next-line no-var
  var chrome:
    | {
        runtime?: {
          getManifest?: () => { version: string; [key: string]: unknown };
          [key: string]: unknown;
        };
        [key: string]: unknown;
      }
    | undefined;
}
