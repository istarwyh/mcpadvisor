import { describe, expect, it } from 'vitest';
import {
  prepareJudgmentPool,
  validateQueries,
} from '../../../evaluation/judgmentPool.js';
import {
  evaluateRun,
  type QueryJudgments,
} from '../../../evaluation/searchQuality.js';

const queries = {
  label: 'illustrative',
  queries: [{ id: 'q', query: 'files' }],
};
const catalog = ['a', 'b', 'c'].map(id => ({
  id,
  name: id,
  description: `${id} server`,
}));

describe('独立标注候选池', () => {
  it('合并每个系统 top-K，保留候选新增结果，不泄露来源或排名', () => {
    const pool = prepareJudgmentPool(
      queries,
      [{ q: ['a', 'b'] }, { q: ['b', 'c'] }],
      catalog,
      2,
    );
    expect(pool.queries[0].relevance).toEqual({ a: null, b: null, c: null });
    expect(pool.documents).toEqual(catalog);
    expect(pool.label).toBe('illustrative');
    expect(pool).toEqual(
      prepareJudgmentPool(
        queries,
        [{ q: ['c', 'b'] }, { q: ['b', 'a'] }],
        catalog,
        2,
      ),
    );
    expect(() =>
      evaluateRun(pool.queries as unknown as QueryJudgments[], { q: ['a'] }),
    ).toThrow();
  });
  it('按每次运行的深度截断，空结果保持为空，不能伪造零分标签', () => {
    expect(
      prepareJudgmentPool(
        queries,
        [{ q: ['a', 'b'] }, { q: ['c'] }],
        catalog,
        1,
      ).queries[0].relevance,
    ).toEqual({ a: null, c: null });
    expect(
      prepareJudgmentPool(queries, [{ q: [] }], catalog).queries[0].relevance,
    ).toEqual({});
  });
  it.each([
    {},
    { q: ['a', 'a'] },
    { q: ['missing'] },
    { q: ['a'], extra: [] },
    { q: [42] },
    { q: [' '] },
  ])('拒绝缺失查询、重复、未知或非法公开 ID: %j', run => {
    expect(() => prepareJudgmentPool(queries, [run], catalog)).toThrow();
  });
  it('截断之外的未知 ID 也意味着目录快照不一致', () => {
    expect(() =>
      prepareJudgmentPool(queries, [{ q: ['a', 'missing'] }], catalog, 1),
    ).toThrow();
  });
  it('数字型 ID 使用显式候选数组保留呈现顺序', () => {
    const ids = ['123', '4', '99'];
    const pool = prepareJudgmentPool(
      queries,
      [{ q: ids }],
      ids.map(id => ({ id })),
    );
    const replay = prepareJudgmentPool(
      queries,
      [{ q: [...ids].reverse() }],
      ids.map(id => ({ id })),
    );
    expect(pool.queries[0].candidateIds).toEqual(
      replay.queries[0].candidateIds,
    );
    expect(new Set(pool.queries[0].candidateIds)).toEqual(new Set(ids));
    expect(JSON.parse(JSON.stringify(pool)).queries[0].candidateIds).toEqual(
      pool.queries[0].candidateIds,
    );
  });
  it('保留特殊属性 ID 为数据，不能污染原型', () => {
    const input = {
      label: 'business',
      queries: [{ id: '__proto__', query: 'files' }],
    };
    const run = JSON.parse('{"__proto__":["__proto__"]}');
    const pool = prepareJudgmentPool(input, [run], [{ id: '__proto__' }]);
    expect(Object.hasOwn(pool.queries[0].relevance, '__proto__')).toBe(true);
    expect(pool.queries[0].relevance.__proto__).toBeNull();
    expect(pool.label).toBe('business');
  });
  it.each([
    { label: ['business'], queries: queries.queries },
    null,
    [],
    { label: 'business', queries: [] },
    { ...queries, queries: [queries.queries[0], queries.queries[0]] },
    { label: 'synthetic', queries: queries.queries },
  ])('拒绝无效查询集: %j', input => {
    expect(() => validateQueries(input)).toThrow();
  });
  it('拒绝不一致目录、无运行及无效深度', () => {
    expect(() =>
      prepareJudgmentPool(queries, [{ q: ['a'] }], [...catalog, catalog[0]]),
    ).toThrow();
    expect(() => prepareJudgmentPool(queries, [], catalog)).toThrow();
    for (const k of [0, -1, 1.5, 1001, NaN])
      expect(() =>
        prepareJudgmentPool(queries, [{ q: [] }], catalog, k),
      ).toThrow();
  });
});
