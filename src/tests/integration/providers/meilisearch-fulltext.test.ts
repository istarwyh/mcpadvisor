import { afterAll, describe, expect, it, vi } from 'vitest';
import { MeiliSearch, MeiliSearchApiError } from 'meilisearch';
import { LocalMeilisearchController } from '../../../services/providers/meilisearch/localController.js';
import { MeilisearchSearchProvider } from '../../../services/core/search/MeilisearchSearchProvider.js';
import type { GetMcpApiResponse } from '../../../services/common/api/getMcpResourceFetcher.js';

const host = process.env.MEILI_FULLTEXT_TEST_HOST;
const key = process.env.MEILI_FULLTEXT_TEST_KEY;
const indexName = `mcp_fulltext_test_${Date.now()}_${process.pid}`;
const indexes = [indexName];
const engine = host ? new MeiliSearch({ host, apiKey: key }) : undefined;
const catalog: GetMcpApiResponse = {
  filesystem: {
    name: 'filesystem',
    homepage: '',
    author: { name: 'Fixture' },
    license: 'MIT',
    examples: [],
    arguments: {},
    installations: {},
    display_name: 'Filesystem',
    description: 'Read and write local files',
    repository: { type: 'git', url: 'https://github.com/example/filesystem' },
    categories: ['storage'],
    tags: ['files'],
  },
  postgres: {
    name: 'postgres',
    homepage: '',
    author: { name: 'Fixture' },
    license: 'MIT',
    examples: [],
    arguments: {},
    installations: {},
    display_name: 'Postgres',
    description: 'Query relational databases',
    repository: { type: 'git', url: 'https://github.com/example/postgres' },
    categories: ['database'],
    tags: ['sql'],
  },
  browser: {
    name: 'browser',
    homepage: '',
    author: { name: 'Fixture' },
    license: 'MIT',
    examples: [],
    arguments: {},
    installations: {},
    display_name: 'Browser',
    description: 'Automate web pages',
    repository: { type: 'git', url: 'https://github.com/example/browser' },
    categories: ['web'],
    tags: ['automation'],
  },
};

describe.skipIf(!host)(
  'Meilisearch full-text search against the real local engine',
  () => {
    afterAll(async () => {
      if (engine)
        for (const index of indexes) {
          try {
            const task = await engine.deleteIndex(index);
            await engine.tasks.waitForTask(task.taskUid);
          } catch (error) {
            if (
              !(
                error instanceof MeiliSearchApiError &&
                error.cause?.code === 'index_not_found'
              )
            )
              throw error;
          }
        }
    });

    it('creates and indexes a catalog, then retrieves title, description, category and tag matches', async () => {
      const controller = new LocalMeilisearchController({
        type: 'local',
        host: host!,
        masterKey: key,
        indexName,
        autoIndex: true,
      });
      const provider = new MeilisearchSearchProvider(
        { fetchData: async () => catalog },
        undefined,
        controller,
      );
      for (const query of ['Filesystem', 'local files', 'storage', 'files']) {
        const results = await provider.search({ taskDescription: query });
        expect(results[0].id).toBe('filesystem');
        expect(results[0].sourceUrl).toBe(
          'https://github.com/example/filesystem',
        );
        expect(results[0].similarity).toBeGreaterThan(0);
        expect(results[0].categories).toContain('storage');
      }
      expect((await provider.search({ taskDescription: 'sql' }))[0].id).toBe(
        'postgres',
      );
      expect(
        await provider.search({ taskDescription: 'nonexistentxyz' }),
      ).toEqual([]);
      expect(
        (await engine!.index(indexName).getStats()).numberOfDocuments,
      ).toBe(3);
    });

    it('does not create or write an index without explicit opt-in', async () => {
      const untouched = `${indexName}_disabled`;
      const controller = new LocalMeilisearchController({
        type: 'local',
        host: host!,
        masterKey: key,
        indexName: untouched,
      });
      await controller.indexDocuments([{ id: 'do_not_write' }]);
      await expect(engine!.index(untouched).getRawInfo()).rejects.toMatchObject(
        { cause: { code: 'index_not_found' } },
      );
    });

    it('reports failed document tasks instead of caching or claiming ingestion success', async () => {
      const controller = new LocalMeilisearchController({
        type: 'local',
        host: host!,
        masterKey: key,
        indexName,
        autoIndex: true,
      });
      await expect(
        controller.indexDocuments([{ id: 'invalid/id' }]),
      ).rejects.toThrow('failed');
    });

    it('returns the original catalog ID when the engine requires a hashed key', async () => {
      const provider = new MeilisearchSearchProvider(
        {
          fetchData: async () => ({
            'org/server name': {
              ...catalog.filesystem,
              display_name: 'UnusualCatalog',
            },
          }),
        },
        undefined,
        new LocalMeilisearchController({
          type: 'local',
          host: host!,
          masterKey: key,
          indexName,
          autoIndex: true,
        }),
      );
      expect(
        (await provider.search({ taskDescription: 'UnusualCatalog' }))[0].id,
      ).toBe('org/server name');
    });

    it('allows independent controllers to create the same missing index concurrently', async () => {
      const concurrentIndex = `${indexName}_concurrent`;
      indexes.push(concurrentIndex);
      let arrivals = 0;
      let release!: () => void;
      const barrier = new Promise<void>(resolve => {
        release = resolve;
      });
      const originalIndex = MeiliSearch.prototype.index;
      const spy = vi
        .spyOn(MeiliSearch.prototype, 'index')
        .mockImplementation(function (this: MeiliSearch, uid) {
          const index = originalIndex.call(this, uid);
          if (uid === concurrentIndex) {
            const readInfo = index.getRawInfo.bind(index);
            index.getRawInfo = async () => {
              try {
                return await readInfo();
              } catch (error) {
                if (
                  error instanceof MeiliSearchApiError &&
                  error.cause?.code === 'index_not_found'
                ) {
                  if (++arrivals === 2) release();
                  await barrier;
                }
                throw error;
              }
            };
          }
          return index;
        });
      try {
        const controllers = Array.from(
          { length: 2 },
          () =>
            new LocalMeilisearchController({
              type: 'local',
              host: host!,
              masterKey: key,
              indexName: concurrentIndex,
              autoIndex: true,
            }),
        );
        await Promise.all(
          controllers.map((controller, i) =>
            controller.indexDocuments([
              { id: `concurrent_${i}`, title: `Document ${i}` },
            ]),
          ),
        );
        expect(arrivals).toBe(2);
      } finally {
        spy.mockRestore();
      }
      expect(
        (await engine!.index(concurrentIndex).getStats()).numberOfDocuments,
      ).toBe(2);
    });
  },
);
