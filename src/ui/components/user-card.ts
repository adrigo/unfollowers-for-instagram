import type { UserNode } from '../../types';
import { html, type SafeHtml } from '../html';
import { badge } from '../icons';

// Static card markup; selection and disabled state are applied by syncCardState
export const userCardHtml = (user: UserNode): SafeHtml => {
  const { id, username } = user;
  const avatar = user.profilePicUrl
    ? html`<img class="iu-avatar" src="${user.profilePicUrl}" alt="${username}" loading="lazy" decoding="async" />`
    : html`<img class="iu-avatar iu-avatar-fallback" alt="" />`;

  return html`
  <div class="iu-user-card" id="card-${id}">
    <div class="iu-user-info">
      ${
        user.isFan
          ? html`<span class="iu-checkbox-spacer"></span>`
          : html`<input type="checkbox" class="iu-user-checkbox" data-id="${id}" />`
      }
      ${avatar}
      <div class="iu-names">
        <div class="iu-username-wrapper">
          <a class="iu-username" href="https://www.instagram.com/${encodeURIComponent(username)}/" target="_blank" rel="noopener noreferrer">${username}</a>
          <div class="iu-card-badges">
            ${user.isVerified && badge('verified', 'Verified')}
            ${user.isPrivate && badge('private', 'Private Account')}
            ${
              user.isFan
                ? badge('fan', "Fan: follows you, you don't follow back")
                : user.followsViewer
                  ? badge('follows-you', 'Follows you')
                  : badge('non-follower', 'Non-follower')
            }
            ${user.isNew && badge('new-unfollower', 'New Unfollower')}
          </div>
        </div>
        <span class="iu-fullname">${user.fullName}</span>
      </div>
    </div>
    ${
      user.isFan
        ? html`<span class="iu-fan-tag">Not following</span>`
        : html`<button class="iu-unfollow-btn" data-id="${id}">Unfollow</button>`
    }
  </div>
  `;
};

// Card elements by user ID, rebuilt only when the user object changes (e.g. becomes a fan)
export function createCardCache() {
  const cache = new Map<string, { user: UserNode; el: HTMLElement }>();

  // Build and cache cards for these users, parsing them in one batch
  const build = (users: UserNode[]) => {
    if (users.length === 0) return;
    const parsed = new DOMParser().parseFromString(html`${users.map(userCardHtml)}`.value, 'text/html');
    const cards = parsed.body.querySelectorAll<HTMLElement>(':scope > .iu-user-card');
    users.forEach((u, i) => {
      // Adopt into the page document now, so showing the card later doesn't pay for it
      cache.set(u.id, { user: u, el: document.adoptNode(cards[i]) });
    });
  };

  return {
    // Card elements for these users, in order; only new or changed users are built
    getCards(users: UserNode[]): HTMLElement[] {
      build(users.filter((u) => cache.get(u.id)?.user !== u));
      return users.map((u) => cache.get(u.id)!.el);
    },
    delete(id: string) {
      cache.delete(id);
    },
  };
}

type UnfollowButtonState = 'ready' | 'pending' | 'done' | 'failed';
const BUTTON_LABELS: Record<UnfollowButtonState, string> = {
  ready: 'Unfollow',
  pending: '...',
  done: 'Unfollowed',
  failed: 'Failed',
};

// Label of a card's Unfollow button; data-state also styles it. Callers manage `disabled`.
export function setUnfollowButtonState(button: HTMLButtonElement, state: UnfollowButtonState) {
  button.textContent = BUTTON_LABELS[state];
  button.dataset.state = state;
}

// Apply state that changes without the user changing
export function syncCardState(card: HTMLElement, selected: boolean, disabled: boolean) {
  const checkbox = card.querySelector<HTMLInputElement>('.iu-user-checkbox');
  if (checkbox) {
    checkbox.checked = selected;
    checkbox.disabled = disabled;
  }
  const button = card.querySelector<HTMLButtonElement>('.iu-unfollow-btn');
  if (button) {
    button.disabled = disabled;
    // A failed unfollow can be retried after the list refreshes
    if (button.dataset.state === 'failed') setUnfollowButtonState(button, 'ready');
  }
}
