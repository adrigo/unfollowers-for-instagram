import { html, query, type SafeHtml } from '../html';

// Progress banner shown while a bulk unfollow runs
export const bulkBannerHtml = (): SafeHtml => html`
  <div id="iu-bulk-progress-banner">
    <span id="iu-bulk-progress-text">Unfollowing: 0/0</span>
    <div class="iu-btn-group">
      <button id="iu-bulk-pause-btn" class="iu-btn-export">Pause</button>
      <button id="iu-bulk-cancel-btn" class="iu-btn-export">Cancel</button>
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
      banner.classList.toggle('is-visible', visible);
    },
    setText(value: string) {
      text.textContent = value;
    },
    setPaused(paused: boolean) {
      pauseBtn.textContent = paused ? 'Resume' : 'Pause';
      pauseBtn.classList.toggle('is-paused', paused);
    },
  };
}
