import { html, query, type SafeHtml } from '../html';

// Progress banner shown while a bulk unfollow runs
export const bulkBannerHtml = (): SafeHtml => html`
  <div id="iu-bulk-progress-banner">
    <span id="iu-bulk-progress-text" style="font-weight: 600;">Unfollowing: 0/0</span>
    <div class="iu-btn-group" style="width: auto;">
      <button id="iu-bulk-pause-btn" class="iu-btn-export" style="padding: 0.35rem 0.75rem; font-size: 0.8rem; background: rgba(255, 255, 255, 0.08); border-radius: 6px;">Pause</button>
      <button id="iu-bulk-cancel-btn" class="iu-btn-export" style="padding: 0.35rem 0.75rem; font-size: 0.8rem; background: #ef4444; border: none; border-radius: 6px;">Cancel</button>
    </div>
  </div>
`;

export function setupBulkBanner(root: ParentNode, handlers: { onPauseToggle: () => void; onCancel: () => void }) {
  const banner = query(root, '#iu-bulk-progress-banner');
  const text = query(root, '#iu-bulk-progress-text');
  const pauseBtn = query(root, '#iu-bulk-pause-btn');

  pauseBtn.addEventListener('click', handlers.onPauseToggle);
  query(root, '#iu-bulk-cancel-btn').addEventListener('click', handlers.onCancel);

  return {
    setVisible(visible: boolean) {
      banner.style.display = visible ? 'flex' : 'none';
    },
    setText(value: string) {
      text.textContent = value;
    },
    setPaused(paused: boolean) {
      pauseBtn.textContent = paused ? 'Resume' : 'Pause';
      pauseBtn.style.background = paused
        ? 'linear-gradient(135deg, #f97316, #ec4899, #7c3aed)'
        : 'rgba(255, 255, 255, 0.08)';
      pauseBtn.style.color = '#fff';
    },
  };
}
