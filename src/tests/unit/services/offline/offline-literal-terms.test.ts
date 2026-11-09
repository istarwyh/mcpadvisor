import { afterEach, describe, expect, it, vi } from 'vitest';
import { EnhancedMemoryVectorEngine } from '../../../../services/providers/offline/enhancedMemoryVectorEngine.js';
import { OfflineDataLoader } from '../../../../services/providers/offline/offlineDataLoader.js';
import logger from '../../../../utils/logger.js';

vi.mock('../../../../utils/embedding.js', () => ({
  getTextEmbedding: vi.fn().mockResolvedValue([1, 0]),
}));

afterEach(() => vi.restoreAllMocks());

describe('offline text query terms are literal text', () => {
  it.each([
    ['C++', 'C++', 'CCC'],
    ['Node.js', 'Node.js', 'NodeXjs'],
    ['[abc]', '[abc]', 'abc'],
    ['foo(bar)', 'foo(bar)', 'foobar'],
    ['foo|bar', 'foo|bar', 'foo'],
    ['foo*', 'foo*', 'fooooo'],
    ['foo?', 'foo?', 'foo'],
    ['^foo$', '^foo$', 'foo'],
    ['{foo}', '{foo}', 'foo'],
    ['foo\\\\bar', 'foo\\\\bar', 'foobar'],
  ])(
    'matches %s without regex syntax or wildcard behavior',
    async (query, literal, other) => {
      vi.spyOn(
        OfflineDataLoader.prototype,
        'loadFallbackDataWithEmbeddings',
      ).mockResolvedValue(
        [literal, other].map((title, index) => ({
          id: String(index),
          vector: [1, 0],
          data: {
            id: String(index),
            title,
            description: '',
            sourceUrl: `https://example.com/${index}`,
            similarity: 0,
          },
        })),
      );
      // An orthogonal vector isolates the real engine's text contribution.
      const results = await new EnhancedMemoryVectorEngine().search(
        [0, 1],
        10,
        {
          textQuery: query,
        },
      );
      expect(results.find(row => row.id === '0')?.similarity).toBeCloseTo(0.03);
      expect(results.find(row => row.id === '1')?.similarity).toBe(0);
      expect(logger.error).not.toHaveBeenCalled();
    },
  );

  it('preserves case-insensitive, repeated, and multi-term scoring', async () => {
    vi.spyOn(
      OfflineDataLoader.prototype,
      'loadFallbackDataWithEmbeddings',
    ).mockResolvedValue([
      {
        id: 'postgres',
        vector: [1, 0],
        data: {
          id: 'postgres',
          title: 'Postgres POSTGRES',
          description: 'Database',
          categories: ['database'],
          tags: ['Postgres'],
          sourceUrl: 'https://example.com/postgres',
          similarity: 0,
        },
      },
    ]);
    const results = await new EnhancedMemoryVectorEngine().search([0, 1], 10, {
      textQuery: 'pOsTgReS DATABASE',
    });
    expect(results[0].similarity).toBeCloseTo(0.15);
  });
});
