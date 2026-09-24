import type { CacheData } from './types';

export interface ExpectedTotals {
  following?: number;
  followers?: number;
}

// Use the previous scan as the expected size of each list. Followers can only be derived
// from caches that include fans; older caches only know mutual followers, which would
// undercount, so their followers total is left unknown.
export const expectedTotalsFromCache = (cache: CacheData | null): ExpectedTotals => {
  if (!cache || cache.users.length === 0) return {};

  const fans = cache.users.filter((u) => u.isFan).length;
  const following = cache.users.length - fans;
  const followers = cache.users.filter((u) => u.followsViewer).length;

  return {
    following: following > 0 ? following : undefined,
    followers: fans > 0 ? followers : undefined,
  };
};

// Estimated completion (0–1) of one scan phase.
// With an expected total, progress is linear but capped at 95% so a list that grew since
// the last scan doesn't look finished early. Without one, it follows a curve that
// approaches 1 without reaching it. A finished phase is always 1.
export const estimatePhaseShare = (scanned: number, expected: number | undefined, done: boolean): number => {
  if (done) return 1;
  if (expected && expected > 0) return Math.min(scanned / expected, 0.95);
  return 1 - 1 / (1 + scanned / 300);
};

// Share of the overall bar given to the following phase. Instagram returns the whole
// following list (sorted by follow date) in a single response, while followers arrive
// ~25 per page, so nearly all of the waiting happens during the followers phase.
const FOLLOWING_BAR_PERCENT = 5;

// Overall bar width (0–100) for a phase and its estimated completion (0–1).
export const overallProgressPercent = (phase: 'following' | 'followers', phaseShare: number): number =>
  phase === 'following'
    ? phaseShare * FOLLOWING_BAR_PERCENT
    : FOLLOWING_BAR_PERCENT + phaseShare * (100 - FOLLOWING_BAR_PERCENT);
