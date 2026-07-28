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

export interface GraphQLEdgeNode {
  id: string;
  username: string;
  full_name?: string;
  profile_pic_url: string;
  is_private: boolean;
  is_verified: boolean;
  follows_viewer: boolean;
}

export interface GraphQLPageInfo {
  has_next_page: boolean;
  end_cursor: string;
}

export interface GraphQLEdgeFollow {
  count: number;
  page_info: GraphQLPageInfo;
  edges: Array<{ node: GraphQLEdgeNode }>;
}

export interface GraphQLResponse {
  data?: {
    user?: {
      edge_follow?: GraphQLEdgeFollow;
    };
  };
  errors?: Array<{ message?: string }>;
}

export type SortOption =
  | 'unfollowed-recent'
  | 'name-asc'
  | 'name-desc'
  | 'private-first'
  | 'verified-first';

export type ScanProgressCallback = (scanned: number, total: number) => void;

export interface UserFilterState {
  showNonFollowers: boolean;
  showFollowers: boolean;
  showNewUnfollowersOnly: boolean;
  showVerified: boolean;
  showPrivate: boolean;
}

declare global {
  // eslint-disable-next-line no-var
  var chrome: {
    runtime?: {
      getManifest?: () => { version: string; [key: string]: unknown };
      [key: string]: unknown;
    };
    [key: string]: unknown;
  } | undefined;
}


