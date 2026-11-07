import { expect, it, vi } from 'vitest';
import { SearchService } from '../../../../services/searchService.js';

// Real catalog, vector/text search and aggregation; use the normal offline
// fallback instead of downloading a semantic model in this deterministic suite.
vi.mock('@tensorflow-models/universal-sentence-encoder', () => ({
  load: vi.fn().mockRejectedValue(new Error('Offline catalog regression')),
}));

it.each(['zzqxv', 'weather forecast'])(
  'does not inject product-boosted catalog hits for %s',
  async taskDescription => {
    const service = new SearchService([]);
    expect(await service.search({ taskDescription })).toEqual([]);
  },
);

it('keeps relevant daily-task catalog entries ahead of unrelated social tools', async () => {
  const service = new SearchService([]);
  const results = await service.search({
    taskDescription:
      'I need task-specific MCP tools to create, update, and complete my daily tasks.',
  });
  expect(results[0].id).toBe('google-tasks');
  expect(results.map(result => result.id)).toContain('todoist');
  expect(results.map(result => result.id)).not.toContain('rednote-mcp');
  expect(results.map(result => result.id)).not.toContain('mcp-hotnews-server');
});
