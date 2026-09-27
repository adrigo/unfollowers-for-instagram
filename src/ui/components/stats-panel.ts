import { countStats, type UserStats } from '../../filters';
import type { UserNode } from '../../types';
import { html, query, type SafeHtml } from '../html';
import { ICONS } from '../icons';
import { FANS_HINT } from './filter-panel';

// `id` is also the .iu-stat-val color modifier
const STATS: { key: keyof UserStats; id: string; icon: SafeHtml; label: string; title?: string }[] = [
  { key: 'newUnfollowers', id: 'new-unfollowers', icon: ICONS.newUnfollower, label: 'New Unfollowers' },
  { key: 'nonFollowers', id: 'non-followers', icon: ICONS.nonFollower, label: 'Non-followers' },
  { key: 'followers', id: 'followers', icon: ICONS.followsYou, label: 'Followers' },
  { key: 'fans', id: 'fans', icon: ICONS.fan, label: 'Fans', title: FANS_HINT },
  { key: 'verified', id: 'verified', icon: ICONS.verified, label: 'Verified' },
  { key: 'private', id: 'private', icon: ICONS.private, label: 'Private' },
];

export const statsPanelHtml = (): SafeHtml => html`
  <div class="iu-stats-vertical">
    ${STATS.map(
      (s) => html`
        <div class="iu-stat-row" ${s.title && html`title="${s.title}"`}>
          <span class="iu-stat-label">${s.icon} ${s.label}</span>
          <span id="iu-stat-${s.id}" class="iu-stat-val ${s.id}">0</span>
        </div>
      `
    )}
  </div>
`;

export function updateStatsPanel(root: ParentNode, users: UserNode[]) {
  const stats = countStats(users);
  for (const s of STATS) {
    query(root, `#iu-stat-${s.id}`).textContent = String(stats[s.key]);
  }
}
