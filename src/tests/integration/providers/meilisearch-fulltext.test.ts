import { afterAll, describe, expect, it, vi } from 'vitest';
import { MeiliSearch, MeiliSearchApiError } from 'meilisearch';
import { LocalMeilisearchController } from '../../../services/providers/meilisearch/localController.js';
import { MeilisearchSearchProvider } from '../../../services/core/search/MeilisearchSearchProvider.js';
import { SearchService } from '../../../services/searchService.js';
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

    it('retrieves long and Chinese tasks without losing named or explicit terms', async () => {
      const provider = new MeilisearchSearchProvider(
        { fetchData: async () => catalog },
        undefined,
        new LocalMeilisearchController({
          type: 'local',
          host: host!,
          masterKey: key,
          indexName,
          autoIndex: true,
        }),
      );
      const long =
        'I would like a suitable way to help my assistant work with an existing Postgres database';
      expect((await provider.search({ taskDescription: long }))[0].id).toBe(
        'postgres',
      );
      expect(
        (await provider.search({ taskDescription: '请帮我读取本地文件' })).some(
          row => row.id === 'filesystem',
        ),
      ).toBe(true);
      expect(
        (
          await provider.search({
            taskDescription: 'I need a useful tool for a lengthy description',
            keywords: ['Postgres'],
          })
        )[0].id,
      ).toBe('postgres');
      expect(
        await provider.search({
          taskDescription:
            'I need a NeverKnown-specific MCP server for database queries',
        }),
      ).toEqual([]);
      expect(
        await provider.search({ taskDescription: '请帮我寻找独角兽传送门' }),
      ).toEqual([]);
    });

    it('preserves exclusions and ordinary specific modifiers through the service aggregation path', async () => {
      const provider = new MeilisearchSearchProvider(
        { fetchData: async () => catalog },
        undefined,
        new LocalMeilisearchController({
          type: 'local',
          host: host!,
          masterKey: key,
          indexName,
          autoIndex: true,
        }),
      );
      // Explicitly isolate Meili: the independent offline provider does not share this planner.
      const service = new SearchService([provider], { enabled: false });
      for (const query of [
        'I need a database but not Postgres',
        'I need a database without Postgres',
        '我需要数据库工具，不要使用 Postgres',
        'I need a NeverKnown-specific MCP server for database queries',
        'I need a neverknown-specific MCP server for database queries',
      ])
        expect(await service.search({ taskDescription: query })).toEqual([]);
      for (const query of [
        'I need a task-specific MCP server for local files',
        'I need a project-specific MCP server for local files',
        'I need a privacy-specific MCP server for local files',
      ])
        expect((await service.search({ taskDescription: query }))[0]?.id).toBe(
          'filesystem',
        );
      expect(
        (
          await service.search({
            taskDescription: 'I need a Postgres-specific database tool',
          })
        )[0]?.id,
      ).toBe('postgres');
    });

    it('retains complete explicit product names through real retrieval and aggregation', async () => {
      const productIndex = `${indexName}_products`;
      indexes.push(productIndex);
      const products = Object.fromEntries(
        [
          ['google-drive', 'Google Drive', 'File access and search'],
          ['drive', 'Drive', 'Generic file access and search'],
          ['sentry', 'Sentry', 'Analyze application errors'],
          ['aws-cost-explorer', 'AWS Cost Explorer', 'Analyze cloud bills'],
          ['aws', 'AWS', 'Generic cloud resources'],
          ['home-assistant', 'Hass', 'Manage Home Assistant entities'],
          ['firebase', 'Firebase', 'Supports Firestore databases'],
          [
            'rednote-mcp',
            'RedNote MCP',
            '小红书内容访问的MCP服务，支持关键词搜索笔记、通过URL访问笔记内容',
          ],
          [
            'mcp-hotnews-server',
            'Hot News',
            '获取和分析热点新闻和话题，支持小红书、微博等平台',
          ],
        ].map(([id, title, description]) => [
          id,
          {
            ...catalog.filesystem,
            name: id,
            display_name: title,
            description,
          },
        ]),
      );
      const provider = new MeilisearchSearchProvider(
        { fetchData: async () => products },
        undefined,
        new LocalMeilisearchController({
          type: 'local',
          host: host!,
          masterKey: key,
          indexName: productIndex,
          autoIndex: true,
        }),
      );
      const unrelated = {
        search: async () => [
          {
            id: 'generic',
            title: 'Generic MCP',
            description: 'Files, errors, databases and cloud resources',
            sourceUrl: 'https://example.com/generic',
            similarity: 1,
          },
        ],
      };
      const service = new SearchService([unrelated, provider], {
        enabled: false,
      });
      for (const [taskDescription, expected] of [
        [
          'Find a Google Drive-specific MCP for accessing and searching my files.',
          'google-drive',
        ],
        ['帮我找 Sentry 专用的 MCP，用来查看和分析线上错误。', 'sentry'],
        [
          '需要 AWS Cost Explorer 专用 MCP，按区域和服务分析云账单。',
          'aws-cost-explorer',
        ],
        [
          'I need a Home Assistant-specific MCP to manage entities and home automations.',
          'home-assistant',
        ],
        ['请推荐 Firestore 专用 MCP，让助手连接我的数据库。', 'firebase'],
        ['我要知舟工单 Pro 专用的 MCP，处理我公司的工单和待办。', null],
        ['Find a NeverKnown Drive-specific MCP for accessing my files.', null],
        ['Find a Google Drive Pro-specific MCP for accessing my files.', null],
        [
          '我想用小红书专用 MCP 按关键词搜索笔记、打开笔记链接。',
          'rednote-mcp',
        ],
        ['请推荐未知工单专用 MCP，读取本地文件。', null],
      ]) {
        const ids = expected ? [expected] : [];
        expect(
          (await provider.search({ taskDescription: taskDescription! })).map(
            row => row.id,
          ),
        ).toEqual(ids);
        expect(
          (
            await service.search(
              { taskDescription: taskDescription! },
              { limit: 1 },
            )
          ).map(row => row.id),
        ).toEqual(ids);
      }
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
