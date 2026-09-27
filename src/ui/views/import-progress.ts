import { setCachedFollowings, validateAndParseCacheData } from '../../storage';
import type { UserNode } from '../../types';
import { setElementHTML } from '../html';
import { renderError } from './error';

export function loadCacheWithScanAnimation(
  file: File,
  bodyEl: HTMLElement,
  dsUserId: string,
  onLoaded: (users: UserNode[]) => void,
  onBack: () => void
) {
  setElementHTML(
    bodyEl,
    `
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
  `
  );

  const scanStatusEl = document.getElementById('iu-scan-status')!;
  const progressBarEl = document.getElementById('iu-progress-bar')!;

  const reader = new FileReader();
  reader.onload = (event) => {
    const content = event.target?.result as string;
    const result = validateAndParseCacheData(content);

    if (result.error || !result.data) {
      renderError(bodyEl, 'Import Failed', result.error ?? 'Unknown error.', { label: 'Back', onClick: onBack });
      return;
    }
    const importedUsers = result.data.users;

    progressBarEl.style.width = '70%';
    scanStatusEl.textContent = `Loading ${importedUsers.length} users from cache...`;

    setCachedFollowings(dsUserId, importedUsers, result.data.timestamp);

    setTimeout(() => {
      progressBarEl.style.width = '100%';
      scanStatusEl.textContent = 'Finalizing list view...';

      setTimeout(() => {
        onLoaded(importedUsers);
      }, 250);
    }, 300);
  };

  reader.onerror = () => {
    renderError(bodyEl, 'Import Failed', 'Unable to read the selected file.', { label: 'Back', onClick: onBack });
  };

  reader.readAsText(file);
}
