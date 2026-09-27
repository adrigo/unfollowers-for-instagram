import HOURGLASS_SVG from '../../assets/hourglass.svg';
import { DAILY_SCAN_LIMIT, formatCacheAge, SCAN_COOLDOWN_MS, type ScanWarning } from '../../storage';
import { escapeHtml, setElementHTML } from '../html';

// Shown when New Scan is pressed shortly after a previous scan
export function renderScanCooldownPrompt(
  bodyEl: HTMLElement,
  warning: ScanWarning,
  onUseCache: (() => void) | null,
  onScanAnyway: () => void,
  onClose: () => void
) {
  const primaryButton = onUseCache
    ? `<button id="iu-cooldown-cache-btn" class="iu-btn-export" style="flex: 1; background: linear-gradient(135deg, #f97316, #ec4899, #7c3aed); color: #fff; border: none; font-weight: 700; height: 42px; border-radius: 10px;">Use Cache</button>`
    : `<button id="iu-cooldown-close-btn" class="iu-btn-export" style="flex: 1; height: 42px; border-radius: 10px;">Close</button>`;

  setElementHTML(
    bodyEl,
    `
    <div style="text-align: center; margin: auto; padding: 2.5rem; display: flex; flex-direction: column; gap: 1.5rem; align-items: center; justify-content: center; height: 100%;">
      ${HOURGLASS_SVG}
      <div>
        <h3 style="margin-bottom: 0.5rem; font-weight: 600; font-size: 1.3rem;">${
          warning.reason === 'recent' ? 'You scanned recently' : 'Many scans today'
        }</h3>
        <p style="color: #ada79d; font-size: 0.9rem; line-height: 1.5; max-width: 380px;">
          ${
            warning.reason === 'recent'
              ? `Your last scan started <strong>${escapeHtml(formatCacheAge(warning.lastScanTime))}</strong>.
                 Scanning again this soon can get your account flagged for automated behavior by Instagram.
                 We recommend waiting at least ${SCAN_COOLDOWN_MS / 3_600_000} hour between scans.`
              : `You've already scanned <strong>${warning.scansToday} times</strong> in the last 24 hours
                 (last one <strong>${escapeHtml(formatCacheAge(warning.lastScanTime))}</strong>).
                 Frequent scans can get your account flagged for automated behavior by Instagram.
                 We recommend no more than ${DAILY_SCAN_LIMIT} scans a day, at least ${SCAN_COOLDOWN_MS / 3_600_000} hour apart.`
          }
        </p>
      </div>
      <div style="display: flex; gap: 0.5rem; width: 100%; max-width: 380px;">
        ${primaryButton}
        <button id="iu-cooldown-scan-btn" class="iu-btn-export" style="flex: 1; height: 42px; border-radius: 10px;">Scan Anyway</button>
      </div>
    </div>
  `
  );

  if (onUseCache) {
    document.getElementById('iu-cooldown-cache-btn')!.addEventListener('click', onUseCache);
  } else {
    document.getElementById('iu-cooldown-close-btn')!.addEventListener('click', onClose);
  }
  document.getElementById('iu-cooldown-scan-btn')!.addEventListener('click', onScanAnyway);
}
