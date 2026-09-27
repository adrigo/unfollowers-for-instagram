import CACHE_SYNC_SVG from '../assets/cache-sync.svg';
import FAN_SVG from '../assets/fan.svg';
import FOLLOWS_YOU_SVG from '../assets/follows-you.svg';
import HOURGLASS_SVG from '../assets/hourglass.svg';
import APP_LOGO_SVG from '../assets/icon.svg';
import LOCK_SVG from '../assets/lock.svg';
import NEW_UNFOLLOWER_SVG from '../assets/new-unfollower.svg';
import NON_FOLLOWERS_SVG from '../assets/non-follower.svg';
import PRIVATE_LOCK_SVG from '../assets/private.svg';
import VERIFIED_BADGE_SVG from '../assets/verified.svg';
import WARNING_SVG from '../assets/warning.svg';
import { html, raw, type SafeHtml } from './html';

// Bundled SVG assets, trusted markup for html`` templates
export const ICONS = {
  appLogo: raw(APP_LOGO_SVG),
  cacheSync: raw(CACHE_SYNC_SVG),
  fan: raw(FAN_SVG),
  followsYou: raw(FOLLOWS_YOU_SVG),
  hourglass: raw(HOURGLASS_SVG),
  lock: raw(LOCK_SVG),
  newUnfollower: raw(NEW_UNFOLLOWER_SVG),
  nonFollower: raw(NON_FOLLOWERS_SVG),
  private: raw(PRIVATE_LOCK_SVG),
  verified: raw(VERIFIED_BADGE_SVG),
  warning: raw(WARNING_SVG),
} as const;

// Badge icons shown on list cards. Each is defined once as a <symbol> in BADGE_SPRITE and
// referenced with <use>, so cards don't each carry full copies of the SVG markup.
const BADGE_ICONS = {
  'follows-you': FOLLOWS_YOU_SVG,
  'non-follower': NON_FOLLOWERS_SVG,
  fan: FAN_SVG,
  'new-unfollower': NEW_UNFOLLOWER_SVG,
  verified: VERIFIED_BADGE_SVG,
  private: PRIVATE_LOCK_SVG,
} as const;
type BadgeIcon = keyof typeof BADGE_ICONS;

// Turn a standalone <svg> asset into a <symbol> with the same viewBox and content
const toSymbol = (svg: string, id: string): string => {
  const viewBox = svg.match(/viewBox="([^"]+)"/)?.[1] ?? '0 0 24 24';
  const content = svg.slice(svg.indexOf('>') + 1, svg.lastIndexOf('</svg>'));
  return `<symbol id="${id}" viewBox="${viewBox}">${content}</symbol>`;
};

export const BADGE_SPRITE = raw(
  `<svg class="iu-sprite" aria-hidden="true">${Object.entries(BADGE_ICONS)
    .map(([name, svg]) => toSymbol(svg, `iu-icon-${name}`))
    .join('')}</svg>`
);

export function badge(icon: BadgeIcon, title: string): SafeHtml {
  return html`<span class="iu-badge" title="${title}"><svg width="16" height="16" aria-hidden="true"><use href="#iu-icon-${icon}"/></svg></span>`;
}
