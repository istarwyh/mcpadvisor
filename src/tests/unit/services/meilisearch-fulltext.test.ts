import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MeilisearchSearchProvider } from '../../../services/core/search/MeilisearchSearchProvider.js';
import { MemoryCache } from '../../../services/common/cache/memoryCache.js';
import type { GetMcpApiResponse } from '../../../services/common/api/getMcpResourceFetcher.js';

const catalog = {
  filesystem: {
    display_name: 'Filesystem',
    description: 'Read and write local files',
    repository: { url: 'https://github.com/example/filesystem' },
    categories: ['files'],
    tags: ['storage'],
    installations: {},
  },
} as GetMcpApiResponse;

function setup() {
  const fetchData = vi.fn().mockResolvedValue(catalog);
  const indexDocuments = vi.fn().mockResolvedValue(undefined);
  const search = vi.fn().mockResolvedValue({
    hits: [
      {
        id: 'filesystem',
        title: 'Filesystem',
        description: 'Read and write local files',
        github_url: 'https://github.com/example/filesystem',
        _rankingScore: 0.95,
        categories: ['files'],
        tags: ['storage'],
      },
    ],
  });
  const provider = new MeilisearchSearchProvider(
    { fetchData },
    new MemoryCache(60_000),
    { search, indexDocuments },
  );
  return { provider, fetchData, indexDocuments, search };
}

describe('Meilisearch full-text catalog ingestion', () => {
  beforeEach(() => vi.clearAllMocks());

  it('indexes catalog data before searching and requests real ranking scores', async () => {
    const { provider, indexDocuments, search } = setup();
    const results = await provider.search({
      taskDescription: 'files',
      keywords: ['storage'],
    });
    expect(indexDocuments).toHaveBeenCalledWith([
      expect.objectContaining({
        id: 'filesystem',
        categories: ['files'],
        tags: ['storage'],
      }),
    ]);
    expect(indexDocuments.mock.invocationCallOrder[0]).toBeLessThan(
      search.mock.invocationCallOrder[0],
    );
    expect(search).toHaveBeenCalledWith('files storage', {
      limit: 10,
      showRankingScore: true,
    });
    expect(results[0]).toMatchObject({
      similarity: 0.95,
      categories: ['files'],
      tags: ['storage'],
    });
  });

  it('retains a valid zero ranking score', async () => {
    const { provider, search } = setup();
    search.mockResolvedValue({
      hits: [{ id: 'zero', title: 'Zero', _rankingScore: 0 }],
    });
    expect(
      (await provider.search({ taskDescription: 'zero' }))[0].similarity,
    ).toBe(0);
  });

  it('shares ingestion across concurrent searches and a valid cache', async () => {
    const { provider, fetchData, indexDocuments } = setup();
    await Promise.all([
      provider.search({ taskDescription: 'a' }),
      provider.search({ taskDescription: 'b' }),
    ]);
    await provider.search({ taskDescription: 'c' });
    expect(fetchData).toHaveBeenCalledTimes(1);
    expect(indexDocuments).toHaveBeenCalledTimes(1);
  });

  it('retries failed ingestion without caching success or issuing a search', async () => {
    const { provider, fetchData, indexDocuments, search } = setup();
    indexDocuments.mockRejectedValueOnce(new Error('index unavailable'));
    await expect(provider.search({ taskDescription: 'files' })).rejects.toThrow(
      'index unavailable',
    );
    expect(search).not.toHaveBeenCalled();
    await expect(
      provider.search({ taskDescription: 'files' }),
    ).resolves.toHaveLength(1);
    expect(fetchData).toHaveBeenCalledTimes(2);
  });

  it('supports read-only clients without indexing methods', async () => {
    const search = vi.fn().mockResolvedValue({ hits: [] });
    const provider = new MeilisearchSearchProvider(
      { fetchData: async () => catalog },
      undefined,
      { search },
    );
    await expect(
      provider.search({ taskDescription: 'files' }),
    ).resolves.toEqual([]);
  });

  it('skips empty queries and rejects malformed catalogs or search results', async () => {
    const { provider, fetchData, search } = setup();
    expect(await provider.search({ taskDescription: ' ' })).toEqual([]);
    expect(fetchData).not.toHaveBeenCalled();
    fetchData.mockResolvedValueOnce([]);
    await expect(provider.search({ taskDescription: 'files' })).rejects.toThrow(
      'catalog must be an object',
    );
    search.mockResolvedValueOnce({});
    await expect(provider.search({ taskDescription: 'files' })).rejects.toThrow(
      'invalid search response',
    );
  });

  it('makes unsafe catalog IDs indexable and skips incomplete entries', async () => {
    const { provider, fetchData, indexDocuments } = setup();
    fetchData.mockResolvedValue({
      'org/server name': catalog.filesystem,
      broken: { display_name: 'Broken' },
    });
    await provider.search({ taskDescription: 'files' });
    const documents = indexDocuments.mock.calls[0][0];
    expect(documents).toHaveLength(1);
    expect(documents[0].id).toMatch(/^[a-f0-9]{64}$/);
  });
});
