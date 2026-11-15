import { beforeEach, describe, expect, it, vi } from 'vitest';
import { OfflineSearchProvider } from '../../../../services/core/search/OfflineSearchProvider.js';
import { searchOffline } from '../../../../services/core/search/SearchMcpFactory.js';
import type { MCPServerResponse } from '../../../../types/index.js';

const { engineSearch } = vi.hoisted(() => ({ engineSearch: vi.fn() }));
vi.mock(
  '../../../../services/providers/offline/enhancedMemoryVectorEngine.js',
  () => ({
    EnhancedMemoryVectorEngine: class {
      search = engineSearch;
    },
  }),
);
vi.mock('../../../../utils/embedding.js', () => ({
  getTextEmbedding: vi.fn().mockResolvedValue([1]),
}));

const textRow: MCPServerResponse = {
  id: 'postgres',
  sourceUrl: 'https://example.com/postgres',
  title: 'Postgres',
  description: '',
  similarity: 0,
};

beforeEach(() => {
  engineSearch.mockImplementation(async (vector: number[]) =>
    vector.length
      ? [{ ...textRow, id: 'vector-only', similarity: 0.8 }]
      : [{ ...textRow }],
  );
});

describe('offline search numeric configuration', () => {
  it('keeps the existing defaults when configuration is omitted', async () => {
    const results = await new OfflineSearchProvider().search('Postgres');
    expect(results.find(row => row.id === 'postgres')?.similarity).toBeCloseTo(
      0.315,
    );
    expect(
      results.find(row => row.id === 'vector-only')?.similarity,
    ).toBeCloseTo(0.24);
    expect(engineSearch).toHaveBeenCalledWith([1], 10, {
      minSimilarity: 0.1,
      textQuery: 'Postgres',
    });
  });

  it('passes an explicit zero threshold to the vector engine', async () => {
    await new OfflineSearchProvider({ minSimilarity: 0 }).search('Postgres');
    expect(engineSearch).toHaveBeenCalledWith([1], 10, {
      minSimilarity: 0,
      textQuery: 'Postgres',
    });
  });

  it('keeps zero-score text candidates only when zero is requested', async () => {
    engineSearch.mockImplementation(async (vector: number[]) =>
      vector.length ? [] : [{ ...textRow }],
    );
    expect(await new OfflineSearchProvider().search('zzqxv')).toEqual([]);
    const results = await new OfflineSearchProvider({
      minSimilarity: 0,
    }).search('zzqxv');
    expect(results).toEqual([
      expect.objectContaining({ id: 'postgres', similarity: 0, score: 0 }),
    ]);
  });

  it('preserves a zero threshold through the public offline factory', async () => {
    engineSearch.mockImplementation(async (vector: number[]) =>
      vector.length ? [] : [{ ...textRow }],
    );
    expect(await searchOffline('zzqxv')).toEqual([]);
    expect(engineSearch).toHaveBeenCalledWith([1], 10, {
      minSimilarity: 0.3,
      textQuery: 'zzqxv',
    });
    const results = await searchOffline('zzqxv', { minSimilarity: 0 });
    expect(engineSearch).toHaveBeenCalledWith([1], 10, {
      minSimilarity: 0,
      textQuery: 'zzqxv',
    });
    expect(results).toEqual([
      expect.objectContaining({ id: 'postgres', similarity: 0, score: 0 }),
    ]);
  });

  it('honors a zero text weight without changing the vector default', async () => {
    const results = await new OfflineSearchProvider({
      textMatchWeight: 0,
    }).search('Postgres');
    expect(results.find(row => row.id === 'postgres')?.similarity).toBe(0);
    expect(
      results.find(row => row.id === 'vector-only')?.similarity,
    ).toBeCloseTo(0.24);
  });

  it('honors a zero vector weight without changing the text default', async () => {
    const results = await new OfflineSearchProvider({
      vectorSearchWeight: 0,
    }).search('Postgres');
    expect(results.find(row => row.id === 'vector-only')?.similarity).toBe(0);
    expect(results.find(row => row.id === 'postgres')?.similarity).toBeCloseTo(
      0.315,
    );
  });

  it('honors zero weights for a candidate returned by both paths', async () => {
    engineSearch.mockImplementation(async (vector: number[]) => [
      { ...textRow, similarity: vector.length ? 0.8 : 0 },
    ]);
    const results = await new OfflineSearchProvider({
      textMatchWeight: 0,
      vectorSearchWeight: 0,
    }).search('Postgres');
    expect(results).toEqual([
      expect.objectContaining({ id: 'postgres', similarity: 0, score: 0 }),
    ]);
  });

  it('preserves explicitly configured positive weights', async () => {
    const results = await new OfflineSearchProvider({
      textMatchWeight: 0.2,
      vectorSearchWeight: 0.8,
    }).search('Postgres');
    expect(results.find(row => row.id === 'postgres')?.similarity).toBeCloseTo(
      0.09,
    );
    expect(
      results.find(row => row.id === 'vector-only')?.similarity,
    ).toBeCloseTo(0.64);
  });
});
