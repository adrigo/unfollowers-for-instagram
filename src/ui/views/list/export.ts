import { getCachedFollowings } from '../../../storage';
import type { CacheData, UserNode } from '../../../types';

// Download the list in the same format as the LocalStorage cache, so it can be imported back
export function downloadCacheExport(dsUserId: string, users: UserNode[]) {
  const cacheToExport: CacheData = {
    timestamp: getCachedFollowings(dsUserId)?.timestamp || Date.now(),
    users,
  };
  const dataStr = `data:text/json;charset=utf-8,${encodeURIComponent(JSON.stringify(cacheToExport, null, 2))}`;
  const downloadAnchor = document.createElement('a');
  downloadAnchor.setAttribute('href', dataStr);
  downloadAnchor.setAttribute('download', `iu_cache_${dsUserId || 'export'}.json`);
  document.body.appendChild(downloadAnchor);
  downloadAnchor.click();
  downloadAnchor.remove();
}
