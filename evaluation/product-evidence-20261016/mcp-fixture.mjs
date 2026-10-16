// Actual application components, selected checkout, full catalog, disposable index.
import process from 'node:process';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const root = process.env.MCP_CAPTURE_ROOT;
const load = file =>
  import(pathToFileURL(path.join(root, `build/${file}.js`)).href);
const { ServerService } = await load('services/core/server/ServerService');
const { SearchService } = await load('services/searchService');
const { MeilisearchSearchProvider } = await load(
  'services/core/search/MeilisearchSearchProvider',
);
const { LocalMeilisearchController } = await load(
  'services/providers/meilisearch/localController',
);
const fallbackDataPath = path.join(root, 'data/mcp_server_list.json');
const catalog = Object.fromEntries(
  JSON.parse(await readFile(fallbackDataPath, 'utf8')).map(row => [
    row.id,
    row,
  ]),
);
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
