import { version as PKG_VERSION } from '../package.json';
import { fetchFollowings, getCookie, ScanBlockedError } from './api';
import APP_LOGO_SVG from './assets/icon.svg';
import LOCK_ICON_SVG from './assets/lock.svg';
import { estimatePhaseShare, expectedTotalsFromCache, overallProgressPercent } from './progress';
import {
  getCachedFollowings,
  getLastScanTime,
  isScanTooSoon,
  mergeCacheWithFreshScan,
  setCachedFollowings,
  setLastScanTime,
} from './storage';
import CSS_STYLES from './styles.css';
import type { CacheData, UserNode } from './types';
import {
  loadCacheWithScanAnimation,
  renderCachePrompt,
  renderError,
  renderList,
  renderScanCooldownPrompt,
  setElementHTML,
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
    setElementHTML(
      overlayEl,
      `
      <div class="iu-card" style="max-width: 560px; width: 92%; height: auto; margin: auto;">
        <div class="iu-header">
          <div class="iu-title-group">
            <div class="iu-logo">${APP_LOGO_SVG}</div>
            <span class="iu-title">Unfollowers for Instagram</span>
            <span class="iu-version-tag">v${appVersion}</span>
          </div>
          <button class="iu-close-btn" id="iu-close-btn">&times;</button>
        </div>
        <div style="padding: 3rem 2rem; text-align: center; display: flex; flex-direction: column; align-items: center; gap: 1.5rem;">
          ${LOCK_ICON_SVG}
          <div>
            <h3 style="font-size: 1.5rem; font-weight: 700; color: #f87171; margin-bottom: 0.75rem;">Login Required</h3>
            <p style="color: #ada79d; font-size: 1rem; line-height: 1.6; max-width: 440px; margin: 0 auto;">
              You are currently not logged into Instagram. Please log into your account on this tab first, then launch the scanner again.
            </p>
          </div>
          <button id="iu-login-close-btn" class="iu-btn-export" style="background: linear-gradient(135deg, #f97316, #ec4899, #7c3aed); color: #fff; border: none; font-weight: 700; height: 46px; padding: 0 2rem; font-size: 0.95rem; border-radius: 12px; cursor: pointer;">Got It</button>
        </div>
      </div>
    `
    );
    document.body.appendChild(overlayEl);

    const closeHandler = () => {
      overlayEl.remove();
      styleEl.remove();
    };

    document.getElementById('iu-close-btn')?.addEventListener('click', closeHandler);
    document.getElementById('iu-login-close-btn')?.addEventListener('click', closeHandler);
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
  setElementHTML(
    overlayEl,
    `
    <div class="iu-card">
      <div class="iu-header">
        <div class="iu-title-group">
          <div class="iu-logo">
            ${APP_LOGO_SVG}
          </div>
          <span class="iu-title">Unfollowers for Instagram</span>
          <span class="iu-version-tag">v${appVersion}</span>
        </div>
        <button class="iu-close-btn" id="iu-close-btn">&times;</button>
      </div>
      <div class="iu-body" id="iu-body"></div>
    </div>
  `
  );
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
  document.getElementById('iu-close-btn')!.addEventListener('click', cleanup);

  // Fetch Followings Logic
  const bodyEl = document.getElementById('iu-body')!;

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
    const lastScanTime = getLastScanTime(ds_user_id);
    if (!isScanTooSoon(lastScanTime)) {
      startScanning();
      return;
    }
    const cache = getCachedFollowings(ds_user_id);
    currentListController?.cancelBulk();
    renderScanCooldownPrompt(bodyEl, lastScanTime!, cache ? () => showList(cache.users) : null, startScanning, cleanup);
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
      setElementHTML(
        bodyEl,
        `
        <div class="iu-scanner-view">
          <div class="iu-spinner"></div>
          <div>
            <h3 style="margin-bottom: 0.5rem; font-weight: 600;">Analyzing your account...</h3>
            <p style="color: #ada79d; font-size: 0.9rem;" id="iu-scan-status">Scanning following list...</p>
          </div>
          <div class="iu-progress-bar-container">
            <div class="iu-progress-bar" id="iu-progress-bar"></div>
          </div>
          <div style="margin-top: 0.75rem; background: rgba(59, 130, 246, 0.08); border: 1px solid rgba(59, 130, 246, 0.2); border-radius: 10px; padding: 0.75rem 1rem; font-size: 0.8rem; color: #93c5fd; max-width: 420px; text-align: left; line-height: 1.45; box-sizing: border-box;">
            <strong>Note:</strong> Due to recent internal changes on Instagram, scanning now runs in two safe stages (scanning your followings first, then checking followbacks). It takes a few extra seconds, but keeps your scan accurate and account safe.
          </div>
        </div>
      `
      );

      const scanStatusEl = document.getElementById('iu-scan-status')!;
      const progressBarEl = document.getElementById('iu-progress-bar')!;

      // Recorded at the start: a cancelled or failed scan has already sent requests
      setLastScanTime(ds_user_id);

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
          progressBarEl.style.width = `${Math.round(overallProgressPercent(phase, phaseShare))}%`;
          scanStatusEl.textContent = `${label}: ${scanned.toLocaleString()} accounts...`;
        },
        (waitMs, attempt, maxAttempts) => {
          scanStatusEl.textContent = `Instagram is limiting requests. Pausing ${Math.round(waitMs / 1000)}s before retrying (attempt ${attempt} of ${maxAttempts})...`;
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
      fileInput.style.display = 'none';
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
