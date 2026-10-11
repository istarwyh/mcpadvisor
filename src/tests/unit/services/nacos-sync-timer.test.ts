import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { McpManager } from '../../../services/providers/nacos/NacosMcpManager.js';
import type { NacosClient } from '../../../services/providers/nacos/NacosClient.js';
import type { VectorDB } from '../../../services/common/vector/VectorDB.js';
import logger from '../../../utils/logger.js';

// Node's imported timer bindings are separate from Vitest's fake globals.
// Keep the production node:timers API and route this test boundary to the clock.
vi.mock('node:timers', () => ({
  setInterval: (...args: Parameters<typeof globalThis.setInterval>) =>
    globalThis.setInterval(...args),
  clearInterval: (...args: Parameters<typeof globalThis.clearInterval>) =>
    globalThis.clearInterval(...args),
}));

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
});

function createManager() {
  const getAllServices = vi.fn().mockResolvedValue([]);
  const updateData = vi.fn();
  const manager = new McpManager(
    { getAllServices } as unknown as NacosClient,
    { updateData } as unknown as VectorDB,
    5000,
  );
  return { manager, getAllServices, updateData };
}

describe('Nacos sync timer lifecycle', () => {
  it('syncs immediately, repeats at the configured interval and stops cleanly', async () => {
    const { manager, getAllServices, updateData } = createManager();
    await manager.startSync();
    expect(getAllServices).toHaveBeenCalledTimes(1);
    expect(updateData).toHaveBeenCalledWith([], [], []);
    await vi.advanceTimersByTimeAsync(4999);
    expect(getAllServices).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(getAllServices).toHaveBeenCalledTimes(2);
    await manager.stopSync();
    await manager.stopSync();
    expect(vi.getTimerCount()).toBe(0);
    await vi.advanceTimersByTimeAsync(10000);
    expect(getAllServices).toHaveBeenCalledTimes(2);
  });

  it('handles a periodic failure and keeps later sync attempts active', async () => {
    const { manager, getAllServices } = createManager();
    await manager.startSync();
    const failure = new Error('Nacos temporarily unavailable');
    getAllServices.mockRejectedValueOnce(failure);
    await vi.advanceTimersByTimeAsync(5000);
    expect(logger.error).toHaveBeenCalledWith(
      'Error during periodic sync:',
      failure,
    );
    await vi.advanceTimersByTimeAsync(5000);
    expect(getAllServices).toHaveBeenCalledTimes(3);
    await manager.stopSync();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('does not schedule a timer when the initial sync fails', async () => {
    const { manager, getAllServices } = createManager();
    getAllServices.mockRejectedValueOnce(new Error('Initial sync failed'));
    await expect(manager.startSync()).rejects.toThrow('Initial sync failed');
    expect(vi.getTimerCount()).toBe(0);
  });
});
