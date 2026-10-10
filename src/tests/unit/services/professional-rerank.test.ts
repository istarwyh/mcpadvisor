import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  FlashRankReranker,
  createOptionalProfessionalReranker,
} from '../../../services/core/search/ProfessionalReranker.js';
import { SearchService } from '../../../services/searchService.js';
import { formatServersToText } from '../../../utils/formatter.js';
import type { MCPServerResponse } from '../../../types/index.js';

const candidates: MCPServerResponse[] = [
  {
    title: 'Browser',
    description: 'Web page screenshots',
    sourceUrl: 'https://github.com/example/browser',
    similarity: 0.9,
  },
  {
    title: 'Filesystem',
    description: 'Read local files',
    sourceUrl: 'https://github.com/example/filesystem',
    similarity: 0.6,
  },
];
afterEach(() => vi.unstubAllGlobals());
describe('专业模型重排', () => {
  it('输出保留模型的零分，仅缺省分数回退到检索相似度', () => {
    const zeroScore = formatServersToText([{ ...candidates[0], score: 0 }]);
    expect(zeroScore).toContain('Score: 0.0%');
    expect(formatServersToText([candidates[0]])).toContain('Score: 90.0%');
  });
  it('默认关闭，验证配置且不发起请求', () => {
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);
    expect(createOptionalProfessionalReranker({})).toBeUndefined();
    expect(
      createOptionalProfessionalReranker({ RERANK_PROVIDER: 'none' }),
    ).toBeUndefined();
    expect(
      createOptionalProfessionalReranker({ RERANK_PROVIDER: 'flashrank' }),
    ).toBeInstanceOf(FlashRankReranker);
    expect(() =>
      createOptionalProfessionalReranker({ RERANK_PROVIDER: 'other' }),
    ).toThrow();
    expect(() =>
      createOptionalProfessionalReranker({
        RERANK_PROVIDER: 'flashrank',
        RERANK_TIMEOUT_MS: '0',
      }),
    ).toThrow();
    expect(() => new FlashRankReranker('http://example.com/rerank')).toThrow();
    expect(fetch).not.toHaveBeenCalled();
  });
  it('使用模型分数稳定排序，不修改原始候选', async () => {
    const fetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          results: [
            { index: 1, relevance_score: 0.95 },
            { index: 0, relevance_score: 0.1 },
          ],
        }),
      ),
    );
    vi.stubGlobal('fetch', fetch);
    const results = await new FlashRankReranker(
      'http://127.0.0.1:8001/rerank',
    ).rerank('local files', candidates);
    expect(results.map(r => r.title)).toEqual(['Filesystem', 'Browser']);
    expect(results[0].score).toBe(0.95);
    expect(candidates[1].score).toBeUndefined();
    const sent = JSON.parse(fetch.mock.calls[0][1].body);
    expect(sent.documents).toHaveLength(2);
    expect(sent.query).toBe('local files');
  });
  it.each([
    { results: [{ index: 0, relevance_score: 0.1 }] },
    {
      results: [
        { index: 0, relevance_score: 0.1 },
        { index: 0, relevance_score: 0.9 },
      ],
    },
    {
      results: [
        { index: 0, relevance_score: 0.1 },
        { index: 2, relevance_score: 0.9 },
      ],
    },
    {
      results: [
        { index: 0, relevance_score: 0.1 },
        { index: 1, relevance_score: 1.1 },
      ],
    },
    {
      results: [
        { index: 0, relevance_score: 0.1 },
        { index: 1, relevance_score: '0.9' },
      ],
    },
  ])('拒绝格式错误的模型响应', async payload => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response(JSON.stringify(payload))),
    );
    await expect(
      new FlashRankReranker('http://localhost:8001').rerank(
        'files',
        candidates,
      ),
    ).rejects.toThrow('Invalid FlashRank');
  });
  it('处理 HTTP 失败，并同时限制响应头和正文等待时间', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response('', { status: 503 })),
    );
    await expect(
      new FlashRankReranker('http://localhost:8001').rerank(
        'files',
        candidates,
      ),
    ).rejects.toThrow('503');
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url, options) => ({
        ok: true,
        json: () =>
          new Promise((_resolve, reject) =>
            options.signal.addEventListener('abort', () =>
              reject(new Error('aborted')),
            ),
          ),
      })),
    );
    await expect(
      new FlashRankReranker('http://localhost:8001', 20).rerank(
        'files',
        candidates,
      ),
    ).rejects.toThrow('aborted');
  });
  it('先重排候选池再限制输出数量', async () => {
    const model = {
      rerank: vi.fn(async (_query, pool) => [...pool].reverse()),
    };
    const service = new SearchService(
      [{ search: async () => candidates }],
      { enabled: false },
      model,
    );
    expect(
      (await service.search({ taskDescription: 'files' }, { limit: 1 }))[0]
        .title,
    ).toBe('Filesystem');
    expect(model.rerank.mock.calls[0][1]).toHaveLength(2);
  });
  it('模型失败时完整保留已有排序', async () => {
    const provider = { search: async () => candidates };
    const baseline = await new SearchService([provider], {
      enabled: false,
    }).search({ taskDescription: 'files' });
    const failing = new SearchService(
      [provider],
      { enabled: false },
      {
        rerank: async () => {
          throw new Error('offline');
        },
      },
    );
    expect(await failing.search({ taskDescription: 'files' })).toEqual(
      baseline,
    );
  });
  it('尊重指定排序和超出上限的输出数量', async () => {
    const model = { rerank: vi.fn(async (_query, pool) => pool) };
    const service = new SearchService(
      [{ search: async () => candidates }],
      { enabled: false },
      model,
    );
    await service.search(
      { taskDescription: 'files' },
      { sortBy: 'similarity' },
    );
    await service.search({ taskDescription: 'files' }, { limit: 100 });
    await service.search({ taskDescription: 'files' }, { limit: 0 });
    expect(model.rerank).not.toHaveBeenCalled();
  });
  it('显式 undefined 限制保留全部结果，不截断为模型的 50 项上限', async () => {
    const many = Array.from({ length: 60 }, (_, index) => ({
      ...candidates[0],
      title: `Server ${index}`,
      sourceUrl: `https://github.com/example/server-${index}`,
    }));
    const provider = { search: async () => many };
    const model = { rerank: vi.fn(async (_query, pool) => pool) };
    const baseline = await new SearchService([provider], {
      enabled: false,
    }).search({ taskDescription: 'files' }, { limit: undefined });
    const actual = await new SearchService(
      [provider],
      { enabled: false },
      model,
    ).search({ taskDescription: 'files' }, { limit: undefined });
    expect(actual).toEqual(baseline);
    expect(actual).toHaveLength(60);
    expect(model.rerank).not.toHaveBeenCalled();
  });
});
