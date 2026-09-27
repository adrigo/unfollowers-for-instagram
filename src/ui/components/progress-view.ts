import { html, query, type SafeHtml } from '../html';

// Spinner, title, status line and progress bar, shared by scanning and importing
export const progressViewHtml = (options: {
  title: string;
  status: string;
  // Imports jump between a few fixed steps, so they start partway and animate slower
  initialPercent?: number;
  footer?: SafeHtml;
}): SafeHtml => html`
  <div class="iu-scanner-view">
    <div class="iu-spinner"></div>
    <div>
      <h3 class="iu-scanner-title">${options.title}</h3>
      <p class="iu-scanner-status" id="iu-scan-status">${options.status}</p>
    </div>
    <div class="iu-progress-bar-container">
      ${
        options.initialPercent === undefined
          ? html`<div class="iu-progress-bar" id="iu-progress-bar"></div>`
          : html`<div class="iu-progress-bar iu-progress-bar-stepped" id="iu-progress-bar" style="width: ${options.initialPercent}%;"></div>`
      }
    </div>
    ${options.footer}
  </div>
`;

export function setupProgressView(root: ParentNode) {
  const statusEl = query(root, '#iu-scan-status');
  const barEl = query(root, '#iu-progress-bar');
  return {
    setStatus(text: string) {
      statusEl.textContent = text;
    },
    setPercent(percent: number) {
      barEl.style.width = `${Math.round(percent)}%`;
    },
  };
}
