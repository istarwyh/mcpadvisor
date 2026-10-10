import { ServerService } from '../../../build/services/core/server/ServerService.js';
import { SearchService } from '../../../build/services/searchService.js';
import { MeilisearchSearchProvider } from '../../../build/services/core/search/MeilisearchSearchProvider.js';
import { LocalMeilisearchController } from '../../../build/services/providers/meilisearch/localController.js';

const catalog = {
  filesystem: {
    display_name: 'Filesystem',
    description: 'Read local files',
    repository: { url: 'https://github.com/example/filesystem' },
    categories: ['storage'],
    tags: ['files'],
  },
  postgres: {
    display_name: 'Postgres',
    description: 'Query relational databases',
    repository: { url: 'https://github.com/example/postgres' },
    categories: ['database'],
    tags: ['sql'],
  },
};
const client = new LocalMeilisearchController({
  type: 'local',
  host: process.env.MEILI_FULLTEXT_TEST_HOST,
  masterKey: process.env.MEILI_FULLTEXT_TEST_KEY,
  indexName: process.env.MCP_PROTOCOL_INDEX,
  autoIndex: true,
});
const provider = new MeilisearchSearchProvider(
  {
    fetchData: async () => {
      if (process.argv.includes('failing'))
        throw new Error('Fixture catalog unavailable');
      return catalog;
    },
  },
  undefined,
  client,
);
await new ServerService(
  new SearchService([provider], { enabled: false }),
).startWithStdio();
