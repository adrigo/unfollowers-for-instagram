import { UserNode, CacheData } from './types';
import { unfollowUser } from './api';
import { setCachedFollowings, getCachedFollowings, validateAndParseCacheData, formatCacheAge } from './storage';
import VERIFIED_BADGE_SVG from './assets/verified.svg';
import NEW_UNFOLLOWER_SVG from './assets/new-unfollower.svg';
import PRIVATE_LOCK_SVG from './assets/private.svg';
import FOLLOWS_YOU_SVG from './assets/follows-you.svg';
import NON_FOLLOWERS_SVG from './assets/non-follower.svg';
import CACHE_SYNC_SVG from './assets/cache-sync.svg';

function wrapIcon(iconSvg: string, title: string): string {
  return `<span title="${title}" style="display: inline-block; vertical-align: middle; margin-left: 0.25rem; line-height: 1; cursor: help; flex-shrink: 0;">${iconSvg}</span>`;
}

export function setElementHTML(element: HTMLElement, htmlString: string) {
  const parsed = new DOMParser().parseFromString(htmlString, 'text/html');
  element.replaceChildren(...Array.from(parsed.body.childNodes));
}

export function renderCachePrompt(
  bodyEl: HTMLElement,
  cachedData: CacheData,
  onUseCache: () => void,
  onImportCache: () => void,
  onScanFresh: () => void
) {
  const ageString = formatCacheAge(cachedData.timestamp);

  setElementHTML(bodyEl, `
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
  `);

  document.getElementById('iu-use-cache-btn')!.addEventListener('click', onUseCache);
  document.getElementById('iu-import-cache-btn')!.addEventListener('click', onImportCache);
  document.getElementById('iu-scan-fresh-btn')!.addEventListener('click', onScanFresh);
}

export function loadCacheWithScanAnimation(
  file: File,
  bodyEl: HTMLElement,
  csrfToken: string,
  dsUserId: string,
  onScanFresh?: () => void
) {
  setElementHTML(bodyEl, `
    <div class="iu-scanner-view">
      <div class="iu-spinner"></div>
      <div>
        <h3 style="margin-bottom: 0.5rem; font-weight: 600;">Importing cached data...</h3>
        <p style="color: #ada79d; font-size: 0.9rem;" id="iu-scan-status">Reading backup file...</p>
      </div>
      <div class="iu-progress-bar-container">
        <div class="iu-progress-bar" id="iu-progress-bar" style="width: 25%; transition: width 0.3s ease;"></div>
      </div>
    </div>
  `);

  const scanStatusEl = document.getElementById('iu-scan-status')!;
  const progressBarEl = document.getElementById('iu-progress-bar')!;

  const reader = new FileReader();
  reader.onload = (event) => {
    const content = event.target?.result as string;
    const result = validateAndParseCacheData(content);

    if (result.error || !result.data) {
      setElementHTML(bodyEl, `
        <div style="text-align: center; margin: auto; padding: 2rem;">
          <span style="font-size: 3rem;">⚠️</span>
          <h3 style="margin: 1rem 0; color: #f87171;">Import Failed</h3>
          <p style="color: #ada79d; margin-bottom: 1.5rem; line-height: 1.5; max-width: 320px; margin-left: auto; margin-right: auto;">${result.error}</p>
          <button id="iu-reload-btn" class="iu-btn-export" style="background: linear-gradient(135deg, #f97316, #ec4899, #7c3aed); color: #fff; border: none;">Reload Page</button>
        </div>
      `);
      document.getElementById('iu-reload-btn')?.addEventListener('click', () => {
        location.reload();
      });
      return;
    }

    progressBarEl.style.width = '70%';
    scanStatusEl.textContent = `Loading ${result.data.users.length} users from cache...`;

    setCachedFollowings(dsUserId, result.data.users, result.data.timestamp);

    setTimeout(() => {
      progressBarEl.style.width = '100%';
      scanStatusEl.textContent = 'Finalizing list view...';

      setTimeout(() => {
        renderList(bodyEl, result.data!.users, csrfToken, dsUserId, onScanFresh);
      }, 250);
    }, 300);
  };

  reader.onerror = () => {
    setElementHTML(bodyEl, `
      <div style="text-align: center; margin: auto; padding: 2rem;">
        <span style="font-size: 3rem;">⚠️</span>
        <h3 style="margin: 1rem 0; color: #f87171;">Import Failed</h3>
        <p style="color: #ada79d; margin-bottom: 1.5rem; line-height: 1.5; max-width: 320px; margin-left: auto; margin-right: auto;">Unable to read the selected file.</p>
        <button id="iu-reload-btn" class="iu-btn-export" style="background: linear-gradient(135deg, #f97316, #ec4899, #7c3aed); color: #fff; border: none;">Reload Page</button>
      </div>
    `);
    document.getElementById('iu-reload-btn')?.addEventListener('click', () => {
      location.reload();
    });
  };

  reader.readAsText(file);
}

