import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  estimateBulkUnfollowMs,
  formatCountdown,
  nextPageWait,
  nextUnfollowWait,
  SCAN_BREAK_EVERY_PAGES,
  SCAN_BREAK_MS,
  SCAN_PAGE_DELAY_MS,
  UNFOLLOW_BREAK_EVERY,
  UNFOLLOW_BREAK_MS,
  UNFOLLOW_DELAY_MS,
} from '../src/pacing';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('nextUnfollowWait', () => {
  it('waits a few seconds between unfollows', () => {
    for (const processed of [1, 5, UNFOLLOW_BREAK_EVERY - 1]) {
      const { ms, isBreak } = nextUnfollowWait(processed);
      expect(isBreak).toBe(false);
      expect(ms).toBeGreaterThanOrEqual(UNFOLLOW_DELAY_MS.min);
      expect(ms).toBeLessThanOrEqual(UNFOLLOW_DELAY_MS.max);
    }
  });

  it('takes a long break every N unfollows', () => {
    for (const processed of [UNFOLLOW_BREAK_EVERY, UNFOLLOW_BREAK_EVERY * 3]) {
      const { ms, isBreak } = nextUnfollowWait(processed);
      expect(isBreak).toBe(true);
      expect(ms).toBeGreaterThanOrEqual(UNFOLLOW_BREAK_MS.min);
      expect(ms).toBeLessThanOrEqual(UNFOLLOW_BREAK_MS.max);
    }
  });
});

describe('nextPageWait', () => {
  it('pauses briefly between pages and longer every N pages', () => {
    expect(nextPageWait(1).isBreak).toBe(false);
    expect(nextPageWait(1).ms).toBeLessThanOrEqual(SCAN_PAGE_DELAY_MS.max);

    const breakWait = nextPageWait(SCAN_BREAK_EVERY_PAGES);
    expect(breakWait.isBreak).toBe(true);
    expect(breakWait.ms).toBeGreaterThanOrEqual(SCAN_BREAK_MS.min);
  });
});

describe('formatCountdown', () => {
  it.each([
    [0, '0:00'],
    [-500, '0:00'],
    [999, '0:01'],
    [65_000, '1:05'],
    [300_000, '5:00'],
  ])('formats %i ms as %s', (ms, expected) => {
    expect(formatCountdown(ms)).toBe(expected);
  });
});

describe('estimateBulkUnfollowMs', () => {
  it('is zero for a single unfollow', () => {
    expect(estimateBulkUnfollowMs(1)).toBe(0);
  });

  it('adds one long break per completed block of unfollows', () => {
    const avgDelay = (UNFOLLOW_DELAY_MS.min + UNFOLLOW_DELAY_MS.max) / 2;
    const avgBreak = (UNFOLLOW_BREAK_MS.min + UNFOLLOW_BREAK_MS.max) / 2;
    // 11 unfollows: 10 waits, the 10th of which is a break
    expect(estimateBulkUnfollowMs(UNFOLLOW_BREAK_EVERY + 1)).toBe(avgBreak + (UNFOLLOW_BREAK_EVERY - 1) * avgDelay);
  });
});
