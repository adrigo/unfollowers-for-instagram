import { setCachedFollowings, validateAndParseCacheData } from '../../storage';
import type { UserNode } from '../../types';
import { progressViewHtml, setupProgressView } from '../components/progress-view';
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
    progressViewHtml({ title: 'Importing cached data...', status: 'Reading backup file...', initialPercent: 25 })
  );
  const progress = setupProgressView(bodyEl);

  const reader = new FileReader();
  reader.onload = (event) => {
    const content = event.target?.result as string;
    const result = validateAndParseCacheData(content);

    if (result.error || !result.data) {
      renderError(bodyEl, 'Import Failed', result.error ?? 'Unknown error.', { label: 'Back', onClick: onBack });
      return;
    }
    const importedUsers = result.data.users;

    progress.setPercent(70);
    progress.setStatus(`Loading ${importedUsers.length} users from cache...`);

    setCachedFollowings(dsUserId, importedUsers, result.data.timestamp);

    setTimeout(() => {
      progress.setPercent(100);
      progress.setStatus('Finalizing list view...');

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
