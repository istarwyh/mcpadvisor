import { describe, expect, it, vi } from 'vitest';
import { extractSpecificProduct } from '../../../services/core/search/meilisearchQuery.js';
import { filterSpecificProductResults } from '../../../services/core/search/productEvidence.js';
import { SearchService } from '../../../services/searchService.js';
import type { MCPServerResponse } from '../../../types/index.js';
import type { ProviderResult } from '../../../types/search.js';

// These service cases disable offline search. Do not start an unrelated model
// download merely by importing SearchService; real offline coverage is separate.
vi.mock('../../../utils/embedding.js', () => ({
  getTextEmbedding: vi.fn(),
}));

const server = (
  id: string,
  title: string,
  description = '',
  similarity = 0.9,
): MCPServerResponse => ({
  id,
  title,
  description,
  similarity,
  sourceUrl: `https://example.com/${id}`,
});
const rows = [
  server('rednote', 'RedNote', 'Social media'),
  server('postgresql', 'PostgreSQL', 'Database queries'),
  server('database-bridge', 'Database Bridge', 'Supports PostgreSQL schemas'),
  server('postgresqlish', 'PostgreSQLish', 'Unrelated spelling'),
  server('github', 'GitHub', 'Repositories'),
  server('github-actions', 'GitHub Actions', 'CI pipelines'),
  server('generic-actions', 'Actions', 'Generic workflow actions'),
];
const groups: ProviderResult[] = [
  { providerName: 'OfflineSearchProvider', results: rows },
];
const apply = (taskDescription: string) =>
  filterSpecificProductResults({ taskDescription }, groups);

