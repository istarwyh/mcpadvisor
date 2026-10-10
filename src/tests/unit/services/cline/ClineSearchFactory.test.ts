import { readFileSync } from 'node:fs';
import { afterEach, expect, it, vi } from 'vitest';

// Keep factory tests hermetic: the existing offline fallback remains enabled,
// but must not download embedding models or read production data in these tests.
vi.mock('../../../../services/core/search/OfflineSearchProvider.js', () => ({
  OfflineSearchProvider: class {
    async search() {
      return [];
    }
  },
}));
vi.mock('../../../../services/core/search/GetMcpSearchProvider.js', () => ({
  GetMcpSearchProvider: class {},
}));
vi.mock(
  '../../../../services/core/search/MeilisearchSearchProvider.js',
  () => ({ MeilisearchSearchProvider: class {} }),
);
vi.mock('../../../../services/core/search/NacosMcpProvider.js', () => ({
  NacosMcpProvider: class {},
}));

import {
  getSearchFunction,
  searchCline,
  searchOffline,
  searchCompass,
  searchGetMcp,
  searchMeilisearch,
} from '../../../../services/core/search/SearchMcpFactory.js';
import { SearchService } from '../../../../services/searchService.js';

const fixture = JSON.parse(
  readFileSync(
    new URL('../../../fixtures/cline/marketplace.json', import.meta.url),
    'utf8',
  ),
);
afterEach(() => vi.unstubAllGlobals());

it('selects Cline explicitly and keeps every existing provider mapping', () => {
  expect(getSearchFunction('CLINE')).toBe(searchCline);
  expect(getSearchFunction('offline')).toBe(searchOffline);
  expect(getSearchFunction('getmcp')).toBe(searchGetMcp);
  expect(getSearchFunction('compass')).toBe(searchCompass);
  expect(getSearchFunction('meilisearch')).toBe(searchMeilisearch);
  expect(() => getSearchFunction('unknown')).toThrow('Unknown search provider');
});

it('never queries Cline from the default search service', async () => {
  const fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
  await new SearchService().search({ taskDescription: 'Postman' });
  expect(fetchMock).not.toHaveBeenCalled();
});

it('reuses the catalog across factory calls and forwards search options', async () => {
  const fetchMock = vi
    .fn()
    .mockResolvedValue(new Response(JSON.stringify(fixture)));
  vi.stubGlobal('fetch', fetchMock);
  expect(await searchCline('developer tools', { limit: 1 })).toHaveLength(1);
  expect(
    await getSearchFunction('cline')({ taskDescription: 'Postman' }),
  ).toHaveLength(1);
  expect(await searchCline('Postman absent', { minSimilarity: 0.75 })).toEqual(
    [],
  );
  expect(fetchMock).toHaveBeenCalledTimes(1);
});
