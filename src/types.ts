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

declare global {
  const chrome: any;
}