describe('explicit product-specific metadata evidence', () => {
  it('abstains on unsupported products instead of returning generic high-score hits', () => {
    expect(
      apply('I need a NeverKnown-specific database tool')[0].results,
    ).toEqual([]);
    expect(apply('需要 neverknown-specific 数据库工具')[0].results).toEqual([]);
  });
  it('retains exact evidence in identities and descriptions without changing scores', () => {
    const result = apply('I need a PostgreSQL-specific database tool')[0]
      .results;
    expect(result.map(row => row.id)).toEqual([
      'postgresql',
      'database-bridge',
    ]);
    expect(result[0]).toBe(rows[1]);
    expect(result[1]).toBe(rows[2]);
    expect(groups[0].results).toHaveLength(7);
  });
  it.each([
    ['GitHub Actions', 'github-actions'],
    ['Google Drive', 'google-drive'],
    ['google  drive', 'google-drive'],
    ['Brave Search', 'brave-search'],
    ['Code Sandbox', 'code-sandbox'],
    ['Time Doctor', 'time-doctor'],
    ['Data Warehouse', 'data-warehouse'],
    ['The Graph', 'the-graph'],
  ])('requires the whole explicit multiword phrase: %s', (name, id) => {
    const data: ProviderResult[] = [
      {
        providerName: 'fixture',
        results: [
          ...rows,
          server(id, name),
          server('last-word', name.split(/\s+/).at(-1)!),
          server('first-word', name.split(/\s+/)[0]),
        ],
      },
    ];
    const actual = filterSpecificProductResults(
      { taskDescription: `I need a ${name}-specific integration` },
      data,
    );
    expect(actual[0].results.map(row => row.id)).toEqual(
      id === 'github-actions' ? ['github-actions', id] : [id],
    );
  });
  it('does not broaden an unknown full phrase to a recognized suffix', () => {
    expect(
      apply('I need a NeverKnown Actions-specific integration')[0].results,
    ).toEqual([]);
  });
  it('leaves an ambiguous adjective-prefixed name untouched', () => {
    expect(apply('I need a secure PostgreSQL-specific integration')).toBe(
      groups,
    );
  });
  it.each([
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
  ])(
    'checks Chinese qualifiers and non-title metadata evidence: %s',
    (query, expected) => {
      const data: ProviderResult[] = [
        {
          providerName: 'fixture',
          results: [
            ...rows,
            server('sentry', 'Sentry'),
            server('aws', 'AWS'),
            server('aws-cost-explorer', 'AWS Cost Explorer'),
            server('home-assistant', 'Hass', 'MCP server for Home Assistant'),
            server('firebase', 'Firebase', 'Supports Firestore databases'),
          ],
        },
      ];
      expect(
        filterSpecificProductResults(
          { taskDescription: query },
          data,
        )[0].results.map(row => row.id),
      ).toEqual(expected ? [expected] : []);
    },
  );
  it('preserves Chinese determiner-qualified products and rejects unknown complete names', () => {
    const data: ProviderResult[] = [
      {
        providerName: 'fixture',
        results: [
          server('cloud-harbor', 'Cloud Harbor'),
          server('bridge', 'Bridge', 'Supports Cloud Harbor'),
          server('harbor', 'Harbor'),
          ...rows,
        ],
      },
    ];
    expect(
      filterSpecificProductResults(
        { taskDescription: '请推荐一个 Cloud Harbor 专用的 MCP' },
        data,
      )[0].results.map(row => row.id),
    ).toEqual(['cloud-harbor', 'bridge']);
    expect(
      filterSpecificProductResults(
        { taskDescription: '请推荐一个 NeverKnown Harbor 专用的 MCP' },
        data,
      )[0].results,
    ).toEqual([]);
  });
  it.each([
    'Could you find a PostgreSQL-specific MCP?',
    'I want to use a PostgreSQL-specific MCP',
    'I would like a PostgreSQL-specific MCP',
    'I am looking for a PostgreSQL-specific MCP',
    'Can you help me find a PostgreSQL-specific MCP',
    'Show me a PostgreSQL-specific MCP',
    'I need a task-specific tool. Find a PostgreSQL-specific MCP',
    'I need a PostgreSQL-specific MCP. I also need a task-specific tool',
    'Find a PostgreSQL-specific MCP for user-specific tasks',
  ])(
    'preserves established single-product grammatical and generic-adjunct scope: %s',
    query => {
      expect(apply(query)[0].results.map(row => row.id)).toEqual([
        'postgresql',
        'database-bridge',
      ]);
    },
  );
  it.each(['Code With Me', 'NeverKnown For Search', 'Need for Speed'])(
    'does not drop or shorten complete names containing grammatical words: %s',
    product => {
      const data: ProviderResult[] = [
        {
          providerName: 'fixture',
          results: [
            server('whole', product),
            server('tail', product.split(' ').at(-1)!),
            ...rows,
          ],
        },
      ];
      expect(
        filterSpecificProductResults(
          { taskDescription: `I need a ${product}-specific MCP` },
          data,
        )[0].results.map(row => row.id),
      ).toEqual(['whole']);
    },
  );
  it('does not join evidence across fields or separate tags', () => {
    const data: ProviderResult[] = [
      {
        providerName: 'fixture',
        results: [{ ...server('google', 'Drive'), tags: ['Google', 'Drive'] }],
      },
    ];
    expect(
      filterSpecificProductResults(
        { taskDescription: 'Google Drive-specific MCP' },
        data,
      )[0].results,
    ).toEqual([]);
  });
  it('parses independently of candidate order, presence, and partial matching titles', () => {
    const query = 'Find a NeverKnown Actions-specific MCP';
    expect(extractSpecificProduct(query)).toBe('neverknown actions');
    const data: ProviderResult[] = [
      {
        providerName: 'fixture',
        results: [
          server('bridge', 'Bridge', 'Supports NeverKnown Actions'),
          ...rows,
        ],
      },
    ];
    for (const results of [data[0].results, [...data[0].results].reverse()]) {
      expect(
        filterSpecificProductResults({ taskDescription: query }, [
          { ...data[0], results },
        ])[0].results.map(row => row.id),
      ).toEqual(['bridge']);
    }
    expect(apply(query)[0].results).toEqual([]);
  });
  it('does not let a later multiword mention change the single-token requirement', () => {
    expect(
      apply(
        'I need a GitHub-specific integration; CI already uses GitHub Actions',
      )[0].results.map(row => row.id),
    ).toEqual(['github', 'github-actions']);
  });
  it('preserves product evidence next to Chinese text', () => {
    const data = [
      {
        providerName: 'fixture',
        results: [server('bridge', 'Bridge', '用于PostgreSQL数据库')],
      },
    ];
    expect(
      filterSpecificProductResults(
        { taskDescription: '需要 PostgreSQL-specific 工具' },
        data,
      )[0].results,
    ).toEqual(data[0].results);
  });
  it('supports accented Latin names without reducing them to a suffix', () => {
    const data = [
      {
        providerName: 'fixture',
        results: [server('bridge', 'Grafaná'), rows[0]],
      },
    ];
    expect(
      filterSpecificProductResults(
        { taskDescription: 'I need a Grafaná-specific tool' },
        data,
      )[0].results.map(row => row.title),
    ).toEqual(['Grafaná']);
  });
  it('normalizes case and compatibility characters and checks tags', () => {
    const data: ProviderResult[] = [
      {
        providerName: 'fixture',
        results: [
          { ...server('bridge', 'Bridge'), tags: ['PostgreSQL'] },
          server('url-only', 'Bridge', ''),
        ],
      },
    ];
    data[0].results[1].sourceUrl = 'https://example.com/PostgreSQL';
    expect(
      filterSpecificProductResults(
        { taskDescription: 'ＰｏｓｔｇｒｅＳＱＬ-specific tool' },
        data,
      )[0].results.map(row => row.id),
    ).toEqual(['bridge']);
  });
  it.each(['task', 'project', 'privacy', 'domain', 'Task'])(
    'keeps generic %s-specific queries untouched',
    modifier => {
      expect(apply(`I need a ${modifier}-specific database tool`)).toBe(groups);
    },
  );
  it('ignores generic modifiers beside the one named product requirement', () => {
    expect(
      apply('I need a task-specific NeverKnown-specific database tool')[0]
        .results,
    ).toEqual([]);
  });
  it.each([
    'database tools',
    '需要任务专用 MCP',
    '需要数据库专用 MCP',
    '需要文件系统专用 MCP',
    '需要电子邮件专用 MCP',
    '需要知识图谱专用 MCP',
    'Slack 和 Notion 专用 MCP',
    'Slack 专用和 Notion 专用 MCP',
    '需要 Sentry 专用或 Firestore 专用 MCP',
    'I need a GitHub And PostgreSQL-specific tool',
    'I do not need a PostgreSQL-specific tool',
    'Anything except PostgreSQL-specific tools',
    '不要 PostgreSQL-specific 工具',
    'GitHub-specific or PostgreSQL-specific tools',
    'GitHub-specific and PostgreSQL-specific tools',
    'GitHub-specific and Brave Search-specific tools',
    'GitHub-specific and 小红书-specific tools',
    'Brave Search-specific and GitHub-specific tools',
  ])('leaves unqualified or unresolved logical scope untouched: %s', query => {
    expect(apply(query)).toBe(groups);
  });
  it.each(['I need a PostgreSQL-specific tool', '请推荐 PostgreSQL 专用 MCP'])(
    'filters before service top-k: %s',
    async taskDescription => {
      const service = new SearchService([{ search: async () => rows }], {
        enabled: false,
      });
      const result = await service.search(
        { taskDescription },
        { limit: 1, minSimilarity: 0 },
      );
      expect(result.map(row => row.id)).toEqual(['postgresql']);
    },
  );
  it('also gates professional reranker inputs and its failure fallback', async () => {
    const rerank = vi.fn(
      async (_query: string, candidates: MCPServerResponse[]) =>
        [...candidates].reverse(),
    );
    const service = new SearchService(
      [{ search: async () => rows }],
      { enabled: false },
      { rerank },
    );
    const params = {
      taskDescription: 'I need a PostgreSQL-specific database tool',
    };
    const result = await service.search(params, { minSimilarity: 0 });
    expect(rerank.mock.calls[0][1].map(row => row.id)).toEqual([
      'postgresql',
      'database-bridge',
    ]);
    expect(result.map(row => row.id)).toEqual([
      'database-bridge',
      'postgresql',
    ]);
    rerank.mockRejectedValueOnce(new Error('unavailable'));
    expect(
      (await service.search(params, { minSimilarity: 0 })).map(row => row.id),
    ).toEqual(['postgresql', 'database-bridge']);
  });
});
