import { version as PKG_VERSION } from '../package.json';
import { fetchFollowings, getCookie, ScanBlockedError } from './api';
import { estimatePhaseShare, expectedTotalsFromCache, overallProgressPercent } from './progress';
import {
  getCachedFollowings,
  getScanHistory,
  getScanWarning,
  mergeCacheWithFreshScan,
  recordScan,
  setCachedFollowings,
} from './storage';
import CSS_STYLES from './styles.css';
import type { CacheData, UserNode } from './types';
import {
  loadCacheWithScanAnimation,
  renderCachePrompt,
  renderError,
  renderList,
  renderLoginRequired,
  renderOverlayCard,
  renderScanCooldownPrompt,
  renderScanning,
} from './ui';

const appVersion =
  typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.getManifest
    ? chrome.runtime.getManifest().version
    : PKG_VERSION;

(async () => {
  if (location.hostname !== 'www.instagram.com') {
    alert('This script must be executed on www.instagram.com!');
    return;
  }

  const ds_user_id = getCookie('ds_user_id');

  if (!ds_user_id) {
    const existingModal = document.getElementById('iu-overlay');
    const existingStyles = document.getElementById('iu-styles');
    if (existingModal) existingModal.remove();
    if (existingStyles) existingStyles.remove();

    const styleEl = document.createElement('style');
    styleEl.id = 'iu-styles';
    styleEl.textContent = CSS_STYLES;
    document.head.appendChild(styleEl);

    const overlayEl = document.createElement('div');
    overlayEl.id = 'iu-overlay';
    document.body.appendChild(overlayEl);

    renderLoginRequired(overlayEl, appVersion, () => {
      overlayEl.remove();
      styleEl.remove();
    });
    return;
  }

  let scanAbortController: AbortController | null = null;
  let currentListController: { cancelBulk: () => void } | null = null;

  // Prevent multiple overlay injections
  const existingModal = document.getElementById('iu-overlay');
  const existingStyles = document.getElementById('iu-styles');
  if (existingModal) {
    existingModal.remove();
  }
  if (existingStyles) {
    existingStyles.remove();
  }

  // Inject CSS Styles
  const styleEl = document.createElement('style');
  styleEl.id = 'iu-styles';
  styleEl.textContent = CSS_STYLES;
  document.head.appendChild(styleEl);

  // Inject Overlay Card
  const overlayEl = document.createElement('div');
  overlayEl.id = 'iu-overlay';
  const bodyEl = renderOverlayCard(overlayEl, appVersion, () => cleanup());
  document.body.appendChild(overlayEl);

  // Prevent scroll chaining when interacting with overlay backdrop
  overlayEl.addEventListener(
    'wheel',
    (e) => {
      const card = overlayEl.querySelector('.iu-card');
      if (card && !card.contains(e.target as Node)) {
        e.preventDefault();
      }
    },
    { passive: false }
  );
  overlayEl.addEventListener(
    'touchmove',
    (e) => {
      const card = overlayEl.querySelector('.iu-card');
      if (card && !card.contains(e.target as Node)) {
        e.preventDefault();
      }
    },
    { passive: false }
  );

  // Store original overflow values to allow proper restoration
  if (document.body.dataset.iuOriginalOverflow === undefined) {
    document.body.dataset.iuOriginalOverflow = document.body.style.overflow || '';
  }
  if (document.documentElement.dataset.iuOriginalOverflow === undefined) {
    document.documentElement.dataset.iuOriginalOverflow = document.documentElement.style.overflow || '';
  }

  // Freeze background page scrolling
  document.body.style.overflow = 'hidden';
  document.documentElement.style.overflow = 'hidden';

  // Close functionality
  const cleanup = () => {
    if (scanAbortController) {
      scanAbortController.abort();
      scanAbortController = null;
    }
    if (currentListController) {
      currentListController.cancelBulk();
      currentListController = null;
    }
    overlayEl.remove();
    styleEl.remove();

    // Restore original background scrolling behavior
    if (document.body.dataset.iuOriginalOverflow !== undefined) {
      document.body.style.overflow = document.body.dataset.iuOriginalOverflow;
      delete document.body.dataset.iuOriginalOverflow;
    }
    if (document.documentElement.dataset.iuOriginalOverflow !== undefined) {
      document.documentElement.style.overflow = document.documentElement.dataset.iuOriginalOverflow;
      delete document.documentElement.dataset.iuOriginalOverflow;
    }
  };

  // Render the list view, cancelling any bulk run owned by a previous list
  const showList = (users: UserNode[], notice?: string) => {
    currentListController?.cancelBulk();
    currentListController = renderList(
      bodyEl,
      users,
      ds_user_id,
      {
        onScanFresh: requestScan,
        onImport: () => handleImport(() => showList(getCachedFollowings(ds_user_id)?.users ?? users)),
      },
      notice
    );
  };

  // Every New Scan goes through here: within the cooldown window, ask before scanning again
  const requestScan = () => {
    const warning = getScanWarning(getScanHistory(ds_user_id));
    if (!warning) {
      startScanning();
      return;
    }
    const cache = getCachedFollowings(ds_user_id);
    currentListController?.cancelBulk();
    renderScanCooldownPrompt(bodyEl, warning, cache ? () => showList(cache.users) : null, startScanning, cleanup);
  };

  const startScanning = async () => {
    currentListController?.cancelBulk();
    currentListController = null;
    if (scanAbortController) {
      scanAbortController.abort();
    }
    scanAbortController = new AbortController();
    const signal = scanAbortController.signal;

    try {
      const progress = renderScanning(bodyEl);

      // Recorded at the start: a cancelled or failed scan has already sent requests
      recordScan(ds_user_id);

      // Previous scan: used as the expected list sizes for progress, then for the merge below
      const prevCache = getCachedFollowings(ds_user_id);
      const expected = expectedTotalsFromCache(prevCache);

      const { users: followedUsers, warning } = await fetchFollowings(
        ds_user_id,
        (scanned, phase, done) => {
          const isFollowers = phase === 'followers';
          const label = isFollowers ? 'Scanning followers list' : 'Scanning following list';

          // Following takes one request, followers ~25 accounts per request (see progress.ts)
          const phaseShare = estimatePhaseShare(scanned, expected[phase], done);
          progress.setPercent(overallProgressPercent(phase, phaseShare));
          progress.setStatus(`${label}: ${scanned.toLocaleString()} accounts...`);
        },
        (waitMs, attempt, maxAttempts) => {
          progress.setStatus(
            `Instagram is limiting requests. Pausing ${Math.round(waitMs / 1000)}s before retrying (attempt ${attempt} of ${maxAttempts})...`
          );
        },
        (waitMs) => {
          progress.setStatus(`Taking a short ${Math.round(waitMs / 1000)}s break so the scan looks less automated...`);
        },
        signal
      );

      // Merge fresh scan results with previous cached entries to preserve unfollower metadata
      const mergedUsers = mergeCacheWithFreshScan(followedUsers, prevCache);

      // Save to local cache
      setCachedFollowings(ds_user_id, mergedUsers);

      // Render List View
      showList(mergedUsers, warning);
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        console.log('Scan successfully aborted.');
        return;
      }
      console.error('Scan Error:', err);

      if (err instanceof ScanBlockedError) {
        const cache = getCachedFollowings(ds_user_id);
        renderError(
          bodyEl,
          'Instagram is temporarily blocking scans',
          `Instagram refused the ${err.list} list request. This usually happens after several scans in a short time. Wait a few hours before scanning again${cache ? '. Your saved results are still available.' : '.'}`,
          cache ? { label: 'Use Cache', onClick: () => showList(cache.users) } : { label: 'Close', onClick: cleanup }
        );
        return;
      }

      const errMsg = err instanceof Error ? err.message : 'An error occurred while loading followings from Instagram.';
      renderError(bodyEl, 'Scan Failed', errMsg, { label: 'Try Again', onClick: startScanning });
    }
  };

  // Pick a JSON backup and load it; onBack restores the previous view if the import fails
  const handleImport = (onBack: () => void) => {
    let fileInput = document.getElementById('iu-import-input') as HTMLInputElement | null;
    if (!fileInput) {
      fileInput = document.createElement('input');
      fileInput.type = 'file';
      fileInput.id = 'iu-import-input';
      fileInput.accept = '.json';
      fileInput.hidden = true;
      overlayEl.appendChild(fileInput);
    }

    fileInput.onchange = () => {
      const file = fileInput.files?.[0];
      if (!file) return;

      loadCacheWithScanAnimation(file, bodyEl, ds_user_id, (users) => showList(users), onBack);
      fileInput.value = '';
    };

    fileInput.click();
  };

  // Check cache data
  const showCachePrompt = (cachedData: CacheData) => {
    renderCachePrompt(
      bodyEl,
      cachedData,
      () => showList(cachedData.users),
      () => handleImport(() => showCachePrompt(cachedData)),
      requestScan
    );
  };

  const cachedData = getCachedFollowings(ds_user_id);
  if (cachedData) {
    showCachePrompt(cachedData);
  } else {
    requestScan();
  }
})();
