import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ClineSearchProvider } from '../../../../services/core/search/ClineSearchProvider.js';
import { SearchService } from '../../../../services/searchService.js';

const fixture = JSON.parse(
  readFileSync(
    new URL('../../../fixtures/cline/marketplace.json', import.meta.url),
    'utf8',
  ),
);
const fetchMock = vi.fn<typeof fetch>();
const reply = (data: unknown) => new Response(JSON.stringify(data));

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock);
  fetchMock.mockReset();
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('ClineSearchProvider', () => {
  it('maps the verified public catalog and searches name, description, category and tags', async () => {
    fetchMock.mockResolvedValue(reply(fixture));
    const provider = new ClineSearchProvider();
    const [result] = await provider.search({ taskDescription: 'Postman' });
    expect(result).toEqual({
      id: fixture[0].mcpId,
      title: fixture[0].name,
      description: fixture[0].description,
      sourceUrl: fixture[0].githubUrl,
      categories: [fixture[0].category],
      tags: fixture[0].tags,
      similarity: 1,
    });
    expect(
      await provider.search({
        taskDescription: '',
        keywords: ['feature-flags'],
        capabilities: ['rollouts'],
      }),
    ).toHaveLength(1);
    expect(
      await provider.search({ taskDescription: 'developer-tools' }),
    ).toHaveLength(3);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe(
      'https://api.cline.bot/v1/mcp/marketplace',
    );
    expect(fetchMock.mock.calls[0][1]?.signal).toBeInstanceOf(AbortSignal);
  });

  it('preserves monorepo subdirectory URLs as distinct catalog entries', async () => {
    fetchMock.mockResolvedValue(reply(fixture));
    const results = await new ClineSearchProvider().search({
      taskDescription: 'AWS Infrastructure',
    });
    expect(results).toContainEqual(
      expect.objectContaining({
        sourceUrl: fixture[2].githubUrl,
        id: fixture[2].mcpId,
      }),
    );
  });

  it('does not fetch for empty input or return unrelated entries', async () => {
    const provider = new ClineSearchProvider();
    expect(await provider.search({ taskDescription: '  ' })).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
    fetchMock.mockResolvedValue(reply(fixture));
    expect(await provider.search({ taskDescription: 'doesnotexist' })).toEqual(
      [],
    );
  });

  it('skips invalid required fields and handles missing or invalid optional fields', async () => {
    fetchMock.mockResolvedValue(
      reply([
        null,
        {},
        { ...fixture[0], name: 5 },
        { ...fixture[0], githubUrl: 'javascript:alert(1)' },
        { ...fixture[0], githubUrl: 'https://evil.example/a/b' },
        { ...fixture[0], githubUrl: 'https://user:pass@github.com/a/b' },
        {
          name: 'Postman minimal',
          githubUrl: `${fixture[0].githubUrl}/`,
          description: {},
          tags: [12, null, ' api ', ''],
          category: 1,
        },
      ]),
    );
    const [result] = await new ClineSearchProvider().search({
      taskDescription: 'Postman',
    });
    expect(result).toMatchObject({
      id: fixture[0].githubUrl,
      sourceUrl: fixture[0].githubUrl,
      description: '',
      tags: ['api'],
      categories: [],
    });
  });

  it('reuses the existing SearchService deduplication, filtering and limit', async () => {
    fetchMock.mockResolvedValue(reply([...fixture, fixture[0]]));
    const cline = new ClineSearchProvider();
    const other = {
      search: vi.fn().mockResolvedValue([
        {
          title: 'Other source',
          description: '',
          sourceUrl: fixture[0].githubUrl,
          similarity: 0.5,
        },
      ]),
    };
    const service = new SearchService([cline, other], { enabled: false });
    const results = await service.search(
      { taskDescription: 'developer tools' },
      { minSimilarity: 0, limit: 10 },
    );
    expect(results).toHaveLength(3);
    expect(
      results.filter(r => r.sourceUrl === fixture[0].githubUrl),
    ).toHaveLength(1);
    expect(
      await service.search(
        { taskDescription: 'developer tools' },
        { limit: 1 },
      ),
    ).toHaveLength(1);
    expect(
      await service.search(
        { taskDescription: 'Postman absent' },
        { minSimilarity: 0.75 },
      ),
    ).toEqual([]);
  });

  it('expires the cache, shares concurrent loads and isolates returned objects', async () => {
    vi.useFakeTimers();
    fetchMock.mockImplementation(async () => reply(fixture));
    const provider = new ClineSearchProvider({ cacheTtlMs: 100 });
    const [first] = await Promise.all([
      provider.search({ taskDescription: 'Postman' }),
      provider.search({ taskDescription: 'LaunchDarkly' }),
    ]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    first[0].title = 'Changed';
    (first[0].tags as string[]).push('Changed');
    expect(
      (await provider.search({ taskDescription: 'Postman' }))[0].title,
    ).toBe(fixture[0].name);
    expect(
      (await provider.search({ taskDescription: 'Postman' }))[0].tags,
    ).toEqual(fixture[0].tags);
    await vi.advanceTimersByTimeAsync(101);
    await provider.search({ taskDescription: 'Postman' });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it.each(['http', 'json', 'schema', 'entries', 'network'])(
    'does not cache %s errors and allows retry',
    async kind => {
      if (kind === 'http')
        fetchMock.mockResolvedValueOnce(new Response('', { status: 503 }));
      if (kind === 'json')
        fetchMock.mockResolvedValueOnce(new Response('{broken'));
      if (kind === 'schema')
        fetchMock.mockResolvedValueOnce(reply({ items: fixture }));
      if (kind === 'entries') fetchMock.mockResolvedValueOnce(reply([{}]));
      if (kind === 'network')
        fetchMock.mockRejectedValueOnce(new Error('network unavailable'));
      fetchMock.mockResolvedValueOnce(reply(fixture));
      const provider = new ClineSearchProvider();
      await expect(
        provider.search({ taskDescription: 'Postman' }),
      ).rejects.toThrow();
      expect(
        await provider.search({ taskDescription: 'Postman' }),
      ).toHaveLength(1);
      expect(fetchMock).toHaveBeenCalledTimes(2);
    },
  );

  it('aborts a request that has not received headers', async () => {
    vi.useFakeTimers();
    fetchMock.mockImplementationOnce(
      (_url, init) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener(
            'abort',
            () => reject(new Error('request aborted')),
            { once: true },
          );
        }),
    );
    const provider = new ClineSearchProvider({ timeoutMs: 20 });
    const pending = expect(
      provider.search({ taskDescription: 'Postman' }),
    ).rejects.toThrow('request aborted');
    await vi.advanceTimersByTimeAsync(21);
    await pending;
    // Node 22 abort dispatch can leave a nextTick queued in fake timers.
    // Flush microtasks before checking that no request timeout remains.
    vi.runAllTicks();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('aborts a slow response body and permits a later retry', async () => {
    vi.useFakeTimers();
    fetchMock.mockImplementationOnce(
      async (_url, init) =>
        ({
          ok: true,
          json: () =>
            new Promise((_resolve, reject) => {
              init?.signal?.addEventListener(
                'abort',
                () => reject(new Error('aborted')),
                { once: true },
              );
            }),
        }) as Response,
    );
    const provider = new ClineSearchProvider({ timeoutMs: 20 });
    const pending = expect(
      provider.search({ taskDescription: 'Postman' }),
    ).rejects.toThrow('aborted');
    await vi.advanceTimersByTimeAsync(21);
    await pending;
    fetchMock.mockResolvedValueOnce(reply(fixture));
    expect(await provider.search({ taskDescription: 'Postman' })).toHaveLength(
      1,
    );
  });

  it('caches a valid empty catalog', async () => {
    fetchMock.mockResolvedValue(reply([]));
    const provider = new ClineSearchProvider();
    await provider.search({ taskDescription: 'Postman' });
    await provider.search({ taskDescription: 'Postman' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('lets other SearchService providers succeed when Cline fails', async () => {
    fetchMock.mockRejectedValue(new Error('offline'));
    const result = {
      title: 'Other',
      description: '',
      sourceUrl: 'https://github.com/other/server',
      similarity: 1,
    };
    const service = new SearchService(
      [new ClineSearchProvider(), { search: async () => [result] }],
      { enabled: false },
    );
    expect(await service.search({ taskDescription: 'Other' })).toMatchObject([
      result,
    ]);
  });

  it.each([
    { timeoutMs: 0 },
    { timeoutMs: Infinity },
    { cacheTtlMs: -1 },
    { cacheTtlMs: NaN },
  ])('rejects invalid configuration %j', config => {
    expect(() => new ClineSearchProvider(config)).toThrow();
  });
});
