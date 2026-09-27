import { describe, expect, it } from 'vitest';
import { escapeHtml, html, raw, SafeHtml } from '../src/ui/html';

describe('escapeHtml', () => {
  it('escapes the five HTML special characters', () => {
    expect(escapeHtml(`<a href="x" title='y'>&</a>`)).toBe(
      '&lt;a href=&quot;x&quot; title=&#39;y&#39;&gt;&amp;&lt;/a&gt;'
    );
  });

  it('leaves plain text unchanged', () => {
    expect(escapeHtml('user_name.123')).toBe('user_name.123');
  });
});

describe('html', () => {
  it('escapes interpolated strings', () => {
    const name = '<img src=x onerror=alert(1)>';
    expect(html`<b>${name}</b>`.value).toBe('<b>&lt;img src=x onerror=alert(1)&gt;</b>');
  });

  it('escapes quotes so values cannot break out of attributes', () => {
    const title = '" onmouseover="alert(1)';
    expect(html`<span title="${title}"></span>`.value).toBe('<span title="&quot; onmouseover=&quot;alert(1)"></span>');
  });

  it('inserts raw() and nested html`` results without escaping', () => {
    const icon = raw('<svg></svg>');
    const inner = html`<i>${'a&b'}</i>`;
    expect(html`${icon}${inner}`.value).toBe('<svg></svg><i>a&amp;b</i>');
  });

  it('joins arrays, escaping each string item', () => {
    expect(html`<ul>${['<a>', html`<li>b</li>`]}</ul>`.value).toBe('<ul>&lt;a&gt;<li>b</li></ul>');
  });

  it('renders false, null and undefined as nothing', () => {
    expect(html`[${false}${null}${undefined}]`.value).toBe('[]');
  });

  it('renders numbers and true as text', () => {
    expect(html`${42} ${true}`.value).toBe('42 true');
  });

  it('returns SafeHtml that stringifies to its markup', () => {
    const result = html`<p>${'x'}</p>`;
    expect(result).toBeInstanceOf(SafeHtml);
    expect(`${result}`).toBe('<p>x</p>');
  });
});
