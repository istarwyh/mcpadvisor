import { URL } from 'node:url';
// Actual application components with a disposable Meili index and full catalog.
import process from 'node:process';
import { readFileSync } from 'node:fs';
import { ServerService } from '../../build/services/core/server/ServerService.js';
import { SearchService } from '../../build/services/searchService.js';
import { MeilisearchSearchProvider } from '../../build/services/core/search/MeilisearchSearchProvider.js';
import { LocalMeilisearchController } from '../../build/services/providers/meilisearch/localController.js';
import { OfflineDataLoader } from '../../build/services/providers/offline/offlineDataLoader.js';
import { WritableInMemoryVectorEngine } from '../../build/services/providers/offline/writableVectorEngine.js';
const fallbackDataPath = new URL(
  '../../data/mcp_server_list.json',
  import.meta.url,
).pathname;
const catalog = Object.fromEntries(
  JSON.parse(readFileSync(fallbackDataPath, 'utf8')).map(row => [row.id, row]),
);
let insertions = 0;
const originalAdd = WritableInMemoryVectorEngine.prototype.addEntry;
WritableInMemoryVectorEngine.prototype.addEntry = function (...args) {
  insertions++;
  process.stderr.write(`OFFLINE_INSERTIONS=${insertions}\n`);
  return originalAdd.apply(this, args);
};
const originalLoad = OfflineDataLoader.prototype.loadFallbackDataWithEmbeddings;
OfflineDataLoader.prototype.loadFallbackDataWithEmbeddings = function (
  ...args
) {
  process.stderr.write('OFFLINE_LOAD_STARTED\n');
  return originalLoad.apply(this, args);
};
const provider = new MeilisearchSearchProvider(
  { fetchData: async () => catalog },
  undefined,
  new LocalMeilisearchController({
    type: 'local',
    host: process.env.MEILI_FULLTEXT_TEST_HOST,
    indexName: process.env.MCP_PROTOCOL_INDEX,
    autoIndex: true,
  }),
);
await new ServerService(
  new SearchService([provider], { fallbackDataPath }),
).startWithStdio();
