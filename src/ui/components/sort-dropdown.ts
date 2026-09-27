import type { SortOption } from '../../types';
import { html, query, type SafeHtml, setElementHTML } from '../html';
import { ICONS } from '../icons';

const letters = (text: string) => html`<span class="iu-sort-glyph">${text}</span>`;

const SORT_OPTIONS: { value: SortOption; label: SafeHtml }[] = [
  { value: 'unfollowed-recent', label: html`${ICONS.newUnfollower} Recently Unfollowed` },
  { value: 'name-asc', label: html`${letters('AZ')} A-Z (Username)` },
  { value: 'name-desc', label: html`${letters('ZA')} Z-A (Username)` },
  { value: 'private-first', label: html`${ICONS.private} Private First` },
  { value: 'verified-first', label: html`${ICONS.verified} Verified First` },
];

const labelFor = (value: SortOption) => SORT_OPTIONS.find((o) => o.value === value)!.label;

export const sortDropdownHtml = (selected: SortOption): SafeHtml => html`
  <div class="iu-custom-dropdown" id="iu-sort-dropdown">
    <div class="iu-dropdown-trigger" id="iu-sort-trigger">
      <span class="iu-sort-label" id="iu-sort-trigger-content">${labelFor(selected)}</span>
      <span class="iu-arrow" id="iu-sort-arrow">▼</span>
    </div>
    <div class="iu-dropdown-options" id="iu-sort-options">
      ${SORT_OPTIONS.map((o) => html`<div class="iu-dropdown-option" data-value="${o.value}">${o.label}</div>`)}
    </div>
  </div>
`;

export function setupSortDropdown(root: ParentNode, onChange: (sortBy: SortOption) => void) {
  const dropdown = query(root, '#iu-sort-dropdown');
  const trigger = query(root, '#iu-sort-trigger');
  const options = query(root, '#iu-sort-options');
  const triggerContent = query(root, '#iu-sort-trigger-content');
  const arrow = query(root, '#iu-sort-arrow');

  // Single place to open/close the dropdown so the arrow always matches its state
  const setOpen = (open: boolean) => {
    options.classList.toggle('show', open);
    arrow.textContent = open ? '▲' : '▼';
  };

  trigger.addEventListener('click', (e) => {
    e.stopPropagation();
    setOpen(!options.classList.contains('show'));
  });

  // Close on outside clicks; unregister once this view is gone
  const closeOnOutsideClick = () => {
    if (!options.isConnected) {
      document.removeEventListener('click', closeOnOutsideClick);
      return;
    }
    setOpen(false);
  };
  document.addEventListener('click', closeOnOutsideClick);

  options.querySelectorAll<HTMLElement>('.iu-dropdown-option').forEach((opt) => {
    opt.addEventListener('click', () => {
      const value = opt.dataset.value as SortOption;
      setElementHTML(triggerContent, labelFor(value));
      setOpen(false);
      onChange(value);
    });
  });

  return {
    setDisabled(disabled: boolean) {
      dropdown.classList.toggle('is-disabled', disabled);
    },
  };
}
