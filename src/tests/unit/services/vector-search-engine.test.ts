/**
 * 向量搜索引擎通用测试
 * 测试各种向量搜索引擎实现的共同接口和行为
 */

import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { IVectorSearchEngine } from '../../../services/interfaces/vectorSearchEngine.js';
import { normalizeVector } from '../../../utils/vectorUtils.js';

import { MCPServerResponse } from '../../../types/index.js';

// 创建一个模拟的向量搜索引擎实现
class MockVectorSearchEngine implements IVectorSearchEngine {
  private mockData: Array<{
    id: string;
    vector: number[];
    data: MCPServerResponse;
  }> = [];

  async addEntry(
    id: string,
    vector: number[],
    data: MCPServerResponse,
  ): Promise<void> {
    this.mockData.push({ id, vector, data });
  }

  async search(
    queryVector: number[],
    limit: number = 10,
  ): Promise<MCPServerResponse[]> {
    // 模拟搜索实现
    const results = this.mockData
      .map(item => {
        const similarity = this.calculateSimilarity(queryVector, item.vector);
        return {
          ...item.data,
          similarity, // 更新相似度字段
        };
      })
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, limit);

    return results;
  }

  async clear(): Promise<void> {
    this.mockData = [];
  }

  // 辅助方法：计算余弦相似度
  private calculateSimilarity(v1: number[], v2: number[]): number {
    const normalizedV1 = normalizeVector(v1);
    const normalizedV2 = normalizeVector(v2);

    let dotProduct = 0;
    for (let i = 0; i < normalizedV1.length; i++) {
      dotProduct += normalizedV1[i] * normalizedV2[i];
    }

    return dotProduct;
  }

  // 用于测试的方法：添加模拟数据
  addMockData(
    id: string,
    vector: number[],
    metadata: Record<string, any>,
  ): void {
    // 创建一个简单的 MCPServerResponse 对象
    const data: MCPServerResponse = {
      id,
      title: metadata.name || `MCP Server ${id}`,
      description: metadata.description || `Description for ${id}`,
      sourceUrl: metadata.github_url || `https://github.com/example/${id}`,
      similarity: 0, // 初始相似度为 0，在搜索时计算
      categories: metadata.categories || 'test',
      tags: metadata.tags || ['test', 'mock'],
    };

    this.mockData.push({ id, vector, data });
  }

  // 用于测试的方法：清除模拟数据
  clearMockData(): void {
    this.mockData = [];
  }
}

describe('向量搜索引擎通用测试', () => {
  let vectorEngine: MockVectorSearchEngine;

  beforeEach(() => {
    vectorEngine = new MockVectorSearchEngine();

    // 添加一些测试数据
    vectorEngine.addMockData('1', [1, 0, 0], { name: '文档1' });
    vectorEngine.addMockData('2', [0, 1, 0], { name: '文档2' });
    vectorEngine.addMockData('3', [0, 0, 1], { name: '文档3' });
    vectorEngine.addMockData('4', [0.7, 0.7, 0], { name: '文档4' });
  });

  afterEach(() => {
    vectorEngine.clearMockData();
  });

  test('应该能够找到最相似的向量', async () => {
    const queryVector = [0.9, 0.1, 0];
    const results = await vectorEngine.search(queryVector, 2);

    expect(results.length).toBe(2);
    expect(results[0].id).toBe('1'); // 文档1应该是最相似的
    expect(results[0].similarity).toBeGreaterThan(0.9);
  });

  test('应该返回按相似度排序的结果', async () => {
    const queryVector = [0.5, 0.5, 0.5];
    const results = await vectorEngine.search(queryVector);

    // 确保结果按相似度降序排列
    for (let i = 1; i < results.length; i++) {
      expect(results[i - 1].similarity).toBeGreaterThanOrEqual(
        results[i].similarity,
      );
    }
  });

  test('应该限制返回结果数量', async () => {
    const queryVector = [0.33, 0.33, 0.33];
    const limit = 2;
    const results = await vectorEngine.search(queryVector, limit);

    expect(results.length).toBeLessThanOrEqual(limit);
  });

  // TODO: 添加更多测试用例
  test.todo('应该正确处理空向量');
  test.todo('应该正确处理不同维度的向量');
  test.todo('应该正确处理大量数据');
});
