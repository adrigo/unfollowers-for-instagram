export interface UserNode {
  id: string;
  username: string;
  fullName: string;
  profilePicUrl: string;
  isPrivate: boolean;
  isVerified: boolean;
  followsViewer: boolean;
  isNew?: boolean;
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
export interface V1FriendshipUser {
  pk: string;
  username: string;
  full_name: string;
  profile_pic_url: string;
  is_private: boolean;
  is_verified: boolean;
}

export interface V1FriendshipsResponse {
  users: V1FriendshipUser[];
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

export type ScanProgressCallback = (scanned: number, total: number, phase?: 'following' | 'followers') => void;

export type ScanRetryCallback = (waitMs: number, attempt: number, maxAttempts: number, reason: string) => void;

export interface ScanResult {
  users: UserNode[];
  // Set when the fetched lists look incomplete compared to the profile counts
  warning?: string;
}

export interface UserFilterState {
  showNonFollowers: boolean;
  showFollowers: boolean;
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
