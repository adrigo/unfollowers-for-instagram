import CACHE_SYNC_SVG from '../../assets/cache-sync.svg';
import { formatCacheAge } from '../../storage';
import type { CacheData } from '../../types';
import { setElementHTML } from '../html';

export function renderCachePrompt(
  bodyEl: HTMLElement,
  cachedData: CacheData,
  onUseCache: () => void,
  onImportCache: () => void,
  onScanFresh: () => void
) {
  const ageString = formatCacheAge(cachedData.timestamp);

  setElementHTML(
    bodyEl,
    `
    <div style="text-align: center; margin: auto; padding: 2.5rem; display: flex; flex-direction: column; gap: 1.5rem; align-items: center; justify-content: center; height: 100%;">
      ${CACHE_SYNC_SVG}
      <div>
        <h3 style="margin-bottom: 0.5rem; font-weight: 600; font-size: 1.3rem;">Found Cached Data</h3>
        <p style="color: #ada79d; font-size: 0.9rem; line-height: 1.5; max-width: 380px;">
          A cached list of <strong>${cachedData.users.length} users</strong> was found (loaded ${ageString}).
          <br>
          Select <strong>New Scan</strong> to check for recent changes, <strong>Use Cache</strong> to view the saved list, or <strong>Import</strong> a JSON backup.
        </p>
      </div>
      <div style="display: flex; gap: 0.5rem; width: 100%; max-width: 380px;">
        <button id="iu-use-cache-btn" class="iu-btn-export" style="flex: 1; background: linear-gradient(135deg, #f97316, #ec4899, #7c3aed); color: #fff; border: none; font-weight: 700; height: 42px; border-radius: 10px;">Use Cache</button>
        <button id="iu-import-cache-btn" class="iu-btn-export" style="flex: 1; height: 42px; border-radius: 10px;">Import</button>
        <button id="iu-scan-fresh-btn" class="iu-btn-export" style="flex: 1; height: 42px; border-radius: 10px;">New Scan</button>
      </div>
      <div style="background: rgba(192, 132, 252, 0.1); border: 1px solid rgba(192, 132, 252, 0.2); border-radius: 8px; padding: 0.75rem 1rem; font-size: 0.82rem; color: #c084fc; max-width: 380px; text-align: left; line-height: 1.4; box-sizing: border-box;">
        <strong>Note:</strong> To detect new unfollowers, we will use the cache but we need to do a fresh scan.
      </div>
    </div>
  `
  );

  document.getElementById('iu-use-cache-btn')!.addEventListener('click', onUseCache);
  document.getElementById('iu-import-cache-btn')!.addEventListener('click', onImportCache);
  document.getElementById('iu-scan-fresh-btn')!.addEventListener('click', onScanFresh);
}
