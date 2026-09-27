import { DAILY_SCAN_LIMIT, formatCacheAge, SCAN_COOLDOWN_MS, type ScanWarning } from '../../storage';
import { promptHtml } from '../components/prompt';
import { html, query, setElementHTML } from '../html';
import { ICONS } from '../icons';

// Shown when New Scan is pressed shortly after a previous scan
export function renderScanCooldownPrompt(
  bodyEl: HTMLElement,
  warning: ScanWarning,
  onUseCache: (() => void) | null,
  onScanAnyway: () => void,
  onClose: () => void
) {
  const cooldownHours = SCAN_COOLDOWN_MS / 3_600_000;

  setElementHTML(
    bodyEl,
    promptHtml({
      icon: ICONS.hourglass,
      title: warning.reason === 'recent' ? 'You scanned recently' : 'Many scans today',
      text:
        warning.reason === 'recent'
          ? html`Your last scan started <strong>${formatCacheAge(warning.lastScanTime)}</strong>.
              Scanning again this soon can get your account flagged for automated behavior by Instagram.
              We recommend waiting at least ${cooldownHours} hour between scans.`
          : html`You've already scanned <strong>${warning.scansToday} times</strong> in the last 24 hours
              (last one <strong>${formatCacheAge(warning.lastScanTime)}</strong>).
              Frequent scans can get your account flagged for automated behavior by Instagram.
              We recommend no more than ${DAILY_SCAN_LIMIT} scans a day, at least ${cooldownHours} hour apart.`,
      actions: html`
        ${
          onUseCache
            ? html`<button id="iu-cooldown-cache-btn" class="iu-btn-export iu-btn-primary">Use Cache</button>`
            : html`<button id="iu-cooldown-close-btn" class="iu-btn-export">Close</button>`
        }
        <button id="iu-cooldown-scan-btn" class="iu-btn-export">Scan Anyway</button>
      `,
    })
  );

  if (onUseCache) {
    query(bodyEl, '#iu-cooldown-cache-btn').addEventListener('click', onUseCache);
  } else {
    query(bodyEl, '#iu-cooldown-close-btn').addEventListener('click', onClose);
  }
  query(bodyEl, '#iu-cooldown-scan-btn').addEventListener('click', onScanAnyway);
}
