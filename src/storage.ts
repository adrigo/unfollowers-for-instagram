import { UserNode, CacheData } from './types';

// Get cached followings list from LocalStorage
export const getCachedFollowings = (userId: string): CacheData | null => {
  try {
    const dataStr = localStorage.getItem(`iu_cache_${userId}`);
    if (!dataStr) return null;
    return JSON.parse(dataStr);
  } catch (e) {
    return null;
  }
};

// Save followings list to LocalStorage cache
export const setCachedFollowings = (userId: string, users: UserNode[], customTimestamp?: number): void => {
  try {
    const data: CacheData = {
      timestamp: customTimestamp ?? Date.now(),
      users
    };
    localStorage.setItem(`iu_cache_${userId}`, JSON.stringify(data));
  } catch (e) {
    console.error('Failed to save followings cache:', e);
  }
};

// Validate and parse imported cache JSON file
export const validateAndParseCacheData = (jsonString: string): { data?: CacheData; error?: string } => {
  try {
    const parsed = JSON.parse(jsonString);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return { error: 'Invalid format. File must contain a JSON object.' };
    }
    if (typeof parsed.timestamp !== 'number' || isNaN(parsed.timestamp)) {
      return { error: 'Missing or invalid "timestamp" field. It must be a valid timestamp number.' };
    }
    if (!Array.isArray(parsed.users)) {
      return { error: 'Missing or invalid "users" field. It must be an array of users.' };
    }
    // Verify user array elements contain basic user properties and normalize fields
    const sanitizedUsers: UserNode[] = [];
    for (const u of parsed.users) {
      if (!u || typeof u !== 'object' || typeof u.id !== 'string' || typeof u.username !== 'string') {
        return { error: 'Invalid user objects in "users" array. Each user must have an "id" and "username".' };
      }
      sanitizedUsers.push({
        id: u.id,
        username: u.username,
        fullName: typeof u.fullName === 'string' ? u.fullName : '',
        profilePicUrl: typeof u.profilePicUrl === 'string' ? u.profilePicUrl : '',
        isPrivate: Boolean(u.isPrivate),
        isVerified: Boolean(u.isVerified),
        followsViewer: Boolean(u.followsViewer),
        isNew: Boolean(u.isNew)
      });
    }

    return {
      data: {
        timestamp: parsed.timestamp,
        users: sanitizedUsers
      }
    };
  } catch (e) {
    return { error: 'Failed to parse JSON file. Ensure the file contains valid JSON.' };
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
            isNew: true
          };
        } else {
          // Already an unfollower
          return {
            ...u,
            isNew: false
          };
        }
      } else {
        // New following: not in previous cache, and they don't follow us back
        return {
          ...u,
          isNew: false
        };
      }
    } else {
      // First scan: baseline detection
      return {
        ...u,
        isNew: false
      };
    }
  });
};

// Format timestamp into humanized relative time string (e.g. "2 hours ago")
export const formatCacheAge = (timestamp: number): string => {
  const diffMs = Math.max(0, Date.now() - timestamp);
  const totalSeconds = Math.floor(diffMs / 1000);

  if (totalSeconds < 1) {
    return 'just now';
  }

  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const mins = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const parts: string[] = [];

  if (days > 0) {
    parts.push(`${days} ${days === 1 ? 'day' : 'days'}`);
  }
  if (hours > 0) {
    parts.push(`${hours} ${hours === 1 ? 'hour' : 'hours'}`);
  }
  if (mins > 0) {
    parts.push(`${mins} ${mins === 1 ? 'min' : 'mins'}`);
  }
  if (seconds > 0) {
    parts.push(`${seconds} ${seconds === 1 ? 'second' : 'seconds'}`);
  }

  if (parts.length === 0) {
    return 'just now';
  }

  const ageText = parts.length === 1
    ? parts[0]
    : parts.length === 2
    ? `${parts[0]} and ${parts[1]}`
    : `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`;

  return `${ageText} ago`;
};
