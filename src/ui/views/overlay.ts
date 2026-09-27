import { html, query, type SafeHtml, setElementHTML } from '../html';
import { ICONS } from '../icons';

// The overlay card and its header; `content` fills the card below the header
const cardHtml = (appVersion: string, content: SafeHtml, compact = false) => html`
  <div class="iu-card ${compact && 'iu-card-compact'}">
    <div class="iu-header">
      <div class="iu-title-group">
        <div class="iu-logo">${ICONS.appLogo}</div>
        <span class="iu-title">Unfollowers for Instagram</span>
        <span class="iu-version-tag">v${appVersion}</span>
      </div>
      <button class="iu-close-btn" id="iu-close-btn">&times;</button>
    </div>
    ${content}
  </div>
`;

// Render the main card into the overlay and return its body, where views are rendered
export function renderOverlayCard(overlayEl: HTMLElement, appVersion: string, onClose: () => void): HTMLElement {
  setElementHTML(overlayEl, cardHtml(appVersion, html`<div class="iu-body" id="iu-body"></div>`));
  query(overlayEl, '#iu-close-btn').addEventListener('click', onClose);
  return query(overlayEl, '#iu-body');
}

// Shown instead of the main card when there's no Instagram session cookie
export function renderLoginRequired(overlayEl: HTMLElement, appVersion: string, onClose: () => void) {
  setElementHTML(
    overlayEl,
    cardHtml(
      appVersion,
      html`
        <div class="iu-login">
          ${ICONS.lock}
          <div>
            <h3 class="iu-login-title">Login Required</h3>
            <p class="iu-login-text">
              You are currently not logged into Instagram. Please log into your account on this tab first, then launch the scanner again.
            </p>
          </div>
          <button id="iu-login-close-btn" class="iu-btn-export iu-btn-primary iu-btn-login">Got It</button>
        </div>
      `,
      true
    )
  );
  query(overlayEl, '#iu-close-btn').addEventListener('click', onClose);
  query(overlayEl, '#iu-login-close-btn').addEventListener('click', onClose);
}
