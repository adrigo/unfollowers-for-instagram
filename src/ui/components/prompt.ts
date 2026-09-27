import { html, type SafeHtml } from '../html';

// Centered icon, title, text and a row of buttons; `footer` goes below the buttons.
// Also the content of in-overlay dialogs (see dialog.ts).
export const promptHtml = (options: {
  icon?: SafeHtml;
  title: string;
  text: SafeHtml;
  actions: SafeHtml;
  footer?: SafeHtml;
}): SafeHtml => html`
  <div class="iu-prompt">
    ${options.icon}
    <div>
      <h3 class="iu-prompt-title">${options.title}</h3>
      <p class="iu-prompt-text">${options.text}</p>
    </div>
    <div class="iu-prompt-actions">${options.actions}</div>
    ${options.footer}
  </div>
`;
