import type { UserFilterState } from '../../types';
import { html, query, type SafeHtml } from '../html';
import { ICONS } from '../icons';

export const FANS_HINT = "Accounts that follow you but you don't follow back";

const FILTERS: { key: keyof UserFilterState; id: string; icon: SafeHtml; label: string; title?: string }[] = [
  { key: 'showNewUnfollowersOnly', id: 'new-unfollowers', icon: ICONS.newUnfollower, label: 'New Unfollowers Only' },
  { key: 'showNonFollowers', id: 'nonfollowers', icon: ICONS.nonFollower, label: 'Non-followers' },
  { key: 'showFollowers', id: 'followers', icon: ICONS.followsYou, label: 'Followers' },
  { key: 'showFans', id: 'fans', icon: ICONS.fan, label: 'Fans', title: FANS_HINT },
  { key: 'showVerified', id: 'verified', icon: ICONS.verified, label: 'Show Verified' },
  { key: 'showPrivate', id: 'private', icon: ICONS.private, label: 'Show Private' },
];

export const filterPanelHtml = (state: UserFilterState): SafeHtml => html`
  <div class="iu-filter-list">
    ${FILTERS.map(
      (f) => html`
        <label class="iu-filter-label" ${f.title && html`title="${f.title}"`}>
          <input type="checkbox" id="iu-filter-${f.id}" ${state[f.key] && 'checked'} />
          ${f.icon} ${f.label}
        </label>
      `
    )}
  </div>
`;

// Keep `state` in sync with the checkboxes. Returns them so the view can disable them.
export function setupFilterPanel(root: ParentNode, state: UserFilterState, onChange: () => void): HTMLInputElement[] {
  return FILTERS.map((f) => {
    const input = query<HTMLInputElement>(root, `#iu-filter-${f.id}`);
    input.addEventListener('change', () => {
      state[f.key] = input.checked;
      onChange();
    });
    return input;
  });
}
