import { describe, expect, it, vi } from 'vitest';
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
    'I need a GitHub Actions-specific integration',
    'I need a Google Drive-specific integration',
    'I need a google  drive-specific integration',
    'I need a NeverKnown Actions-specific integration',
    'I need a Brave Search-specific integration',
    'I need a Code Sandbox-specific integration',
    'I need a Time Doctor-specific integration',
    'I need a Data Warehouse-specific integration',
    'I need a The Graph-specific integration',
    'I need a secure PostgreSQL-specific integration',
  ])('leaves ambiguous multiword scope untouched: %s', query => {
    expect(apply(query)).toBe(groups);
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
  it('filters before service top-k rather than removing useful results after truncation', async () => {
    const service = new SearchService([{ search: async () => rows }], {
      enabled: false,
    });
    const result = await service.search(
      { taskDescription: 'I need a PostgreSQL-specific tool' },
      { limit: 1, minSimilarity: 0 },
    );
    expect(result.map(row => row.id)).toEqual(['postgresql']);
  });
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
