import WARNING_SVG from '../../assets/warning.svg';
import { escapeHtml, setElementHTML } from '../html';

export function renderError(
  bodyEl: HTMLElement,
  title: string,
  message: string,
  action: { label: string; onClick: () => void }
) {
  setElementHTML(
    bodyEl,
    `
    <div style="text-align: center; margin: auto; padding: 2rem;">
      ${WARNING_SVG}
      <h3 style="margin: 1rem 0; color: #f87171;">${escapeHtml(title)}</h3>
      <p style="color: #ada79d; margin-bottom: 1.5rem; line-height: 1.5; max-width: 320px; margin-left: auto; margin-right: auto;">${escapeHtml(message)}</p>
      <button id="iu-error-action-btn" class="iu-btn-export" style="background: linear-gradient(135deg, #f97316, #ec4899, #7c3aed); color: #fff; border: none;">${escapeHtml(action.label)}</button>
    </div>
  `
  );
  document.getElementById('iu-error-action-btn')?.addEventListener('click', action.onClick);
}
