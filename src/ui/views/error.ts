import { html, query, setElementHTML } from '../html';
import { ICONS } from '../icons';

export function renderError(
  bodyEl: HTMLElement,
  title: string,
  message: string,
  action: { label: string; onClick: () => void }
) {
  setElementHTML(
    bodyEl,
    html`
    <div class="iu-error">
      ${ICONS.warning}
      <h3 class="iu-error-title">${title}</h3>
      <p class="iu-error-text">${message}</p>
      <button id="iu-error-action-btn" class="iu-btn-export iu-btn-primary">${action.label}</button>
    </div>
  `
  );
  query(bodyEl, '#iu-error-action-btn').addEventListener('click', action.onClick);
}
