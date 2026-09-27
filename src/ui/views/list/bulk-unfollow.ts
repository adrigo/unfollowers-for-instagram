import { nextUnfollowWait } from '../../../pacing';
import type { UnfollowResult, UserNode } from '../../../types';

const TICK_MS = 250;
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export interface BulkUnfollowHandlers {
  unfollow: (id: string) => Promise<UnfollowResult>;
  // Before each request, including the retry after a rate limit
  onAttempt: (user: UserNode, index: number) => void;
  onResult: (user: UserNode, ok: boolean) => void;
  // Instagram answered 429: the run has paused itself and retries this user once resumed
  onRateLimited: (user: UserNode) => void;
  // Ticks during a long break (see pacing.ts), after `done` users
  onBreak: (remainingMs: number, done: number) => void;
}

export interface BulkUnfollowResult {
  successCount: number;
  failCount: number;
  cancelled: boolean;
}

// Unfollows users one at a time with pacing waits, and can be paused, resumed or cancelled
// at any point, including mid-wait. Holds no DOM; the list view renders progress from the handlers.
export function createBulkUnfollow() {
  let running = false;
  let paused = false;
  let cancelled = false;

  const waitWhilePaused = async () => {
    while (paused && !cancelled) await sleep(TICK_MS);
  };

  const run = async (users: UserNode[], handlers: BulkUnfollowHandlers): Promise<BulkUnfollowResult> => {
    running = true;
    paused = false;
    cancelled = false;
    let successCount = 0;
    let failCount = 0;

    try {
      for (let i = 0; i < users.length; i++) {
        await waitWhilePaused();
        if (cancelled) break;

        const user = users[i];
        handlers.onAttempt(user, i);

        let result: UnfollowResult | null = null;
        try {
          result = await handlers.unfollow(user.id);
        } catch {
          // Network error: counted as a failure below
        }

        if (result?.status === 429) {
          paused = true;
          handlers.onRateLimited(user);
          i--;
          continue;
        }

        if (result?.ok) successCount++;
        else failCount++;
        handlers.onResult(user, Boolean(result?.ok));

        // Wait before the next unfollow, unless this was the last one
        if (i < users.length - 1) {
          const { ms, isBreak } = nextUnfollowWait(i + 1);
          for (let waited = 0; waited < ms && !cancelled; waited += TICK_MS) {
            await waitWhilePaused();
            if (isBreak) handlers.onBreak(ms - waited, i + 1);
            await sleep(TICK_MS);
          }
        }
      }
    } finally {
      running = false;
    }

    return { successCount, failCount, cancelled };
  };

  return {
    run,
    get isRunning() {
      return running;
    },
    togglePause(): boolean {
      paused = !paused;
      return paused;
    },
    cancel() {
      cancelled = true;
    },
  };
}
