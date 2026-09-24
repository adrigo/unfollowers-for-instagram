// Request pacing. Instagram flags sessions that send private API requests in fast, regular
// bursts, so every loop that talks to it waits a randomized delay between requests and
// takes longer breaks at intervals. Slower, but much less likely to look automated.

export interface Range {
  min: number;
  max: number;
}

export const randomBetween = ({ min, max }: Range): number => min + Math.random() * (max - min);

// Bulk unfollow: a few seconds between unfollows, and a multi-minute break every 10
export const UNFOLLOW_DELAY_MS: Range = { min: 4_000, max: 7_000 };
export const UNFOLLOW_BREAK_EVERY = 10;
export const UNFOLLOW_BREAK_MS: Range = { min: 180_000, max: 300_000 };

// Scanning: a short pause between list pages, and a longer one every 10 pages
export const SCAN_PAGE_DELAY_MS: Range = { min: 300, max: 600 };
export const SCAN_BREAK_EVERY_PAGES = 10;
export const SCAN_BREAK_MS: Range = { min: 5_000, max: 10_000 };

// Wait before the next unfollow, after `processed` unfollows have been attempted
export const nextUnfollowWait = (processed: number): { ms: number; isBreak: boolean } =>
  processed % UNFOLLOW_BREAK_EVERY === 0
    ? { ms: randomBetween(UNFOLLOW_BREAK_MS), isBreak: true }
    : { ms: randomBetween(UNFOLLOW_DELAY_MS), isBreak: false };

// Wait before the next list page, after `pages` pages have been fetched
export const nextPageWait = (pages: number): { ms: number; isBreak: boolean } =>
  pages % SCAN_BREAK_EVERY_PAGES === 0
    ? { ms: randomBetween(SCAN_BREAK_MS), isBreak: true }
    : { ms: randomBetween(SCAN_PAGE_DELAY_MS), isBreak: false };

// "4:05" style countdown for waits shown to the user
export const formatCountdown = (ms: number): string => {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(totalSeconds / 60)}:${String(totalSeconds % 60).padStart(2, '0')}`;
};

// Rough duration of a bulk unfollow, for the confirmation message
export const estimateBulkUnfollowMs = (count: number): number => {
  if (count <= 1) return 0;
  const breaks = Math.floor((count - 1) / UNFOLLOW_BREAK_EVERY);
  const delays = count - 1 - breaks;
  const average = (r: Range) => (r.min + r.max) / 2;
  return breaks * average(UNFOLLOW_BREAK_MS) + delays * average(UNFOLLOW_DELAY_MS);
};
