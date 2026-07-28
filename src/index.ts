import CSS_STYLES from './styles.css';
import { getCookie, fetchFollowings } from './api';
import { getCachedFollowings, setCachedFollowings, mergeCacheWithFreshScan } from './storage';
import { renderList, renderCachePrompt, loadCacheWithScanAnimation, setElementHTML } from './ui';
import APP_LOGO_SVG from './assets/icon.svg';
import { version as PKG_VERSION } from '../package.json';

const appVersion = (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.getManifest)
  ? chrome.runtime.getManifest().version
  : PKG_VERSION;

(async () => {
  if (location.hostname !== 'www.instagram.com') {
    alert('This script must be executed on www.instagram.com!');
    return;
  }

  const ds_user_id = getCookie('ds_user_id');
  const csrfToken = getCookie('csrftoken');

  if (!ds_user_id) {
    alert('Please make sure you are logged in to Instagram on this tab first.');
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
  setElementHTML(overlayEl, `
    <div class="iu-card">
      <div class="iu-header">
        <div class="iu-title-group">
          <div class="iu-logo">
            ${APP_LOGO_SVG}
          </div>
          <span class="iu-title">IG Unfollowers</span>
          <span class="iu-version-tag">v${appVersion}</span>
        </div>
        <button class="iu-close-btn" id="iu-close-btn">&times;</button>
      </div>
      <div class="iu-body" id="iu-body"></div>
    </div>
  `);
  document.body.appendChild(overlayEl);

  // Prevent scroll chaining when interacting with overlay backdrop
  overlayEl.addEventListener('wheel', (e) => {
    const card = overlayEl.querySelector('.iu-card');
    if (card && !card.contains(e.target as Node)) {
      e.preventDefault();
    }
  }, { passive: false });
  overlayEl.addEventListener('touchmove', (e) => {
    const card = overlayEl.querySelector('.iu-card');
    if (card && !card.contains(e.target as Node)) {
      e.preventDefault();
    }
  }, { passive: false });

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

  const startScanning = async () => {
    if (scanAbortController) {
      scanAbortController.abort();
    }
    scanAbortController = new AbortController();
    const signal = scanAbortController.signal;

    try {
      setElementHTML(bodyEl, `
        <div class="iu-scanner-view">
          <div class="iu-spinner"></div>
          <div>
            <h3 style="margin-bottom: 0.5rem; font-weight: 600;">Analyzing your account...</h3>
            <p style="color: #ada79d; font-size: 0.9rem;" id="iu-scan-status">Preparing scanner...</p>
          </div>
          <div class="iu-progress-bar-container">
            <div class="iu-progress-bar" id="iu-progress-bar"></div>
          </div>
        </div>
      `);

      const scanStatusEl = document.getElementById('iu-scan-status')!;
      const progressBarEl = document.getElementById('iu-progress-bar')!;

      const followedUsers = await fetchFollowings(ds_user_id, (scanned, total) => {
        const percentage = Math.round((scanned / total) * 100);
        progressBarEl.style.width = `${percentage}%`;
        scanStatusEl.textContent = `Scanned ${scanned} of ${total} followings (${percentage}%)...`;
      }, signal);

      // Get previous cache before overwriting it
      const prevCache = getCachedFollowings(ds_user_id);

      // Merge fresh scan results with previous cached entries to preserve unfollower metadata
      const mergedUsers = mergeCacheWithFreshScan(followedUsers, prevCache);

      // Save to local cache
      setCachedFollowings(ds_user_id, mergedUsers);

      // Render List View
      currentListController = renderList(bodyEl, mergedUsers, csrfToken || '', ds_user_id, startScanning);
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        console.log('Scan successfully aborted.');
        return;
      }
      console.error('Scan Error:', err);
      const errMsg = err instanceof Error ? err.message : 'An error occurred while loading followings from Instagram.';
      setElementHTML(bodyEl, `
        <div style="text-align: center; margin: auto; padding: 2rem;">
          <span style="font-size: 3rem;">⚠️</span>
          <h3 style="margin: 1rem 0; color: #f87171;">Scan Failed</h3>
          <p style="color: #ada79d; margin-bottom: 1.5rem; line-height: 1.5; max-width: 320px; margin-left: auto; margin-right: auto;">${errMsg}</p>
          <button id="iu-reload-btn" class="iu-btn-export" style="background: linear-gradient(135deg, #f97316, #ec4899, #7c3aed); color: #fff; border: none;">Reload Page</button>
        </div>
      `);

      document.getElementById('iu-reload-btn')?.addEventListener('click', () => {
        location.reload();
      });
    }
  };

  // Helper to trigger file import on initial screen
  const handleInitialImport = () => {
    let fileInput = document.getElementById('iu-initial-import-input') as HTMLInputElement;
    if (!fileInput) {
      fileInput = document.createElement('input');
      fileInput.type = 'file';
      fileInput.id = 'iu-initial-import-input';
      fileInput.accept = '.json';
      fileInput.style.display = 'none';
      document.body.appendChild(fileInput);
    }

    fileInput.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      loadCacheWithScanAnimation(file, bodyEl, csrfToken || '', ds_user_id, startScanning);
      fileInput.value = '';
    };

    fileInput.click();
  };

  // Check cache data
  const cachedData = getCachedFollowings(ds_user_id);
  if (cachedData) {
    renderCachePrompt(
      bodyEl,
      cachedData,
      () => {
        currentListController = renderList(bodyEl, cachedData.users, csrfToken || '', ds_user_id, startScanning);
      },
      () => {
        handleInitialImport();
      },
      () => {
        startScanning();
      }
    );
  } else {
    startScanning();
  }
})();
