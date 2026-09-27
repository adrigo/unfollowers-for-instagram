// HTML building for the overlay. Views are written as html`...` templates: every interpolated
// value is escaped unless it is itself an html`` result or wrapped in raw(), so untrusted text
// (Instagram profile data, imported files, error messages) can't inject markup or event handlers.

// Markup that is safe to insert as-is
export class SafeHtml {
  constructor(readonly value: string) {}
  toString(): string {
    return this.value;
  }
}

export type HtmlValue = SafeHtml | string | number | boolean | null | undefined | readonly HtmlValue[];

const HTML_ESCAPES: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (ch) => HTML_ESCAPES[ch]);
}

// Trusted markup only: bundled SVG assets and strings built by this code, never user data
export const raw = (markup: string): SafeHtml => new SafeHtml(markup);

// false, null and undefined render nothing, so `${cond && html`...`}` works; arrays are joined
const renderValue = (value: HtmlValue): string => {
  if (value instanceof SafeHtml) return value.value;
  if (Array.isArray(value)) return value.map(renderValue).join('');
  if (value === false || value === null || value === undefined) return '';
  return escapeHtml(String(value));
};

export function html(strings: TemplateStringsArray, ...values: HtmlValue[]): SafeHtml {
  let out = strings[0];
  values.forEach((value, i) => {
    out += renderValue(value) + strings[i + 1];
  });
  return new SafeHtml(out);
}

export function setElementHTML(element: HTMLElement, content: SafeHtml) {
  const parsed = new DOMParser().parseFromString(content.value, 'text/html');
  element.replaceChildren(...Array.from(parsed.body.childNodes));
}
