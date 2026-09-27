import { html, query, type SafeHtml, setElementHTML } from '../html';
import { promptHtml } from './prompt';

export interface DialogOptions {
  title: string;
  message: SafeHtml | string;
  icon?: SafeHtml;
  // Without a cancel label the dialog is a message with a single button
  confirmLabel?: string;
  cancelLabel?: string;
  // Red confirm button, for unfollowing
  danger?: boolean;
}

// Close function of the dialog open in each view, so a new one replaces it
const openDialogs = new WeakMap<HTMLElement, (confirmed: boolean) => void>();

// Show a dialog over the view rendered in `root` (the overlay body) without blocking the page.
// Resolves true when confirmed, false when cancelled or replaced by another dialog. It goes away
// with the view, since rendering the next view replaces everything in `root`.
export function showDialog(root: HTMLElement, options: DialogOptions): Promise<boolean> {
  openDialogs.get(root)?.(false);

  const dialog = document.createElement('div');
  dialog.className = 'iu-dialog';
  dialog.setAttribute('role', options.cancelLabel ? 'alertdialog' : 'dialog');
  dialog.setAttribute('aria-modal', 'true');
  dialog.setAttribute('aria-label', options.title);
  setElementHTML(
    dialog,
    html`
      <div class="iu-dialog-panel iu-dialog-content">
        ${promptHtml({
          icon: options.icon,
          title: options.title,
          text: typeof options.message === 'string' ? html`${options.message}` : options.message,
          actions: html`
            ${options.cancelLabel && html`<button class="iu-btn-export" data-dialog-cancel>${options.cancelLabel}</button>`}
            <button class="iu-btn-export ${options.danger ? 'iu-btn-danger' : 'iu-btn-primary'}" data-dialog-confirm>
              ${options.confirmLabel ?? 'OK'}
            </button>
          `,
        })}
      </div>
    `
  );
  root.appendChild(dialog);

  return new Promise((resolve) => {
    const close = (confirmed: boolean) => {
      openDialogs.delete(root);
      dialog.remove();
      resolve(confirmed);
    };
    openDialogs.set(root, close);

    query(dialog, '[data-dialog-confirm]').addEventListener('click', () => close(true));
    dialog.querySelector('[data-dialog-cancel]')?.addEventListener('click', () => close(false));
    dialog.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') close(false);
    });
    // Enter confirms, as it did with the browser's dialogs
    query<HTMLButtonElement>(dialog, '[data-dialog-confirm]').focus();
  });
}
