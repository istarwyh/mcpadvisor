import type { QueryJudgments } from '../../../evaluation/searchQuality.js';
import { describe, expect, it } from 'vitest';
import {
  evaluateRanking,
  evaluateRun,
} from '../../../evaluation/searchQuality.js';
describe('搜索质量评估', () => {
  it('理想排序得分为一，并正确区分分级相关性', () => {
    const judgments = { a: 3, b: 2, c: 0 };
    expect(evaluateRanking(judgments, ['a', 'b', 'c'], 3)).toMatchObject({
      ndcg: 1,
      recall: 1,
      precision: 2 / 3,
      unjudged: 0,
    });
    expect(evaluateRanking(judgments, ['b', 'a', 'c'], 3).ndcg).toBeCloseTo(
      (3 + 7 / Math.log2(3)) / (7 + 3 / Math.log2(3)),
    );
  });
  it('短结果列表不会虚增召回或精确率', () => {
    expect(evaluateRanking({ a: 3, b: 2 }, ['a'], 10)).toMatchObject({
      recall: 0.5,
      precision: 0.1,
      retrieved: 1,
    });
    expect(evaluateRanking({ a: 3 }, [], 10)).toMatchObject({
      ndcg: 0,
      recall: 0,
      precision: 0,
    });
  });
  it('单独报告未标注结果，并防止重复结果虚增得分', () => {
    expect(evaluateRanking({ a: 3 }, ['unknown', 'a'], 2)).toMatchObject({
      unjudged: 1,
      recall: 1,
    });
    expect(() => evaluateRanking({ a: 3 }, ['a', 'a'])).toThrow('Duplicate');
  });
  it.each([0, -1, 1.5])('拒绝无效的截断参数 %s', k =>
    expect(() => evaluateRanking({ a: 3 }, ['a'], k)).toThrow(),
  );
  it.each<Record<string, number>>([
    {},
    { a: 0 },
    { a: 4 },
    { a: -1 },
    { a: 1.5 },
  ])('拒绝缺失或无效的相关性标注', grades =>
    expect(() => evaluateRanking(grades, ['a'])).toThrow(),
  );
  it('比较必须覆盖同一组查询，不能悄悄跳过失败查询', () => {
    const queries: QueryJudgments[] = [
      { id: 'q1', query: 'files', relevance: { a: 3 } },
      { id: 'q2', query: 'browser', relevance: { b: 3 } },
    ];
    expect(() => evaluateRun(queries, { q1: ['a'] })).toThrow('Missing');
    expect(() => evaluateRun([queries[0], queries[0]], { q1: ['a'] })).toThrow(
      'unique',
    );
    expect(
      evaluateRun(queries, { q1: ['a'], q2: ['unknown'] }, 1),
    ).toMatchObject({
      queryCount: 2,
      meanNdcg: 0.5,
      meanRecall: 0.5,
      unjudgedAtK: 1,
    });
  });
});
