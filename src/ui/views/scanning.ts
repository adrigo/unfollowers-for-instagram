import { progressViewHtml, setupProgressView } from '../components/progress-view';
import { html, setElementHTML } from '../html';

// Shown while a scan runs; returns controls for its status line and progress bar
export function renderScanning(bodyEl: HTMLElement) {
  setElementHTML(
    bodyEl,
    progressViewHtml({
      title: 'Analyzing your account...',
      status: 'Scanning following list...',
      footer: html`
        <div class="iu-callout iu-callout-info">
          <strong>Heads up:</strong> Instagram may flag accounts that scan or unfollow too often as automated and show a warning or temporarily restrict them. Scan occasionally (no more than a few times a day) and unfollow in moderation. The scan paces itself and takes short breaks, so it can take a minute.
        </div>
      `,
    })
  );
  return setupProgressView(bodyEl);
}
