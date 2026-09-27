import { unfollowUser } from '../../../api';
import { filterUsers, sortUsers } from '../../../filters';
import {
  estimateBulkUnfollowMs,
  formatCountdown,
  nextUnfollowWait,
  UNFOLLOW_BREAK_EVERY,
  UNFOLLOW_BREAK_MS,
} from '../../../pacing';
import { getCachedFollowings, setCachedFollowings } from '../../../storage';
import type { CacheData, SortOption, UserFilterState, UserNode } from '../../../types';
import { html, type SafeHtml, setElementHTML } from '../../html';
import { BADGE_SPRITE, badge, ICONS } from '../../icons';

export interface ListActions {
  onScanFresh: () => void;
  onImport: () => void;
}

export function renderList(
  bodyEl: HTMLElement,
  initialUsers: UserNode[],
  dsUserId: string,
  actions: ListActions,
  notice?: string
): { cancelBulk: () => void } {
  let activeUsers = [...initialUsers];
  const filterState: UserFilterState = {
    showNonFollowers: true,
    showFollowers: false,
    showFans: false,
    showVerified: true,
    showPrivate: true,
    showNewUnfollowersOnly: false,
  };
  let currentSortBy: SortOption = 'unfollowed-recent';
  let isGridView = false;

  // Bulk action states
  let isBulkRunning = false;
  let isBulkPaused = false;
  let isBulkCancelled = false;

  const selectedUserIds = new Set<string>();

  setElementHTML(
    bodyEl,
    html`
    <div class="iu-layout-wrapper">
      ${BADGE_SPRITE}
      <div class="iu-sidebar">
        <!-- Full-Width Search Bar -->
        <div class="iu-sidebar-section iu-search-section">
          <div class="iu-sidebar-title">Search:</div>
          <input type="text" class="iu-search-input" id="iu-search" placeholder="Username or name..." style="width: 100%; box-sizing: border-box;" />
        </div>

        <!-- Full-Width Unfollow Action Button -->
        <div class="iu-sidebar-section iu-unfollow-section">
          <button class="iu-btn-export" id="iu-bulk-unfollow-btn" style="width: 100%; background: #ef4444; border-color: rgba(239, 68, 68, 0.4); text-align: center;" disabled>Unfollow (0)</button>
        </div>

        <!-- Mobile Drawer Toggle Button (Visible on mobile screens) -->
        <button class="iu-btn-export iu-drawer-toggle-btn" id="iu-drawer-toggle">
          <span>Filters & Options</span>
          <span id="iu-drawer-arrow" style="font-size: 0.65rem; color: #888;">▼</span>
        </button>

        <!-- Collapsible Drawer Container (Always visible on desktop, collapsed by default on mobile) -->
        <div class="iu-sidebar-drawer" id="iu-sidebar-drawer">
          <!-- Quick Controls (Grid View, New Scan, Import, Export) -->
          <div class="iu-sidebar-section iu-sidebar-actions">
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
            <div class="iu-sidebar-title">Sort By:</div>
            <div class="iu-custom-dropdown" id="iu-sort-dropdown">
              <div class="iu-dropdown-trigger" id="iu-sort-trigger">
                <span id="iu-sort-trigger-content" style="display: flex; align-items: center; gap: 0.4rem;"></span>
                <span id="iu-sort-arrow" style="font-size: 0.65rem; color: #888;">▼</span>
              </div>
              <div class="iu-dropdown-options" id="iu-sort-options">
                <div class="iu-dropdown-option" data-value="unfollowed-recent">
                  ${ICONS.newUnfollower} Recently Unfollowed
                </div>
                <div class="iu-dropdown-option" data-value="name-asc">
                  <span style="display: inline-block; width: 16px; text-align: center; font-size: 0.75rem; font-weight: bold; color: #aaa; vertical-align: middle;">AZ</span> A-Z (Username)
                </div>
                <div class="iu-dropdown-option" data-value="name-desc">
                  <span style="display: inline-block; width: 16px; text-align: center; font-size: 0.75rem; font-weight: bold; color: #aaa; vertical-align: middle;">ZA</span> Z-A (Username)
                </div>
                <div class="iu-dropdown-option" data-value="private-first">
                  ${ICONS.private} Private First
                </div>
                <div class="iu-dropdown-option" data-value="verified-first">
                  ${ICONS.verified} Verified First
                </div>
              </div>
            </div>
          </div>

          <!-- Filter Checkboxes -->
          <div class="iu-sidebar-section">
            <div class="iu-sidebar-title">Filters:</div>
            <div class="iu-filter-list">
              <label class="iu-filter-label" style="display: flex; align-items: center; gap: 0.35rem;">
                <input type="checkbox" id="iu-filter-new-unfollowers" ${filterState.showNewUnfollowersOnly ? 'checked' : ''} />
                ${ICONS.newUnfollower} New Unfollowers Only
              </label>
              <label class="iu-filter-label" style="display: flex; align-items: center; gap: 0.35rem;">
                <input type="checkbox" id="iu-filter-nonfollowers" ${filterState.showNonFollowers ? 'checked' : ''} />
                ${ICONS.nonFollower} Non-followers
              </label>
              <label class="iu-filter-label" style="display: flex; align-items: center; gap: 0.35rem;">
                <input type="checkbox" id="iu-filter-followers" ${filterState.showFollowers ? 'checked' : ''} />
                ${ICONS.followsYou} Followers
              </label>
              <label class="iu-filter-label" style="display: flex; align-items: center; gap: 0.35rem;" title="Accounts that follow you but you don't follow back">
                <input type="checkbox" id="iu-filter-fans" ${filterState.showFans ? 'checked' : ''} />
                ${ICONS.fan} Fans
              </label>
              <label class="iu-filter-label" style="display: flex; align-items: center; gap: 0.35rem;">
                <input type="checkbox" id="iu-filter-verified" ${filterState.showVerified ? 'checked' : ''} />
                ${ICONS.verified} Show Verified
              </label>
              <label class="iu-filter-label" style="display: flex; align-items: center; gap: 0.35rem;">
                <input type="checkbox" id="iu-filter-private" ${filterState.showPrivate ? 'checked' : ''} />
                ${ICONS.private} Show Private
              </label>
            </div>
          </div>

          <!-- Vertical Stats Dashboard -->
          <div class="iu-sidebar-section" style="border-bottom: none; padding-bottom: 0;">
            <div class="iu-sidebar-title">Statistics:</div>
            <div class="iu-stats-vertical">
              <div class="iu-stat-row">
                <span style="display: flex; align-items: center; gap: 0.35rem;">
                  ${ICONS.newUnfollower} New Unfollowers
                </span>
                <span id="stat-new-unfollowers" class="iu-stat-val new-unfollowers">0</span>
              </div>
              <div class="iu-stat-row">
                <span style="display: flex; align-items: center; gap: 0.35rem;">
                  ${ICONS.nonFollower} Non-followers
                </span>
                <span id="stat-nonfollowers" class="iu-stat-val non-followers">0</span>
              </div>
              <div class="iu-stat-row">
                <span style="display: flex; align-items: center; gap: 0.35rem;">
                  ${ICONS.followsYou} Followers
                </span>
                <span id="stat-followers" class="iu-stat-val followers">0</span>
              </div>
              <div class="iu-stat-row" title="Accounts that follow you but you don't follow back">
                <span style="display: flex; align-items: center; gap: 0.35rem;">
                  ${ICONS.fan} Fans
                </span>
                <span id="stat-fans" class="iu-stat-val fans">0</span>
              </div>
              <div class="iu-stat-row">
                <span style="display: flex; align-items: center; gap: 0.35rem;">
                  ${ICONS.verified} Verified
                </span>
                <span id="stat-verified" class="iu-stat-val verified">0</span>
              </div>
              <div class="iu-stat-row">
                <span style="display: flex; align-items: center; gap: 0.35rem;">
                  ${ICONS.private} Private
                </span>
                <span id="stat-private" class="iu-stat-val private">0</span>
              </div>
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

        ${notice && html`<div class="iu-scan-warning"><strong>Warning:</strong> ${notice}</div>`}

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
  `
  );

  const listEl = document.getElementById('iu-list')!;
  const searchInput = document.getElementById('iu-search') as HTMLInputElement;
  const countTextEl = document.getElementById('iu-count-text')!;
  const exportBtn = document.getElementById('iu-export-btn') as HTMLButtonElement;
  const importBtn = document.getElementById('iu-import-btn') as HTMLButtonElement;
  const layoutBtn = document.getElementById('iu-layout-btn') as HTMLButtonElement;
  const bulkUnfollowBtn = document.getElementById('iu-bulk-unfollow-btn') as HTMLButtonElement;

  const nonFollowersCheck = document.getElementById('iu-filter-nonfollowers') as HTMLInputElement;
  const followersCheck = document.getElementById('iu-filter-followers') as HTMLInputElement;
  const fansCheck = document.getElementById('iu-filter-fans') as HTMLInputElement;
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
    let nonFollowers = 0,
      newUnfollowers = 0,
      followers = 0,
      fans = 0,
      verified = 0,
      privateCount = 0;
    for (const u of activeUsers) {
      // Fans are counted on their own; the other stats describe accounts you follow
      if (u.isFan) {
        fans++;
        continue;
      }
      if (!u.followsViewer) nonFollowers++;
      if (!u.followsViewer && u.isNew) newUnfollowers++;
      if (u.followsViewer) followers++;
      if (u.isVerified) verified++;
      if (u.isPrivate) privateCount++;
    }

    document.getElementById('stat-nonfollowers')!.textContent = String(nonFollowers);
    document.getElementById('stat-new-unfollowers')!.textContent = String(newUnfollowers);
    document.getElementById('stat-followers')!.textContent = String(followers);
    document.getElementById('stat-fans')!.textContent = String(fans);
    document.getElementById('stat-verified')!.textContent = String(verified);
    document.getElementById('stat-private')!.textContent = String(privateCount);
  };

  const updateBulkButton = () => {
    bulkUnfollowBtn.disabled = selectedUserIds.size === 0;
    bulkUnfollowBtn.textContent = `Unfollow (${selectedUserIds.size})`;
  };

  const setBulkInputsDisabled = (disabled: boolean) => {
    [
      selectAllCheck,
      searchInput,
      nonFollowersCheck,
      followersCheck,
      fansCheck,
      newUnfollowersCheck,
      verifiedCheck,
      privateCheck,
      layoutBtn,
      exportBtn,
    ].forEach((el) => {
      (el as HTMLButtonElement | HTMLInputElement).disabled = disabled;
    });
    if (customSortDropdown) {
      customSortDropdown.style.pointerEvents = disabled ? 'none' : 'auto';
      customSortDropdown.style.opacity = disabled ? '0.5' : '1';
    }
  };

  // Fans can't be unfollowed (you don't follow them), so they're never selectable
  const getSelectableVisible = () => currentFilteredList.filter((u) => !u.isFan);

  const syncSelectAllState = () => {
    const selectable = getSelectableVisible();
    const allVisibleSelected = selectable.length > 0 && selectable.every((u) => selectedUserIds.has(u.id));
    selectAllCheck.checked = allVisibleSelected;
  };
  // Card elements by user ID, rebuilt only when the user object changes (e.g. becomes a fan)
  const cardCache = new Map<string, { user: UserNode; el: HTMLElement }>();

  // Static card markup; selection and disabled state are applied by syncCardState
  const renderCardHtml = (user: UserNode): SafeHtml => {
    const newBadge = user.isNew && badge('new-unfollower', 'New Unfollower');

    const { id, username } = user;
    const avatar = user.profilePicUrl
      ? html`<img class="iu-avatar" src="${user.profilePicUrl}" alt="${username}" loading="lazy" decoding="async" />`
      : html`<img class="iu-avatar iu-avatar-fallback" alt="" />`;

    return html`
  <div class="iu-user-card" id="card-${id}">
    <div class="iu-user-info">
      ${
        user.isFan
          ? html`<span class="iu-checkbox-spacer"></span>`
          : html`<input type="checkbox" class="iu-user-checkbox" data-id="${id}" />`
      }
      ${avatar}
      <div class="iu-names">
        <div class="iu-username-wrapper">
          <a class="iu-username" href="https://www.instagram.com/${encodeURIComponent(user.username)}/" target="_blank" rel="noopener noreferrer">${username}</a>
          <div class="iu-card-badges">
            ${user.isVerified && badge('verified', 'Verified')}
            ${user.isPrivate && badge('private', 'Private Account')}
            ${
              user.isFan
                ? badge('fan', "Fan: follows you, you don't follow back")
                : user.followsViewer
                  ? badge('follows-you', 'Follows you')
                  : badge('non-follower', 'Non-follower')
            }
            ${newBadge}
          </div>
        </div>
        <span class="iu-fullname">${user.fullName}</span>
      </div>
    </div>
    ${
      user.isFan
        ? html`<span class="iu-fan-tag">Not following</span>`
        : html`<button class="iu-unfollow-btn" data-id="${id}">Unfollow</button>`
    }
  </div>
  `;
  };

  const needsCard = (user: UserNode) => cardCache.get(user.id)?.user !== user;

  // Build and cache cards for these users, parsing them in one batch
  const buildCards = (users: UserNode[]) => {
    if (users.length === 0) return;
    const parsed = new DOMParser().parseFromString(html`${users.map(renderCardHtml)}`.value, 'text/html');
    const cards = parsed.body.querySelectorAll<HTMLElement>(':scope > .iu-user-card');
    users.forEach((u, i) => {
      // Adopt into the page document now, so showing the card later doesn't pay for it
      cardCache.set(u.id, { user: u, el: document.adoptNode(cards[i]) });
    });
  };

  // Apply state that changes without the user changing
  const syncCardState = (user: UserNode, card: HTMLElement) => {
    const checkbox = card.querySelector<HTMLInputElement>('.iu-user-checkbox');
    if (checkbox) {
      checkbox.checked = selectedUserIds.has(user.id);
      checkbox.disabled = isBulkRunning;
    }
    const button = card.querySelector<HTMLButtonElement>('.iu-unfollow-btn');
    if (button) {
      button.disabled = isBulkRunning;
      // A failed unfollow can be retried after the list refreshes
      if (button.textContent === 'Failed') button.textContent = 'Unfollow';
    }
  };

  const updateUIList = () => {
    currentFilteredList = sortUsers(filterUsers(activeUsers, filterState, searchInput.value), currentSortBy);

    // Unselect accounts hidden by a sidebar filter, so bulk unfollow only acts on what the
    // filters show. Search is ignored here: it only hides cards while typing.
    const matchingFilters = new Set(filterUsers(activeUsers, filterState, '').map((u) => u.id));
    for (const id of selectedUserIds) {
      if (!matchingFilters.has(id)) selectedUserIds.delete(id);
    }
    updateBulkButton();

    // The list mixes accounts you follow with fans, so report both totals separately
    const fanCount = activeUsers.filter((u) => u.isFan).length;
    const followingCount = activeUsers.length - fanCount;
    countTextEl.textContent =
      `Showing ${currentFilteredList.length} of ${activeUsers.length}` +
      (fanCount > 0 ? ` (${followingCount} following + ${fanCount} fans)` : '');

    if (currentFilteredList.length === 0) {
      setElementHTML(
        listEl,
        html`
        <div style="text-align: center; color: #ada79d; padding: 3rem 0;">
          No users match your criteria.
        </div>
      `
      );
      return;
    }

    // Reuse card elements across renders; only new or changed users are built
    buildCards(currentFilteredList.filter(needsCard));

    const fragment = document.createDocumentFragment();
    for (const user of currentFilteredList) {
      const card = cardCache.get(user.id)!.el;
      syncCardState(user, card);
      fragment.append(card);
    }
    listEl.replaceChildren(fragment);

    syncSelectAllState();
  };

  // After unfollowing, drop the account; if it follows you, it becomes a fan instead
  const applyUnfollow = (id: string) => {
    activeUsers = activeUsers.flatMap((u) => {
      if (u.id !== id) return [u];
      return u.followsViewer ? [{ ...u, isFan: true, isNew: false }] : [];
    });
    selectedUserIds.delete(id);
    cardCache.delete(id);
  };

  // Unfollow action
  const triggerUnfollow = async (user: UserNode, btn: HTMLButtonElement) => {
    btn.disabled = true;
    btn.textContent = '...';
    try {
      const res = await unfollowUser(user.id);
      if (res.ok) {
        btn.textContent = 'Unfollowed';
        btn.style.background = 'rgba(255,255,255,0.05)';
        btn.style.color = '#ada79d';

        // Update local lists
        applyUnfollow(user.id);

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

  // Replace broken avatars (expired CDN URLs from old caches or imports) with a placeholder.
  // 'error' does not bubble, so listen in the capture phase.
  listEl.addEventListener(
    'error',
    (e) => {
      const img = e.target;
      if (img instanceof HTMLImageElement && img.classList.contains('iu-avatar')) {
        img.removeAttribute('src');
        img.alt = '';
        img.classList.add('iu-avatar-fallback');
      }
    },
    true
  );

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
    if (target.classList.contains('iu-unfollow-btn') && !isBulkRunning) {
      const id = target.getAttribute('data-id')!;
      const user = activeUsers.find((u) => u.id === id);
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
    getSelectableVisible().forEach((u) => {
      if (isChecked) {
        selectedUserIds.add(u.id);
      } else {
        selectedUserIds.delete(u.id);
      }
    });
    listEl.querySelectorAll('.iu-user-checkbox').forEach((cb) => {
      const id = cb.getAttribute('data-id')!;
      (cb as HTMLInputElement).checked = selectedUserIds.has(id);
    });
    updateBulkButton();
  });

  // Bulk Progress Button Actions
  pauseBtn.addEventListener('click', () => {
    isBulkPaused = !isBulkPaused;
    pauseBtn.textContent = isBulkPaused ? 'Resume' : 'Pause';
    pauseBtn.style.background = isBulkPaused
      ? 'linear-gradient(135deg, #f97316, #ec4899, #7c3aed)'
      : 'rgba(255, 255, 255, 0.08)';
    pauseBtn.style.color = '#fff';
  });

  cancelBtn.addEventListener('click', () => {
    isBulkCancelled = true;
  });

  // Bulk Unfollow Handler
  bulkUnfollowBtn.addEventListener('click', async () => {
    const idsArray = Array.from(selectedUserIds);
    if (idsArray.length === 0) return;

    const minutes = Math.max(1, Math.round(estimateBulkUnfollowMs(idsArray.length) / 60_000));
    if (
      !confirm(
        `Are you sure you want to unfollow ${idsArray.length} selected accounts?\n\n` +
          `To avoid Instagram flagging your account, they are unfollowed one by one with a few seconds between each ` +
          `and a ${Math.round(UNFOLLOW_BREAK_MS.min / 60_000)}–${Math.round(UNFOLLOW_BREAK_MS.max / 60_000)} minute break every ${UNFOLLOW_BREAK_EVERY}. ` +
          `This will take about ${minutes} minute${minutes === 1 ? '' : 's'}. Keep this tab open.`
      )
    ) {
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

    // Disable all checkboxes and single-unfollow buttons in the cards
    isBulkRunning = true;
    listEl.querySelectorAll('.iu-user-checkbox, .iu-unfollow-btn').forEach((el) => {
      (el as HTMLInputElement | HTMLButtonElement).disabled = true;
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
          await new Promise((resolve) => setTimeout(resolve, 250));
        }

        if (isBulkCancelled) {
          break;
        }

        const id = idsArray[i];
        const user = activeUsers.find((u) => u.id === id);
        if (!user) continue;

        progressText.textContent = `Unfollowing: ${i + 1} / ${idsArray.length} (@${user.username})`;

        const cardBtn = listEl.querySelector(`.iu-unfollow-btn[data-id="${id}"]`) as HTMLButtonElement;
        if (cardBtn) {
          cardBtn.disabled = true;
          cardBtn.textContent = '...';
        }

        try {
          const res = await unfollowUser(id);

          if (res.ok) {
            successCount++;
            applyUnfollow(id);

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
                cardBtn.textContent = 'Unfollow';
              }

              alert(
                'Instagram rate limit detected (HTTP 429). The bulk unfollow process has been automatically paused. Please wait a few minutes before resuming to avoid account restrictions.'
              );
              i--;
              continue;
            }
            throw new Error('API Fail');
          }
        } catch {
          failCount++;
          if (cardBtn) {
            cardBtn.textContent = 'Failed';
          }
        }

        // Save intermediate progress to local cache in case of interruption
        setCachedFollowings(dsUserId, activeUsers);
        updateStatsCounters();

        // Wait before the next unfollow (see pacing.ts), unless it's the last item or cancelled
        if (i < idsArray.length - 1 && !isBulkCancelled) {
          const { ms, isBreak } = nextUnfollowWait(i + 1);
          let waited = 0;
          while (waited < ms) {
            if (isBulkCancelled) break;
            while (isBulkPaused) {
              if (isBulkCancelled) break;
              await new Promise((resolve) => setTimeout(resolve, 250));
            }
            if (isBreak) {
              progressText.textContent =
                `Taking a break to avoid Instagram limits: ${formatCountdown(ms - waited)} ` +
                `(${i + 1} / ${idsArray.length} done)`;
            }
            await new Promise((resolve) => setTimeout(resolve, 250));
            waited += 250;
          }
        }
      }
    } finally {
      isBulkRunning = false;
      window.removeEventListener('beforeunload', preventExit);
    }

    // The overlay was closed or replaced mid-run: nothing left to update
    if (!listEl.isConnected) return;

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
    filterState.showNonFollowers = nonFollowersCheck.checked;
    updateUIList();
  });
  followersCheck.addEventListener('change', () => {
    filterState.showFollowers = followersCheck.checked;
    updateUIList();
  });
  fansCheck.addEventListener('change', () => {
    filterState.showFans = fansCheck.checked;
    updateUIList();
  });
  newUnfollowersCheck.addEventListener('change', () => {
    filterState.showNewUnfollowersOnly = newUnfollowersCheck.checked;
    updateUIList();
  });
  verifiedCheck.addEventListener('change', () => {
    filterState.showVerified = verifiedCheck.checked;
    updateUIList();
  });
  privateCheck.addEventListener('change', () => {
    filterState.showPrivate = privateCheck.checked;
    updateUIList();
  });

  // Toggle custom dropdown
  const sortTrigger = document.getElementById('iu-sort-trigger')!;
  const sortOptions = document.getElementById('iu-sort-options')!;
  const sortTriggerContent = document.getElementById('iu-sort-trigger-content')!;
  const sortArrow = document.getElementById('iu-sort-arrow')!;

  // Single place to open/close the dropdown so the arrow always matches its state
  const setSortOpen = (open: boolean) => {
    sortOptions.classList.toggle('show', open);
    sortArrow.textContent = open ? '▲' : '▼';
  };

  sortTrigger.addEventListener('click', (e) => {
    e.stopPropagation();
    setSortOpen(!sortOptions.classList.contains('show'));
  });

  // Close the dropdown on outside clicks; unregister once this view is gone
  const closeSortOptions = () => {
    if (!sortOptions.isConnected) {
      document.removeEventListener('click', closeSortOptions);
      return;
    }
    setSortOpen(false);
  };
  document.addEventListener('click', closeSortOptions);

  const optionMapping: Record<string, SafeHtml> = {
    'unfollowed-recent': html`${ICONS.newUnfollower} Recently Unfollowed`,
    'name-asc': html`<span style="display: inline-block; width: 16px; text-align: center; font-size: 0.75rem; font-weight: bold; color: #aaa; vertical-align: middle;">AZ</span> A-Z (Username)`,
    'name-desc': html`<span style="display: inline-block; width: 16px; text-align: center; font-size: 0.75rem; font-weight: bold; color: #aaa; vertical-align: middle;">ZA</span> Z-A (Username)`,
    'private-first': html`${ICONS.private} Private First`,
    'verified-first': html`${ICONS.verified} Verified First`,
  };

  // Set initial trigger content
  setElementHTML(sortTriggerContent, optionMapping[currentSortBy]);

  // Option select handler
  sortOptions.querySelectorAll('.iu-dropdown-option').forEach((opt) => {
    opt.addEventListener('click', () => {
      const val = (opt as HTMLElement).dataset.value!;
      currentSortBy = val as SortOption;
      setElementHTML(sortTriggerContent, optionMapping[val]);
      setSortOpen(false);
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
  // Debounced so typing doesn't re-render the list on every keystroke
  let searchTimer: ReturnType<typeof setTimeout> | undefined;
  searchInput.addEventListener('input', () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(updateUIList, 150);
  });

  // Export handler (exports LocalStorage cache format)
  exportBtn.addEventListener('click', () => {
    const currentCache = getCachedFollowings(dsUserId);
    const cacheToExport: CacheData = {
      timestamp: currentCache?.timestamp || Date.now(),
      users: activeUsers,
    };
    const dataStr = `data:text/json;charset=utf-8,${encodeURIComponent(JSON.stringify(cacheToExport, null, 2))}`;
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `iu_cache_${dsUserId || 'export'}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  });

  // Import handler (imports LocalStorage cache format with scan animation)
  importBtn.addEventListener('click', actions.onImport);

  // Sidebar New Scan handler
  const sidebarScanBtn = document.getElementById('iu-sidebar-scan-btn') as HTMLButtonElement;
  if (sidebarScanBtn) {
    sidebarScanBtn.addEventListener('click', () => {
      isBulkCancelled = true;
      actions.onScanFresh();
    });
  }

  // Mobile Drawer Toggle handler
  const drawerToggle = document.getElementById('iu-drawer-toggle');
  const sidebarDrawer = document.getElementById('iu-sidebar-drawer');
  const drawerArrow = document.getElementById('iu-drawer-arrow');

  if (drawerToggle && sidebarDrawer) {
    drawerToggle.addEventListener('click', () => {
      const isExpanded = sidebarDrawer.classList.toggle('show-mobile');
      if (drawerArrow) {
        drawerArrow.textContent = isExpanded ? '▲' : '▼';
      }
    });
  }

  updateUIList();
  updateStatsCounters();

  return {
    cancelBulk: () => {
      isBulkCancelled = true;
    },
  };
}
