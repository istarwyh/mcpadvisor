/**
 * 向量工具函数测试
 * 测试向量操作相关的工具函数
 */

import { describe, test, expect, vi } from 'vitest';
import {
  normalizeVector,
  cosineSimilarity,
} from '../../../utils/vectorUtils.js';

// 实现测试中需要的 createZeroVector 函数
function createZeroVector(dimension: number): number[] {
  return new Array(dimension).fill(0);
}

describe('向量工具函数', () => {
  describe('normalizeVector', () => {
    test('应该正确归一化非零向量', () => {
      const vector = [3, 4, 0];
      const normalized = normalizeVector(vector);

      // 验证向量长度为 1
      const magnitude = Math.sqrt(
        normalized.reduce((sum: number, val: number) => sum + val * val, 0),
      );
      expect(magnitude).toBeCloseTo(1);

      // 验证方向不变
      expect(normalized[0]).toBeCloseTo(0.6);
      expect(normalized[1]).toBeCloseTo(0.8);
      expect(normalized[2]).toBeCloseTo(0);
    });

    test('应该处理零向量', () => {
      const vector = [0, 0, 0];
      const normalized = normalizeVector(vector);

      // 零向量归一化后仍为零向量
      expect(normalized).toEqual([0, 0, 0]);
    });

    test.todo('应该处理单元素向量');
    test.todo('应该处理非常大的向量值');
    test.todo('应该处理非常小的向量值');
  });

  describe('cosineSimilarity', () => {
    test('相同向量的相似度应为 1', () => {
      const v1 = [1, 2, 3];
      const v2 = [1, 2, 3];

      const similarity = cosineSimilarity(v1, v2);
      expect(similarity).toBeCloseTo(1);
    });

    test('正交向量的相似度应为 0', () => {
      const v1 = [1, 0, 0];
      const v2 = [0, 1, 0];

      const similarity = cosineSimilarity(v1, v2);
      expect(similarity).toBeCloseTo(0);
    });

    test('方向相反的向量相似度应为 -1', () => {
      const v1 = [1, 2, 3];
      const v2 = [-1, -2, -3];

      const similarity = cosineSimilarity(v1, v2);
      expect(similarity).toBeCloseTo(-1);
    });

    test.todo('应该处理零向量');
    test.todo('应该处理不同维度的向量');
  });

  describe('createZeroVector', () => {
    test('应该创建指定维度的零向量', () => {
      const dim = 5;
      const zeroVector = createZeroVector(dim);

      expect(zeroVector.length).toBe(dim);
      expect(zeroVector.every(val => val === 0)).toBe(true);
    });

    test.todo('应该处理维度为 0 的情况');
    test.todo('应该处理非常大的维度');
  });
});
