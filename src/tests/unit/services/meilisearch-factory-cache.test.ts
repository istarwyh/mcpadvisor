import { expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  fetches: vi.fn(),
  writes: vi.fn(),
  searches: vi.fn(),
}));
vi.mock('../../../services/core/search/OfflineSearchProvider.js', () => ({
  OfflineSearchProvider: class {
    async search() {
      return [];
    }
  },
}));
vi.mock('../../../services/common/api/getMcpResourceFetcher.js', () => ({
  GetMcpResourceFetcher: class {
    async fetchData() {
      state.fetches();
      return {
        files: {
          display_name: 'Files',
          repository: { url: 'https://github.com/example/files' },
        },
      };
    }
  },
}));
vi.mock('../../../services/providers/meilisearch/controller.js', () => ({
  meilisearchClient: {},
  FailoverMeilisearchClient: class {
    async indexDocuments() {
      state.writes();
    }
    async search() {
      state.searches();
      return {
        hits: [
          {
            id: 'files',
            title: 'Files',
            description: 'Files',
            github_url: 'https://github.com/example/files',
            _rankingScore: 0.9,
          },
        ],
      };
    }
  },
}));
import { searchMeilisearch } from '../../../services/core/search/SearchMcpFactory.js';

it('工厂连续和并发调用只下载、写入一次目录，但每次都执行检索', async () => {
  await Promise.all([
    searchMeilisearch('files'),
    searchMeilisearch('local files'),
  ]);
  await searchMeilisearch('storage');
  expect(state.fetches).toHaveBeenCalledTimes(1);
  expect(state.writes).toHaveBeenCalledTimes(1);
  expect(state.searches).toHaveBeenCalledTimes(3);
});