export function renderList(
  bodyEl: HTMLElement,
  initialUsers: UserNode[],
  csrfToken: string,
  dsUserId: string,
  onScanFresh?: () => void
): { cancelBulk: () => void } {
  let activeUsers = [...initialUsers];
  let showNonFollowers = true;
  let showFollowers = false;
  let showVerified = true;
  let showPrivate = true;
  let showNewUnfollowersOnly = false;
  let currentSortBy = 'unfollowed-recent';
  let isGridView = false;

  // Bulk action states
  let isBulkPaused = false;
  let isBulkCancelled = false;

  const selectedUserIds = new Set<string>();

  setElementHTML(bodyEl, `
    <div class="iu-layout-wrapper">
      <div class="iu-sidebar">
        <!-- Search bar -->
        <div class="iu-sidebar-section">
          <div style="font-weight: bold; color: #fff; font-size: 0.82rem; margin-bottom: 0.5rem; text-transform: uppercase; letter-spacing: 0.05em;">Search:</div>
          <input type="text" class="iu-search-input" id="iu-search" placeholder="Username or name..." style="width: 100%; box-sizing: border-box;" />
        </div>

        <!-- Actions Group -->
        <div class="iu-sidebar-section iu-sidebar-actions">
          <button class="iu-btn-export" id="iu-bulk-unfollow-btn" style="width: 100%; background: #ef4444; border-color: rgba(239, 68, 68, 0.4); text-align: center;" disabled>Unfollow (0)</button>
          <div class="iu-btn-group">
            <button class="iu-btn-export" id="iu-layout-btn" style="flex: 1; text-align: center;">Grid View</button>
            <button class="iu-btn-export" id="iu-sidebar-scan-btn" style="flex: 1; text-align: center;">New Scan</button>
          </div>
          <div class="iu-btn-group">
            <button class="iu-btn-export" id="iu-import-btn" style="flex: 1; text-align: center;">Import</button>
            <button class="iu-btn-export" id="iu-export-btn" style="flex: 1; text-align: center;">Export</button>
          </div>
        </div>

        <!-- Sort Custom Dropdown -->
        <div class="iu-sidebar-section">
          <div style="font-weight: bold; color: #fff; font-size: 0.82rem; margin-bottom: 0.5rem; text-transform: uppercase; letter-spacing: 0.05em;">Sort By:</div>
          <div class="iu-custom-dropdown" id="iu-sort-dropdown">
            <div class="iu-dropdown-trigger" id="iu-sort-trigger">
              <span id="iu-sort-trigger-content" style="display: flex; align-items: center; gap: 0.4rem;"></span>
              <span style="font-size: 0.65rem; color: #888;">▼</span>
            </div>
            <div class="iu-dropdown-options" id="iu-sort-options">
              <div class="iu-dropdown-option" data-value="unfollowed-recent">
                ${NEW_UNFOLLOWER_SVG} Recently Unfollowed
              </div>
              <div class="iu-dropdown-option" data-value="name-asc">
                <span style="display: inline-block; width: 16px; text-align: center; font-size: 0.75rem; font-weight: bold; color: #aaa; vertical-align: middle;">AZ</span> A-Z (Username)
              </div>
              <div class="iu-dropdown-option" data-value="name-desc">
                <span style="display: inline-block; width: 16px; text-align: center; font-size: 0.75rem; font-weight: bold; color: #aaa; vertical-align: middle;">ZA</span> Z-A (Username)
              </div>
              <div class="iu-dropdown-option" data-value="private-first">
                ${PRIVATE_LOCK_SVG} Private First
              </div>
              <div class="iu-dropdown-option" data-value="verified-first">
                ${VERIFIED_BADGE_SVG} Verified First
              </div>
            </div>
          </div>
        </div>

        <!-- Filter Checkboxes -->
        <div class="iu-sidebar-section">
          <div style="font-weight: bold; color: #fff; font-size: 0.82rem; margin-bottom: 0.6rem; text-transform: uppercase; letter-spacing: 0.05em;">Filters:</div>
          <div class="iu-filter-list">
            <label class="iu-filter-label" style="display: flex; align-items: center; gap: 0.35rem;">
              <input type="checkbox" id="iu-filter-nonfollowers" ${showNonFollowers ? 'checked' : ''} />
              ${NON_FOLLOWERS_SVG} Non-followers
            </label>
            <label class="iu-filter-label" style="display: flex; align-items: center; gap: 0.35rem;">
              <input type="checkbox" id="iu-filter-followers" ${showFollowers ? 'checked' : ''} />
              ${FOLLOWS_YOU_SVG} Followers
            </label>
            <label class="iu-filter-label" style="display: flex; align-items: center; gap: 0.35rem;">
              <input type="checkbox" id="iu-filter-new-unfollowers" ${showNewUnfollowersOnly ? 'checked' : ''} />
              ${NEW_UNFOLLOWER_SVG} New Unfollowers Only
            </label>
            <label class="iu-filter-label" style="display: flex; align-items: center; gap: 0.35rem;">
              <input type="checkbox" id="iu-filter-verified" ${showVerified ? 'checked' : ''} />
              ${VERIFIED_BADGE_SVG} Show Verified
            </label>
            <label class="iu-filter-label" style="display: flex; align-items: center; gap: 0.35rem;">
              <input type="checkbox" id="iu-filter-private" ${showPrivate ? 'checked' : ''} />
              ${PRIVATE_LOCK_SVG} Show Private
            </label>
          </div>
        </div>

        <!-- Vertical Stats Dashboard -->
        <div class="iu-sidebar-section" style="border-bottom: none; padding-bottom: 0;">
          <div style="font-weight: bold; color: #fff; font-size: 0.82rem; margin-bottom: 0.6rem; text-transform: uppercase; letter-spacing: 0.05em;">Statistics:</div>
          <div class="iu-stats-vertical">
            <div class="iu-stat-row">
              <span style="display: flex; align-items: center; gap: 0.35rem;">
                ${NON_FOLLOWERS_SVG} Non-followers
              </span>
              <span id="stat-nonfollowers" class="iu-stat-val non-followers">0</span>
            </div>
            <div class="iu-stat-row">
              <span style="display: flex; align-items: center; gap: 0.35rem;">
                ${NEW_UNFOLLOWER_SVG} New Unfollowers
              </span>
              <span id="stat-new-unfollowers" class="iu-stat-val new-unfollowers">0</span>
            </div>
            <div class="iu-stat-row">
              <span style="display: flex; align-items: center; gap: 0.35rem;">
                ${FOLLOWS_YOU_SVG} Followers
              </span>
              <span id="stat-followers" class="iu-stat-val followers">0</span>
            </div>
            <div class="iu-stat-row">
              <span style="display: flex; align-items: center; gap: 0.35rem;">
                ${VERIFIED_BADGE_SVG} Verified
              </span>
              <span id="stat-verified" class="iu-stat-val verified">0</span>
            </div>
            <div class="iu-stat-row">
              <span style="display: flex; align-items: center; gap: 0.35rem;">
                ${PRIVATE_LOCK_SVG} Private
              </span>
              <span id="stat-private" class="iu-stat-val private">0</span>
            </div>
          </div>
        </div>
      </div>

      <div class="iu-content-area">
        <!-- Progress banner for bulk unfollow operations -->
        <div id="iu-bulk-progress-banner">
          <span id="iu-bulk-progress-text" style="font-weight: 600;">Unfollowing: 0/0</span>
          <div class="iu-btn-group" style="width: auto;">
            <button id="iu-bulk-pause-btn" class="iu-btn-export" style="padding: 0.35rem 0.75rem; font-size: 0.8rem; background: rgba(255, 255, 255, 0.08); border-radius: 6px;">Pause</button>
            <button id="iu-bulk-cancel-btn" class="iu-btn-export" style="padding: 0.35rem 0.75rem; font-size: 0.8rem; background: #ef4444; border: none; border-radius: 6px;">Cancel</button>
          </div>
        </div>

        <!-- Selection controller & counter -->
        <div class="iu-content-header">
          <label class="iu-filter-label">
            <input type="checkbox" id="iu-select-all" />
            <span style="font-weight: bold; color: #fff; font-size: 0.88rem;">Select All Visible</span>
          </label>
          <span id="iu-count-text" style="font-size: 0.85rem; color: #ada79d;">Loading list...</span>
        </div>

        <!-- The scrollable list view -->
        <div class="iu-list-container" id="iu-list">
          <!-- Rendered dynamically -->
        </div>
      </div>
    </div>
  `);

  const listEl = document.getElementById('iu-list')!;
  const searchInput = document.getElementById('iu-search') as HTMLInputElement;
  const countTextEl = document.getElementById('iu-count-text')!;
  const exportBtn = document.getElementById('iu-export-btn') as HTMLButtonElement;
  const importBtn = document.getElementById('iu-import-btn') as HTMLButtonElement;
  const layoutBtn = document.getElementById('iu-layout-btn') as HTMLButtonElement;
  const bulkUnfollowBtn = document.getElementById('iu-bulk-unfollow-btn') as HTMLButtonElement;

  const nonFollowersCheck = document.getElementById('iu-filter-nonfollowers') as HTMLInputElement;
  const followersCheck = document.getElementById('iu-filter-followers') as HTMLInputElement;
  const newUnfollowersCheck = document.getElementById('iu-filter-new-unfollowers') as HTMLInputElement;
  const verifiedCheck = document.getElementById('iu-filter-verified') as HTMLInputElement;
  const privateCheck = document.getElementById('iu-filter-private') as HTMLInputElement;
  const selectAllCheck = document.getElementById('iu-select-all') as HTMLInputElement;

  const progressBanner = document.getElementById('iu-bulk-progress-banner')!;
  const progressText = document.getElementById('iu-bulk-progress-text')!;
  const pauseBtn = document.getElementById('iu-bulk-pause-btn')!;
  const cancelBtn = document.getElementById('iu-bulk-cancel-btn')!;
  const customSortDropdown = document.getElementById('iu-sort-dropdown')!;

  // Filtered reference for exports and bulk actions
  let currentFilteredList: UserNode[] = [];

  const updateStatsCounters = () => {
    let nonFollowers = 0, newUnfollowers = 0, followers = 0, verified = 0, privateCount = 0;
    for (const u of activeUsers) {
      if (!u.followsViewer) nonFollowers++;
      if (!u.followsViewer && u.isNew) newUnfollowers++;
      if (u.followsViewer) followers++;
      if (u.isVerified) verified++;
      if (u.isPrivate) privateCount++;
    }

    document.getElementById('stat-nonfollowers')!.textContent = String(nonFollowers);
    document.getElementById('stat-new-unfollowers')!.textContent = String(newUnfollowers);
    document.getElementById('stat-followers')!.textContent = String(followers);
    document.getElementById('stat-verified')!.textContent = String(verified);
    document.getElementById('stat-private')!.textContent = String(privateCount);
  };

  const updateBulkButton = () => {
    bulkUnfollowBtn.disabled = selectedUserIds.size === 0;
    bulkUnfollowBtn.textContent = `Unfollow (${selectedUserIds.size})`;
  };

  const setBulkInputsDisabled = (disabled: boolean) => {
    [selectAllCheck, searchInput, nonFollowersCheck, followersCheck,
     newUnfollowersCheck, verifiedCheck, privateCheck, layoutBtn, exportBtn
    ].forEach(el => (el as HTMLButtonElement | HTMLInputElement).disabled = disabled);
    if (customSortDropdown) {
      customSortDropdown.style.pointerEvents = disabled ? 'none' : 'auto';
      customSortDropdown.style.opacity = disabled ? '0.5' : '1';
    }
  };

  const syncSelectAllState = () => {
    const allVisibleSelected = currentFilteredList.length > 0 && currentFilteredList.every(u => selectedUserIds.has(u.id));
    selectAllCheck.checked = allVisibleSelected;
  };
  const updateUIList = () => {
    const term = searchInput.value.toLowerCase().trim();

    currentFilteredList = activeUsers.filter(u => {
      // Search filter
      const matchesSearch = u.username.toLowerCase().includes(term) || u.fullName.toLowerCase().includes(term);
      if (!matchesSearch) return false;

      // Follower filter
      const matchesStatus = (showNonFollowers && !u.followsViewer) || (showFollowers && u.followsViewer);
      if (!matchesStatus) return false;

      // New Unfollowers filter
      if (showNewUnfollowersOnly && !u.isNew) return false;

      // Verified filter
      const matchesVerified = !u.isVerified || showVerified;
      if (!matchesVerified) return false;

      // Private filter
      const matchesPrivate = !u.isPrivate || showPrivate;
      if (!matchesPrivate) return false;

      return true;
    });

    // Apply Sorting
    const sortBy = currentSortBy;
    if (sortBy === 'unfollowed-recent') {
      currentFilteredList.sort((a, b) => {
        const isNewA = a.isNew ? 1 : 0;
        const isNewB = b.isNew ? 1 : 0;
        if (isNewA !== isNewB) {
          return isNewB - isNewA;
        }
        return a.username.localeCompare(b.username);
      });
    } else if (sortBy === 'name-asc') {
      currentFilteredList.sort((a, b) => a.username.localeCompare(b.username));
    } else if (sortBy === 'name-desc') {
      currentFilteredList.sort((a, b) => b.username.localeCompare(a.username));
    } else if (sortBy === 'private-first') {
      currentFilteredList.sort((a, b) => {
        if (a.isPrivate && !b.isPrivate) return -1;
        if (!a.isPrivate && b.isPrivate) return 1;
        return a.username.localeCompare(b.username);
      });
    } else if (sortBy === 'verified-first') {
      currentFilteredList.sort((a, b) => {
        if (a.isVerified && !b.isVerified) return -1;
        if (!a.isVerified && b.isVerified) return 1;
        return a.username.localeCompare(b.username);
      });
    }

    countTextEl.textContent = `Showing ${currentFilteredList.length} of ${activeUsers.length} followed accounts.`;

    if (currentFilteredList.length === 0) {
      setElementHTML(listEl, `
        <div style="text-align: center; color: #ada79d; padding: 3rem 0;">
          No users match your criteria.
        </div>
      `);
      return;
    }

    setElementHTML(listEl, currentFilteredList.map(user => {
      const newBadge = user.isNew ? wrapIcon(NEW_UNFOLLOWER_SVG, 'New Unfollower') : '';

      return `
      <div class="iu-user-card" id="card-${user.id}">
        <div class="iu-user-info">
          <input type="checkbox" class="iu-user-checkbox" data-id="${user.id}" ${selectedUserIds.has(user.id) ? 'checked' : ''} />
          <img class="iu-avatar" src="${user.profilePicUrl}" alt="${user.username}" />
          <div class="iu-names">
            <div class="iu-username-wrapper">
              <a class="iu-username" href="https://www.instagram.com/${user.username}/" target="_blank">${user.username}</a>
              <div class="iu-card-badges">
                ${user.isVerified ? wrapIcon(VERIFIED_BADGE_SVG, 'Verified') : ''}
                ${user.isPrivate ? wrapIcon(PRIVATE_LOCK_SVG, 'Private Account') : ''}
                ${user.followsViewer ? wrapIcon(FOLLOWS_YOU_SVG, 'Follows you') : wrapIcon(NON_FOLLOWERS_SVG, 'Non-follower')}
                ${newBadge}
              </div>
            </div>
            <span class="iu-fullname">${user.fullName}</span>
          </div>
        </div>
        <button class="iu-unfollow-btn" data-id="${user.id}">Unfollow</button>
      </div>
      `;
    }).join(''));

    syncSelectAllState();
  };

  // Unfollow action
  const triggerUnfollow = async (user: UserNode, btn: HTMLButtonElement) => {
    btn.disabled = true;
    btn.textContent = '...';
    try {
      const res = await unfollowUser(user.id, csrfToken);
      if (res.ok) {
        btn.textContent = 'Unfollowed';
        btn.style.background = 'rgba(255,255,255,0.05)';
        btn.style.color = '#ada79d';

        // Remove from local lists
        activeUsers = activeUsers.filter(u => u.id !== user.id);
        selectedUserIds.delete(user.id);

        // Save to local cache
        setCachedFollowings(dsUserId, activeUsers);

        setTimeout(() => {
          updateUIList();
          updateStatsCounters();
          updateBulkButton();
        }, 800);
      } else {
        if (res.status === 429) {
          alert('Instagram rate limit detected (HTTP 429). Please wait a few minutes before trying to unfollow again.');
        }
        throw new Error('API Error');
      }
    } catch (err) {
      btn.disabled = false;
      btn.textContent = 'Unfollow';
      if (!(err instanceof Error) || err.message !== 'API Error') {
        alert(`Failed to unfollow @${user.username}. Try again later.`);
      }
    }
  };

  // Event Delegation: Checkbox Change Listener
  listEl.addEventListener('change', (e) => {
    const target = e.target as HTMLElement;
    if (target.classList.contains('iu-user-checkbox')) {
      const id = target.getAttribute('data-id')!;
      const isChecked = (target as HTMLInputElement).checked;

      if (isChecked) {
        selectedUserIds.add(id);
      } else {
        selectedUserIds.delete(id);
      }

      updateBulkButton();
      syncSelectAllState();
    }
  });

  // Event Delegation: Unfollow Button Click Listener
  listEl.addEventListener('click', async (e) => {
    const target = e.target as HTMLElement;
    if (target.classList.contains('iu-unfollow-btn')) {
      const id = target.getAttribute('data-id')!;
      const user = activeUsers.find(u => u.id === id);
      if (user) {
        if (confirm(`Are you sure you want to unfollow @${user.username}?`)) {
          await triggerUnfollow(user, target as HTMLButtonElement);
        }
      }
    }
  });

  // Select All visible handler
  selectAllCheck.addEventListener('change', () => {
    const isChecked = selectAllCheck.checked;
    currentFilteredList.forEach(u => {
      if (isChecked) {
        selectedUserIds.add(u.id);
      } else {
        selectedUserIds.delete(u.id);
      }
    });
    listEl.querySelectorAll('.iu-user-checkbox').forEach(cb => {
      const id = cb.getAttribute('data-id')!;
      (cb as HTMLInputElement).checked = selectedUserIds.has(id);
    });
    updateBulkButton();
  });

  // Bulk Progress Button Actions
  pauseBtn.addEventListener('click', () => {
    isBulkPaused = !isBulkPaused;
    pauseBtn.textContent = isBulkPaused ? 'Resume' : 'Pause';
    pauseBtn.style.background = isBulkPaused ? 'linear-gradient(135deg, #f97316, #ec4899, #7c3aed)' : 'rgba(255, 255, 255, 0.08)';
    pauseBtn.style.color = '#fff';
  });

  cancelBtn.addEventListener('click', () => {
    isBulkCancelled = true;
  });

  // Bulk Unfollow Handler
  bulkUnfollowBtn.addEventListener('click', async () => {
    const idsArray = Array.from(selectedUserIds);
    if (idsArray.length === 0) return;

    if (!confirm(`Are you sure you want to unfollow ${idsArray.length} selected accounts?\nThis will process them sequentially with a safe 2-second delay.`)) {
      return;
    }

    const preventExit = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener('beforeunload', preventExit);

    // Initialize state
    isBulkPaused = false;
    isBulkCancelled = false;
    pauseBtn.textContent = 'Pause';
    pauseBtn.style.background = 'rgba(255, 255, 255, 0.08)';
    pauseBtn.style.color = '#fff';

    // Show Progress Banner
    progressBanner.style.display = 'flex';

    // Disable inputs during process
    bulkUnfollowBtn.disabled = true;
    setBulkInputsDisabled(true);

    // Disable all checkbox inputs in the cards
    listEl.querySelectorAll('.iu-user-checkbox').forEach(cb => {
      (cb as HTMLInputElement).disabled = true;
    });

    let successCount = 0;
    let failCount = 0;

    try {
      for (let i = 0; i < idsArray.length; i++) {
        if (isBulkCancelled) {
          break;
        }

        // Handle pause loop
        while (isBulkPaused) {
          if (isBulkCancelled) break;
          await new Promise(resolve => setTimeout(resolve, 250));
        }

        if (isBulkCancelled) {
          break;
        }

        const id = idsArray[i];
        const user = activeUsers.find(u => u.id === id);
        if (!user) continue;

        progressText.textContent = `Unfollowing: ${i + 1} / ${idsArray.length} (@${user.username})`;

        const cardBtn = listEl.querySelector(`.iu-unfollow-btn[data-id="${id}"]`) as HTMLButtonElement;
        if (cardBtn) {
          cardBtn.disabled = true;
          cardBtn.textContent = '...';
        }

        try {
          const res = await unfollowUser(id, csrfToken);

          if (res.ok) {
            successCount++;
            activeUsers = activeUsers.filter(u => u.id !== id);
            selectedUserIds.delete(id);

            if (cardBtn) {
              cardBtn.textContent = 'Unfollowed';
              cardBtn.style.background = 'rgba(255,255,255,0.05)';
              cardBtn.style.color = '#ada79d';
            }
          } else {
            if (res.status === 429) {
              isBulkPaused = true;
              pauseBtn.textContent = 'Resume';
              pauseBtn.style.background = 'linear-gradient(135deg, #f97316, #ec4899, #7c3aed)';
              pauseBtn.style.color = '#fff';

              if (cardBtn) {
                cardBtn.disabled = false;
                cardBtn.textContent = 'Unfollow';
              }

              alert('Instagram rate limit detected (HTTP 429). The bulk unfollow process has been automatically paused. Please wait a few minutes before resuming to avoid account restrictions.');
              i--;
              continue;
            }
            throw new Error('API Fail');
          }
        } catch (err) {
          failCount++;
          if (cardBtn) {
            cardBtn.disabled = false;
            cardBtn.textContent = 'Failed';
          }
        }

        // Save intermediate progress to local cache in case of interruption
        setCachedFollowings(dsUserId, activeUsers);
        updateStatsCounters();

        // Delay to prevent rate limiting, unless it's the last item or cancelled
        if (i < idsArray.length - 1 && !isBulkCancelled) {
          // Generate a random delay between 2.0s and 3.5s to mimic human behavior
          const randomDelay = 2000 + Math.random() * 1500;
          let delayPassed = 0;
          while (delayPassed < randomDelay) {
            if (isBulkCancelled) break;
            while (isBulkPaused) {
              if (isBulkCancelled) break;
              await new Promise(resolve => setTimeout(resolve, 250));
            }
            await new Promise(resolve => setTimeout(resolve, 250));
            delayPassed += 250;
          }
        }
      }
    } finally {
      window.removeEventListener('beforeunload', preventExit);
    }

    // Hide progress banner
    progressBanner.style.display = 'none';

    // Re-enable inputs
    setBulkInputsDisabled(false);

    const actionText = isBulkCancelled ? 'Bulk unfollow cancelled.' : 'Bulk unfollow complete.';
    alert(`${actionText}\nSuccessfully unfollowed: ${successCount}\nFailed: ${failCount}`);

    updateUIList();
    updateStatsCounters();
    updateBulkButton();
  });

  // Change listeners for checkboxes
  nonFollowersCheck.addEventListener('change', () => {
    showNonFollowers = nonFollowersCheck.checked;
    updateUIList();
  });
  followersCheck.addEventListener('change', () => {
    showFollowers = followersCheck.checked;
    updateUIList();
  });
  newUnfollowersCheck.addEventListener('change', () => {
    showNewUnfollowersOnly = newUnfollowersCheck.checked;
    updateUIList();
  });
  verifiedCheck.addEventListener('change', () => {
    showVerified = verifiedCheck.checked;
    updateUIList();
  });
  privateCheck.addEventListener('change', () => {
    showPrivate = privateCheck.checked;
    updateUIList();
  });

  // Toggle custom dropdown
  const sortTrigger = document.getElementById('iu-sort-trigger')!;
  const sortOptions = document.getElementById('iu-sort-options')!;
  const sortTriggerContent = document.getElementById('iu-sort-trigger-content')!;

  sortTrigger.addEventListener('click', (e) => {
    e.stopPropagation();
    sortOptions.classList.toggle('show');
  });

  document.addEventListener('click', () => {
    sortOptions.classList.remove('show');
  });

  const optionMapping: Record<string, string> = {
    'unfollowed-recent': `${NEW_UNFOLLOWER_SVG} Recently Unfollowed`,
    'name-asc': `<span style="display: inline-block; width: 16px; text-align: center; font-size: 0.75rem; font-weight: bold; color: #aaa; vertical-align: middle;">AZ</span> A-Z (Username)`,
    'name-desc': `<span style="display: inline-block; width: 16px; text-align: center; font-size: 0.75rem; font-weight: bold; color: #aaa; vertical-align: middle;">ZA</span> Z-A (Username)`,
    'private-first': `${PRIVATE_LOCK_SVG} Private First`,
    'verified-first': `${VERIFIED_BADGE_SVG} Verified First`
  };

  // Set initial trigger content
  setElementHTML(sortTriggerContent, optionMapping[currentSortBy]);

  // Option select handler
  sortOptions.querySelectorAll('.iu-dropdown-option').forEach(opt => {
    opt.addEventListener('click', () => {
      const val = (opt as HTMLElement).dataset.value!;
      currentSortBy = val;
      setElementHTML(sortTriggerContent, optionMapping[val]);
      sortOptions.classList.remove('show');
      updateUIList();
    });
  });

  // Layout Toggle Handler
  layoutBtn.addEventListener('click', () => {
    isGridView = !isGridView;
    layoutBtn.textContent = isGridView ? 'List View' : 'Grid View';
    listEl.classList.toggle('grid-view', isGridView);
  });

  // Live search handler
  searchInput.addEventListener('input', updateUIList);

  // Export handler (exports LocalStorage cache format)
  exportBtn.addEventListener('click', () => {
    const currentCache = getCachedFollowings(dsUserId);
    const cacheToExport: CacheData = {
      timestamp: currentCache?.timestamp || Date.now(),
      users: activeUsers
    };
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(cacheToExport, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `iu_cache_${dsUserId || 'export'}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  });

  // Import handler (imports LocalStorage cache format with scan animation)
  importBtn.addEventListener('click', () => {
    let fileInput = document.getElementById('iu-import-file-input') as HTMLInputElement;
    if (!fileInput) {
      fileInput = document.createElement('input');
      fileInput.type = 'file';
      fileInput.id = 'iu-import-file-input';
      fileInput.accept = '.json';
      fileInput.style.display = 'none';
      document.body.appendChild(fileInput);
    }

    fileInput.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      loadCacheWithScanAnimation(file, bodyEl, csrfToken, dsUserId, onScanFresh);
      fileInput.value = '';
    };

    fileInput.click();
  });

  // Sidebar New Scan handler
  const sidebarScanBtn = document.getElementById('iu-sidebar-scan-btn') as HTMLButtonElement;
  if (sidebarScanBtn) {
    sidebarScanBtn.addEventListener('click', () => {
      if (onScanFresh) {
        isBulkCancelled = true;
        onScanFresh();
      }
    });
  }

  updateUIList();
  updateStatsCounters();

  return {
    cancelBulk: () => {
      isBulkCancelled = true;
    }
  };
}
