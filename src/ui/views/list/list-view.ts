import { unfollowUser } from '../../../api';
import { filterUsers, sortUsers } from '../../../filters';
import { estimateBulkUnfollowMs, formatCountdown, UNFOLLOW_BREAK_EVERY, UNFOLLOW_BREAK_MS } from '../../../pacing';
import { setCachedFollowings } from '../../../storage';
import type { SortOption, UserFilterState, UserNode } from '../../../types';
import { bulkBannerHtml, setupBulkBanner } from '../../components/bulk-banner';
import { showDialog } from '../../components/dialog';
import { filterPanelHtml, setupFilterPanel } from '../../components/filter-panel';
import { setupSortDropdown, sortDropdownHtml } from '../../components/sort-dropdown';
import { statsPanelHtml, updateStatsPanel } from '../../components/stats-panel';
import { createCardCache, setUnfollowButtonState, syncCardState } from '../../components/user-card';
import { html, query, setElementHTML } from '../../html';
import { BADGE_SPRITE, ICONS } from '../../icons';
import { type BulkUnfollowResult, createBulkUnfollow } from './bulk-unfollow';
import { downloadCacheExport } from './export';

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

  const bulk = createBulkUnfollow();
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
          <input type="text" class="iu-search-input" id="iu-search" placeholder="Username or name..." />
        </div>

        <!-- Full-Width Unfollow Action Button -->
        <div class="iu-sidebar-section iu-unfollow-section">
          <button class="iu-btn-export" id="iu-bulk-unfollow-btn" disabled>Unfollow (0)</button>
        </div>

        <!-- Mobile Drawer Toggle Button (Visible on mobile screens) -->
        <button class="iu-btn-export iu-drawer-toggle-btn" id="iu-drawer-toggle">
          <span>Filters & Options</span>
          <span class="iu-arrow" id="iu-drawer-arrow">▼</span>
        </button>

        <!-- Collapsible Drawer Container (Always visible on desktop, collapsed by default on mobile) -->
        <div class="iu-sidebar-drawer" id="iu-sidebar-drawer">
          <!-- Quick Controls (Grid View, New Scan, Import, Export) -->
          <div class="iu-sidebar-section iu-sidebar-actions">
            <div class="iu-btn-group">
              <button class="iu-btn-export" id="iu-layout-btn">Grid View</button>
              <button class="iu-btn-export" id="iu-sidebar-scan-btn">New Scan</button>
            </div>
            <div class="iu-btn-group">
              <button class="iu-btn-export" id="iu-import-btn">Import</button>
              <button class="iu-btn-export" id="iu-export-btn">Export</button>
            </div>
          </div>

          <div class="iu-sidebar-section">
            <div class="iu-sidebar-title">Sort By:</div>
            ${sortDropdownHtml(currentSortBy)}
          </div>

          <div class="iu-sidebar-section">
            <div class="iu-sidebar-title">Filters:</div>
            ${filterPanelHtml(filterState)}
          </div>

          <div class="iu-sidebar-section iu-stats-section">
            <div class="iu-sidebar-title">Statistics:</div>
            ${statsPanelHtml()}
          </div>
        </div>
      </div>

      <div class="iu-content-area">
        ${bulkBannerHtml()}

        ${notice && html`<div class="iu-scan-warning"><strong>Warning:</strong> ${notice}</div>`}

        <!-- Selection controller & counter -->
        <div class="iu-content-header">
          <label class="iu-filter-label">
            <input type="checkbox" id="iu-select-all" />
            <span class="iu-select-all-text">Select All Visible</span>
          </label>
          <span class="iu-count-text" id="iu-count-text">Loading list...</span>
        </div>

        <!-- The scrollable list view, rendered by updateUIList -->
        <div class="iu-list-container" id="iu-list"></div>
      </div>
    </div>
  `
  );

  const listEl = query(bodyEl, '#iu-list');
  const searchInput = query<HTMLInputElement>(bodyEl, '#iu-search');
  const countTextEl = query(bodyEl, '#iu-count-text');
  const exportBtn = query<HTMLButtonElement>(bodyEl, '#iu-export-btn');
  const layoutBtn = query<HTMLButtonElement>(bodyEl, '#iu-layout-btn');
  const bulkUnfollowBtn = query<HTMLButtonElement>(bodyEl, '#iu-bulk-unfollow-btn');
  const selectAllCheck = query<HTMLInputElement>(bodyEl, '#iu-select-all');

  const filterInputs = setupFilterPanel(bodyEl, filterState, () => updateUIList());
  const sortDropdown = setupSortDropdown(bodyEl, (sortBy) => {
    currentSortBy = sortBy;
    updateUIList();
  });
  const banner = setupBulkBanner(bodyEl, {
    onPauseToggle: () => banner.setPaused(bulk.togglePause()),
    onCancel: () => bulk.cancel(),
  });
  const cards = createCardCache();

  // Filtered reference for exports and bulk actions
  let currentFilteredList: UserNode[] = [];

  const updateBulkButton = () => {
    bulkUnfollowBtn.disabled = selectedUserIds.size === 0;
    bulkUnfollowBtn.textContent = `Unfollow (${selectedUserIds.size})`;
  };

  const setBulkInputsDisabled = (disabled: boolean) => {
    for (const el of [selectAllCheck, searchInput, ...filterInputs, layoutBtn, exportBtn]) {
      el.disabled = disabled;
    }
    sortDropdown.setDisabled(disabled);
  };

  // Fans can't be unfollowed (you don't follow them), so they're never selectable
  const getSelectableVisible = () => currentFilteredList.filter((u) => !u.isFan);

  const syncSelectAllState = () => {
    const selectable = getSelectableVisible();
    selectAllCheck.checked = selectable.length > 0 && selectable.every((u) => selectedUserIds.has(u.id));
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
        <div class="iu-empty-list">
          No users match your criteria.
        </div>
      `
      );
      return;
    }

    // Reuse card elements across renders; only new or changed users are built
    const cardEls = cards.getCards(currentFilteredList);
    const fragment = document.createDocumentFragment();
    currentFilteredList.forEach((user, i) => {
      syncCardState(cardEls[i], selectedUserIds.has(user.id), bulk.isRunning);
      fragment.append(cardEls[i]);
    });
    listEl.replaceChildren(fragment);

    syncSelectAllState();
  };

  const refresh = () => {
    updateUIList();
    updateStatsPanel(bodyEl, activeUsers);
  };

  // After unfollowing, drop the account; if it follows you, it becomes a fan instead
  const applyUnfollow = (id: string) => {
    activeUsers = activeUsers.flatMap((u) => {
      if (u.id !== id) return [u];
      return u.followsViewer ? [{ ...u, isFan: true, isNew: false }] : [];
    });
    selectedUserIds.delete(id);
    cards.delete(id);
  };

  const findCardButton = (id: string) =>
    listEl.querySelector<HTMLButtonElement>(`.iu-unfollow-btn[data-id="${CSS.escape(id)}"]`);

  // Single unfollow from a card's button
  const triggerUnfollow = async (user: UserNode, btn: HTMLButtonElement) => {
    btn.disabled = true;
    setUnfollowButtonState(btn, 'pending');
    try {
      const res = await unfollowUser(user.id);
      if (res.ok) {
        setUnfollowButtonState(btn, 'done');
        applyUnfollow(user.id);
        setCachedFollowings(dsUserId, activeUsers);
        setTimeout(refresh, 800);
      } else {
        if (res.status === 429) {
          showDialog(bodyEl, {
            icon: ICONS.warning,
            title: 'Instagram rate limit reached',
            message: 'Instagram is limiting requests (HTTP 429). Wait a few minutes before trying to unfollow again.',
          });
        }
        throw new Error('API Error');
      }
    } catch (err) {
      btn.disabled = false;
      setUnfollowButtonState(btn, 'ready');
      if (!(err instanceof Error) || err.message !== 'API Error') {
        showDialog(bodyEl, {
          icon: ICONS.warning,
          title: 'Unfollow failed',
          message: `Failed to unfollow @${user.username}. Try again later.`,
        });
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

  // Card checkboxes (delegated)
  listEl.addEventListener('change', (e) => {
    const target = e.target as HTMLElement;
    if (target.classList.contains('iu-user-checkbox')) {
      const id = target.getAttribute('data-id')!;
      if ((target as HTMLInputElement).checked) {
        selectedUserIds.add(id);
      } else {
        selectedUserIds.delete(id);
      }
      updateBulkButton();
      syncSelectAllState();
    }
  });

  // Card Unfollow buttons (delegated)
  listEl.addEventListener('click', async (e) => {
    const target = e.target as HTMLElement;
    if (target.classList.contains('iu-unfollow-btn') && !bulk.isRunning) {
      const user = activeUsers.find((u) => u.id === target.getAttribute('data-id'));
      if (!user) return;
      const confirmed = await showDialog(bodyEl, {
        title: `Unfollow @${user.username}?`,
        message: 'They will be removed from the accounts you follow.',
        confirmLabel: 'Unfollow',
        cancelLabel: 'Cancel',
        danger: true,
      });
      // A bulk run may have started, or the list re-rendered, while the dialog was open
      if (confirmed && !bulk.isRunning && target.isConnected) {
        await triggerUnfollow(user, target as HTMLButtonElement);
      }
    }
  });

  selectAllCheck.addEventListener('change', () => {
    const isChecked = selectAllCheck.checked;
    for (const u of getSelectableVisible()) {
      if (isChecked) {
        selectedUserIds.add(u.id);
      } else {
        selectedUserIds.delete(u.id);
      }
    }
    listEl.querySelectorAll<HTMLInputElement>('.iu-user-checkbox').forEach((cb) => {
      cb.checked = selectedUserIds.has(cb.getAttribute('data-id')!);
    });
    updateBulkButton();
  });

  bulkUnfollowBtn.addEventListener('click', async () => {
    // In selection order, which follows the on-screen sort
    const byId = new Map(activeUsers.map((u) => [u.id, u]));
    const users = [...selectedUserIds].flatMap((id) => byId.get(id) ?? []);
    if (users.length === 0) return;

    const minutes = Math.max(1, Math.round(estimateBulkUnfollowMs(users.length) / 60_000));
    const confirmed = await showDialog(bodyEl, {
      title: `Unfollow ${users.length} selected account${users.length === 1 ? '' : 's'}?`,
      message: html`
        To avoid Instagram flagging your account, they are unfollowed one by one with a few seconds between each
        and a ${Math.round(UNFOLLOW_BREAK_MS.min / 60_000)}–${Math.round(UNFOLLOW_BREAK_MS.max / 60_000)} minute break every ${UNFOLLOW_BREAK_EVERY}.
        This will take about <strong>${minutes} minute${minutes === 1 ? '' : 's'}</strong>. Keep this tab open.
      `,
      confirmLabel: 'Unfollow',
      cancelLabel: 'Cancel',
      danger: true,
    });
    if (!confirmed || bulk.isRunning) return;

    const preventExit = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener('beforeunload', preventExit);

    banner.setPaused(false);
    banner.setVisible(true);
    bulkUnfollowBtn.disabled = true;
    setBulkInputsDisabled(true);
    listEl
      .querySelectorAll<HTMLInputElement | HTMLButtonElement>('.iu-user-checkbox, .iu-unfollow-btn')
      .forEach((el) => {
        el.disabled = true;
      });

    let result: BulkUnfollowResult;
    try {
      result = await bulk.run(users, {
        unfollow: unfollowUser,
        onAttempt: (user, index) => {
          banner.setText(`Unfollowing: ${index + 1} / ${users.length} (@${user.username})`);
          const cardBtn = findCardButton(user.id);
          if (cardBtn) {
            cardBtn.disabled = true;
            setUnfollowButtonState(cardBtn, 'pending');
          }
        },
        onResult: (user, ok) => {
          const cardBtn = findCardButton(user.id);
          if (ok) applyUnfollow(user.id);
          if (cardBtn) setUnfollowButtonState(cardBtn, ok ? 'done' : 'failed');
          // Save progress in case the run is interrupted
          setCachedFollowings(dsUserId, activeUsers);
          updateStatsPanel(bodyEl, activeUsers);
        },
        onRateLimited: (user) => {
          banner.setPaused(true);
          const cardBtn = findCardButton(user.id);
          if (cardBtn) setUnfollowButtonState(cardBtn, 'ready');
          showDialog(bodyEl, {
            icon: ICONS.warning,
            title: 'Paused: Instagram rate limit',
            message:
              'Instagram is limiting requests (HTTP 429), so the bulk unfollow has been paused. Wait a few minutes, then press Resume to avoid account restrictions.',
          });
        },
        onBreak: (remainingMs, done) => {
          banner.setText(
            `Taking a break to avoid Instagram limits: ${formatCountdown(remainingMs)} (${done} / ${users.length} done)`
          );
        },
      });
    } finally {
      window.removeEventListener('beforeunload', preventExit);
    }

    // The overlay was closed or replaced mid-run: nothing left to update
    if (!listEl.isConnected) return;

    banner.setVisible(false);
    setBulkInputsDisabled(false);

    refresh();
    showDialog(bodyEl, {
      title: result.cancelled ? 'Bulk unfollow cancelled' : 'Bulk unfollow complete',
      message: html`Successfully unfollowed: <strong>${result.successCount}</strong><br>Failed: <strong>${result.failCount}</strong>`,
    });
  });

  layoutBtn.addEventListener('click', () => {
    isGridView = !isGridView;
    layoutBtn.textContent = isGridView ? 'List View' : 'Grid View';
    listEl.classList.toggle('grid-view', isGridView);
  });

  // Debounced so typing doesn't re-render the list on every keystroke
  let searchTimer: ReturnType<typeof setTimeout> | undefined;
  searchInput.addEventListener('input', () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(updateUIList, 150);
  });

  exportBtn.addEventListener('click', () => downloadCacheExport(dsUserId, activeUsers));
  query(bodyEl, '#iu-import-btn').addEventListener('click', actions.onImport);
  query(bodyEl, '#iu-sidebar-scan-btn').addEventListener('click', () => {
    bulk.cancel();
    actions.onScanFresh();
  });

  // Mobile drawer toggle
  const sidebarDrawer = query(bodyEl, '#iu-sidebar-drawer');
  const drawerArrow = query(bodyEl, '#iu-drawer-arrow');
  query(bodyEl, '#iu-drawer-toggle').addEventListener('click', () => {
    const isExpanded = sidebarDrawer.classList.toggle('show-mobile');
    drawerArrow.textContent = isExpanded ? '▲' : '▼';
  });

  refresh();

  return { cancelBulk: () => bulk.cancel() };
}
