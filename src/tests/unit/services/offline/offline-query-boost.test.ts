import { beforeEach, describe, expect, it, vi } from 'vitest';
import { OfflineSearchProvider } from '../../../../services/core/search/OfflineSearchProvider.js';
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

const rows: MCPServerResponse[] = [
  {
    id: 'rednote',
    sourceUrl: 'https://example.com/rednote',
    title: 'RedNote',
    description: 'Social posts',
    similarity: 0,
  },
  {
    id: 'postgres',
    sourceUrl: 'https://example.com/postgres',
    title: 'Postgres',
    description: 'Database queries',
    similarity: 0,
  },
];

beforeEach(() => {
  engineSearch.mockImplementation(async (vector: number[]) =>
    vector.length ? [] : rows.map(row => ({ ...row })),
  );
});

describe('offline product-specific score boost', () => {
  it.each(['zzqxv', 'Postgres', 'weather forecast'])(
    'does not boost RedNote for unrelated query %s',
    async query => {
      const results = await new OfflineSearchProvider({
        minSimilarity: 0.3,
      }).search(query);
      expect(results.some(row => row.id === 'rednote')).toBe(false);
      if (query === 'Postgres')
        expect(results.some(row => row.id === 'postgres')).toBe(true);
    },
  );

  it('does not retain the boost across queries on the same provider', async () => {
    const provider = new OfflineSearchProvider({ minSimilarity: 0.3 });
    expect(
      (await provider.search('RedNote')).some(row => row.id === 'rednote'),
    ).toBe(true);
    expect(
      (await provider.search('zzqxv')).some(row => row.id === 'rednote'),
    ).toBe(false);
  });

  it.each(['小红书', 'RedNote', 'xiaohongshu', 'redbook', 'red note'])(
    'retains the existing boost for %s',
    async query => {
      const results = await new OfflineSearchProvider({
        minSimilarity: 0.3,
      }).search(query);
      expect(
        results.find(row => row.id === 'rednote')?.similarity,
      ).toBeGreaterThan(0.55);
    },
  );
});
