import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { UNFOLLOW_BREAK_EVERY } from '../src/pacing';
import type { UnfollowResult, UserNode } from '../src/types';
import { type BulkUnfollowHandlers, createBulkUnfollow } from '../src/ui/views/list/bulk-unfollow';

const user = (id: string): UserNode => ({
  id,
  username: `user${id}`,
  fullName: '',
  profilePicUrl: '',
  isPrivate: false,
  isVerified: false,
  followsViewer: false,
});
const users = (count: number) => Array.from({ length: count }, (_, i) => user(String(i)));

const OK: UnfollowResult = { ok: true, status: 200 };
const RATE_LIMITED: UnfollowResult = { ok: false, status: 429 };

const handlers = (unfollow: BulkUnfollowHandlers['unfollow'] = async () => OK) => ({
  unfollow: vi.fn(unfollow),
  onAttempt: vi.fn(),
  onResult: vi.fn(),
  onRateLimited: vi.fn(),
  onBreak: vi.fn(),
});

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('createBulkUnfollow', () => {
  it('unfollows every user in order and counts successes and failures', async () => {
    const h = handlers(async (id) => {
      if (id === '1') return { ok: false, status: 500 };
      if (id === '2') throw new Error('network');
      return OK;
    });
    const bulk = createBulkUnfollow();

    const run = bulk.run(users(4), h);
    expect(bulk.isRunning).toBe(true);
    await vi.runAllTimersAsync();

    expect(await run).toEqual({ successCount: 2, failCount: 2, cancelled: false });
    expect(h.unfollow.mock.calls.map(([id]) => id)).toEqual(['0', '1', '2', '3']);
    expect(h.onResult.mock.calls.map(([u, ok]) => [u.id, ok])).toEqual([
      ['0', true],
      ['1', false],
      ['2', false],
      ['3', true],
    ]);
    expect(bulk.isRunning).toBe(false);
  });

  it('pauses on a rate limit and retries the same user once resumed', async () => {
    let calls = 0;
    const h = handlers(async () => (++calls === 1 ? RATE_LIMITED : OK));
    const bulk = createBulkUnfollow();

    const run = bulk.run(users(1), h);
    await vi.advanceTimersByTimeAsync(10_000);

    expect(h.onRateLimited).toHaveBeenCalledOnce();
    expect(h.unfollow).toHaveBeenCalledOnce();
    expect(h.onResult).not.toHaveBeenCalled();

    expect(bulk.togglePause()).toBe(false);
    await vi.runAllTimersAsync();

    expect(await run).toEqual({ successCount: 1, failCount: 0, cancelled: false });
    expect(h.unfollow.mock.calls.map(([id]) => id)).toEqual(['0', '0']);
    expect(h.onAttempt).toHaveBeenCalledTimes(2);
  });

  it('does not send requests while paused', async () => {
    const h = handlers();
    const bulk = createBulkUnfollow();

    const run = bulk.run(users(3), h);
    await vi.advanceTimersByTimeAsync(0);
    expect(h.unfollow).toHaveBeenCalledOnce();

    bulk.togglePause();
    await vi.advanceTimersByTimeAsync(60_000);
    expect(h.unfollow).toHaveBeenCalledOnce();

    bulk.togglePause();
    await vi.runAllTimersAsync();
    expect((await run).successCount).toBe(3);
  });

  it('stops during the wait when cancelled', async () => {
    const h = handlers();
    const bulk = createBulkUnfollow();

    const run = bulk.run(users(3), h);
    await vi.advanceTimersByTimeAsync(0);
    bulk.cancel();
    await vi.runAllTimersAsync();

    expect(await run).toEqual({ successCount: 1, failCount: 0, cancelled: true });
    expect(h.unfollow).toHaveBeenCalledOnce();
  });

  it('stops while paused when cancelled', async () => {
    const h = handlers(async () => RATE_LIMITED);
    const bulk = createBulkUnfollow();

    const run = bulk.run(users(2), h);
    await vi.advanceTimersByTimeAsync(1_000);
    bulk.cancel();
    await vi.runAllTimersAsync();

    expect(await run).toEqual({ successCount: 0, failCount: 0, cancelled: true });
  });

  it(`takes a long break after every ${UNFOLLOW_BREAK_EVERY} unfollows, and not after the last one`, async () => {
    const h = handlers();
    const bulk = createBulkUnfollow();

    const run = bulk.run(users(UNFOLLOW_BREAK_EVERY + 1), h);
    await vi.runAllTimersAsync();
    await run;

    expect(h.onBreak).toHaveBeenCalled();
    expect(new Set(h.onBreak.mock.calls.map(([, done]) => done))).toEqual(new Set([UNFOLLOW_BREAK_EVERY]));
    // The countdown only goes down
    const remaining = h.onBreak.mock.calls.map(([ms]) => ms);
    expect(remaining).toEqual([...remaining].sort((a, b) => b - a));
  });

  it('resets pause and cancel state when a new run starts', async () => {
    const bulk = createBulkUnfollow();
    bulk.cancel();
    bulk.togglePause();

    const h = handlers();
    const run = bulk.run(users(2), h);
    await vi.runAllTimersAsync();

    expect(await run).toEqual({ successCount: 2, failCount: 0, cancelled: false });
  });
});
