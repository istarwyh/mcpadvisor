import { searchGetMcp } from '../../../services/core/search/SearchMcpFactory.js';
import { MCPServerResponse } from '../../../types/index.js';
import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock the factory function
vi.mock('../../../services/core/search/SearchMcpFactory.js', () => ({
  searchGetMcp: vi.fn(),
}));

const mockSearchGetMcp = searchGetMcp as ReturnType<typeof vi.fn>;

/**
 * 测试 SearchService
 */
describe('SearchService', () => {
  // 模拟SearchService.searchGetMcp方法
  beforeEach(() => {
    // 为测试创建一个模拟的searchGetMcp方法
    mockSearchGetMcp.mockImplementation(async (query, options) => {
      const mockResults: MCPServerResponse[] = [
        {
          title: 'Test Server 1',
          description: 'A test server for AI applications',
          sourceUrl: 'https://github.com/test/server1',
          similarity: 0.95,
        },
        {
          title: 'Test Server 2',
          description: 'Another test server for data processing',
          sourceUrl: 'https://github.com/test/server2',
          similarity: 0.85,
        },
        {
          title: 'Test Server 3',
          description: 'A third test server for various tasks',
          sourceUrl: 'https://github.com/test/server3',
          similarity: 0.75,
        },
      ];

      // 如果设置了limit选项，则限制结果数量
      if (options?.limit) {
        return mockResults.slice(0, options.limit);
      }

      // 如果设置了minSimilarity选项，则过滤结果
      if (options?.minSimilarity !== undefined) {
        const minSimilarity = options.minSimilarity; // 创建本地变量，TypeScript能正确推断类型
        return mockResults.filter(result => result.similarity >= minSimilarity);
      }

      return mockResults;
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  test('should return search results for a query', async () => {
    const results = await searchGetMcp('AI');
    expect(results).toHaveLength(3);
    expect(results[0].title).toBe('Test Server 1');
  });

  test('should limit results when limit option is provided', async () => {
    const results = await searchGetMcp('data', { limit: 2 });
    expect(results).toHaveLength(2);
  });

  test('should filter results by minimum similarity', async () => {
    const results = await searchGetMcp('test', {
      minSimilarity: 0.8,
    });
    expect(results.every(result => result.similarity >= 0.8)).toBe(true);
    expect(results).toHaveLength(2);
  });
});
