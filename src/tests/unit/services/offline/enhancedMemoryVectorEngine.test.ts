import { afterEach, describe, expect, it, vi } from 'vitest';
import { EnhancedMemoryVectorEngine } from '../../../../services/providers/offline/enhancedMemoryVectorEngine.js';
import { OfflineDataLoader } from '../../../../services/providers/offline/offlineDataLoader.js';
import { WritableInMemoryVectorEngine } from '../../../../services/providers/offline/writableVectorEngine.js';

const entries = ['first', 'second'].map(id => ({
  id,
  vector: [1, 0],
  data: { id, title: id, description: 'test', sourceUrl: '', similarity: 0 },
}));
const deferred = () => {
  let resolve!: () => void;
  const promise = new Promise<void>(done => {
    resolve = done;
  });
  return { promise, resolve };
};

afterEach(() => vi.restoreAllMocks());

describe('offline fallback initialization', () => {
  it('shares a pending cold load and inserts each record once', async () => {
    const gate = deferred();
    const load = vi
      .spyOn(OfflineDataLoader.prototype, 'loadFallbackDataWithEmbeddings')
      .mockImplementation(async () => {
        await gate.promise;
        return entries;
      });
    const add = vi.spyOn(WritableInMemoryVectorEngine.prototype, 'addEntry');
    const engine = new EnhancedMemoryVectorEngine();
    const searches = Array.from({ length: 8 }, () => engine.search([1, 0], 10));
    expect(load).toHaveBeenCalledTimes(1);
    gate.resolve();
    const results = await Promise.all(searches);
    expect(add).toHaveBeenCalledTimes(2);
    for (const result of results)
      expect(result.map(row => row.id)).toEqual(['first', 'second']);
    await engine.search([1, 0]);
    expect(load).toHaveBeenCalledTimes(1);
  });

  it('keeps the insertion stage inside the shared initialization', async () => {
    vi.spyOn(
      OfflineDataLoader.prototype,
      'loadFallbackDataWithEmbeddings',
    ).mockResolvedValue(entries);
    const gate = deferred();
    const originalAdd = WritableInMemoryVectorEngine.prototype.addEntry;
    const add = vi
      .spyOn(WritableInMemoryVectorEngine.prototype, 'addEntry')
      .mockImplementation(async function (
        this: WritableInMemoryVectorEngine,
        ...args
      ) {
        await gate.promise;
        return originalAdd.apply(this, args);
      });
    const engine = new EnhancedMemoryVectorEngine();
    const first = engine.search([1, 0]);
    await vi.waitFor(() => expect(add).toHaveBeenCalledTimes(1));
    const second = engine.search([1, 0]);
    gate.resolve();
    expect(await first).toEqual(await second);
    expect(add).toHaveBeenCalledTimes(2);
  });

  it('waits for pending insertion before clearing and reloading the full batch', async () => {
    const load = vi
      .spyOn(OfflineDataLoader.prototype, 'loadFallbackDataWithEmbeddings')
      .mockResolvedValue(entries);
    const gate = deferred();
    const originalAdd = WritableInMemoryVectorEngine.prototype.addEntry;
    let inserted = 0;
    vi.spyOn(
      WritableInMemoryVectorEngine.prototype,
      'addEntry',
    ).mockImplementation(async function (
      this: WritableInMemoryVectorEngine,
      ...args
    ) {
      await originalAdd.apply(this, args);
      if (++inserted === 1) await gate.promise;
    });
    const engine = new EnhancedMemoryVectorEngine();
    const search = engine.search([1, 0]);
    await vi.waitFor(() => expect(inserted).toBe(1));
    const cleared = engine.clear();
    gate.resolve();
    await Promise.all([search, cleared]);
    expect((await engine.search([1, 0])).map(row => row.id)).toEqual([
      'first',
      'second',
    ]);
    expect(load).toHaveBeenCalledTimes(2);
  });

  it('preserves failed-load cooldown and later loader invocation', async () => {
    let now = 1000;
    vi.spyOn(Date, 'now').mockImplementation(() => now);
    const load = vi
      .spyOn(OfflineDataLoader.prototype, 'loadFallbackDataWithEmbeddings')
      .mockRejectedValueOnce(new Error('fixture failure'))
      .mockResolvedValue(entries);
    const engine = new EnhancedMemoryVectorEngine();
    await Promise.all([engine.search([1, 0]), engine.search([1, 0])]);
    await engine.search([1, 0]);
    expect(load).toHaveBeenCalledTimes(1);
    now += 3600001;
    await Promise.all([engine.search([1, 0]), engine.search([1, 0])]);
    expect(load).toHaveBeenCalledTimes(2);
  });

  it('shares expired refresh without reinserting existing entries', async () => {
    let now = 1000;
    vi.spyOn(Date, 'now').mockImplementation(() => now);
    const load = vi
      .spyOn(OfflineDataLoader.prototype, 'loadFallbackDataWithEmbeddings')
      .mockResolvedValue(entries);
    const add = vi.spyOn(WritableInMemoryVectorEngine.prototype, 'addEntry');
    const engine = new EnhancedMemoryVectorEngine();
    await engine.search([1, 0]);
    now += 3600001;
    await Promise.all([engine.search([1, 0]), engine.search([1, 0])]);
    expect(load).toHaveBeenCalledTimes(2);
    expect(add).toHaveBeenCalledTimes(2);
  });

  it('reloads after a completed clear and path change', async () => {
    const load = vi
      .spyOn(OfflineDataLoader.prototype, 'loadFallbackDataWithEmbeddings')
      .mockResolvedValue(entries);
    const engine = new EnhancedMemoryVectorEngine();
    await engine.search([1, 0]);
    await engine.clear();
    expect((await engine.search([1, 0])).map(row => row.id)).toEqual([
      'first',
      'second',
    ]);
    expect(load).toHaveBeenCalledTimes(2);
    engine.setFallbackDataPath('/fixture/next.json');
    await engine.search([1, 0]);
    expect(load).toHaveBeenCalledTimes(3);
  });
});
