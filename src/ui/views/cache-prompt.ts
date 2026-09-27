import { formatCacheAge } from '../../storage';
import type { CacheData } from '../../types';
import { promptHtml } from '../components/prompt';
import { html, query, setElementHTML } from '../html';
import { ICONS } from '../icons';

export function renderCachePrompt(
  bodyEl: HTMLElement,
  cachedData: CacheData,
  onUseCache: () => void,
  onImportCache: () => void,
  onScanFresh: () => void
) {
  setElementHTML(
    bodyEl,
    promptHtml({
      icon: ICONS.cacheSync,
      title: 'Found Cached Data',
      text: html`
        A cached list of <strong>${cachedData.users.length} users</strong> was found (loaded ${formatCacheAge(cachedData.timestamp)}).
        <br>
        Select <strong>New Scan</strong> to check for recent changes, <strong>Use Cache</strong> to view the saved list, or <strong>Import</strong> a JSON backup.
      `,
      actions: html`
        <button id="iu-use-cache-btn" class="iu-btn-export iu-btn-primary">Use Cache</button>
        <button id="iu-import-cache-btn" class="iu-btn-export">Import</button>
        <button id="iu-scan-fresh-btn" class="iu-btn-export">New Scan</button>
      `,
      footer: html`
        <div class="iu-callout iu-callout-note">
          <strong>Note:</strong> To detect new unfollowers, we will use the cache but we need to do a fresh scan.
        </div>
      `,
    })
  );

  query(bodyEl, '#iu-use-cache-btn').addEventListener('click', onUseCache);
  query(bodyEl, '#iu-import-cache-btn').addEventListener('click', onImportCache);
  query(bodyEl, '#iu-scan-fresh-btn').addEventListener('click', onScanFresh);
}
