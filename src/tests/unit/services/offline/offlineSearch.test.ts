/**
 * 离线搜索功能测试
 * 测试离线模式下的推荐效果，包括小红书、GitHub、文档等不同场景
 */

import { describe, expect, test, beforeAll, afterAll } from 'vitest';
import { searchOffline } from '../../../../services/core/search/SearchMcpFactory.js';
import { getMcpServerListPath } from '../../../../utils/pathUtils.js';
import {
  redbookTestCases,
  githubTestCases,
  prompxTestCases,
  edgeCaseTestCases,
} from '../../../fixtures/search/cases/index.js';
import { createSearchTest } from '../../../fixtures/search/testUtils.js';

const FALLBACK_DATA_PATH = getMcpServerListPath();

const ALL_TEST_CASES = [
  ...redbookTestCases,
  ...githubTestCases,
  ...edgeCaseTestCases,
  ...prompxTestCases,
];

describe('离线搜索功能测试', () => {
  beforeAll(() => {
    console.log('开始执行离线搜索测试...');
  });

  afterAll(() => {
    console.log('离线搜索测试执行完毕');
  });

  ALL_TEST_CASES.forEach(testCase =>
    createSearchTest(testCase, searchOffline, FALLBACK_DATA_PATH),
  );

  describe('特殊场景测试', () => {
    test('排序功能', async () => {
      const results = await searchOffline(
        'MCP服务器',
        { limit: 5, minSimilarity: 0.1, sortBy: 'score', sortOrder: 'desc' },
        FALLBACK_DATA_PATH,
      );

      // 检查结果是否按分数降序排列
      if (results.length > 1) {
        for (let i = 0; i < results.length - 1; i++) {
          const current = results[i] as any;
          const next = results[i + 1] as any;
          expect(current.score).toBeGreaterThanOrEqual(next.score);
        }
      }
    });
  });
});
