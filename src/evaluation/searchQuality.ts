export interface QueryJudgments {
  id: string;
  query: string;
  relevance: Record<string, number>;
}
export interface QualityMetrics {
  ndcg: number;
  recall: number;
  precision: number;
  unjudged: number;
  retrieved: number;
}

/** Graded nDCG and binary recall at K; unknown documents count as unjudged. */
export function evaluateRanking(
  relevance: Record<string, number>,
  ranking: string[],
  k = 10,
): QualityMetrics {
  if (!Number.isInteger(k) || k < 1)
    throw new Error('K must be a positive integer');
  const grades = Object.values(relevance);
  if (
    !grades.length ||
    grades.some(grade => !Number.isInteger(grade) || grade < 0 || grade > 3) ||
    !grades.some(grade => grade > 0)
  )
    throw new Error(
      'Judgments need grades 0–3 and at least one relevant document',
    );
  if (!ranking.every(id => typeof id === 'string' && id.length > 0))
    throw new Error('Ranking IDs must be nonempty strings');
  if (new Set(ranking).size !== ranking.length)
    throw new Error('Duplicate ranking IDs are not allowed');
  const top = ranking.slice(0, k);
  const gain = (grade: number, rank: number) =>
    (2 ** grade - 1) / Math.log2(rank + 2);
  const dcg = top.reduce(
    (sum, id, rank) =>
      sum + gain(Object.hasOwn(relevance, id) ? relevance[id] : 0, rank),
    0,
  );
  const ideal = [...grades]
    .sort((a, b) => b - a)
    .slice(0, k)
    .reduce((sum, grade, rank) => sum + gain(grade, rank), 0);
  const relevant = top.filter(
    id => Object.hasOwn(relevance, id) && relevance[id] > 0,
  ).length;
  return {
    ndcg: dcg / ideal,
    recall: relevant / grades.filter(grade => grade > 0).length,
    precision: relevant / k,
    unjudged: top.filter(id => !Object.hasOwn(relevance, id)).length,
    retrieved: top.length,
  };
}

export function evaluateRun(
  queries: QueryJudgments[],
  rankings: Record<string, string[]>,
  k = 10,
) {
  if (
    !queries.length ||
    new Set(queries.map(item => item.id)).size !== queries.length ||
    queries.some(item => !item.id || !item.query?.trim())
  )
    throw new Error('Queries must have unique IDs and nonblank text');
  const perQuery = queries.map(item => {
    if (!Object.hasOwn(rankings, item.id) || !Array.isArray(rankings[item.id]))
      throw new Error(`Missing ranking for query ${item.id}`);
    return {
      id: item.id,
      query: item.query,
      ...evaluateRanking(item.relevance, rankings[item.id], k),
    };
  });
  return {
    k,
    queryCount: queries.length,
    meanNdcg:
      perQuery.reduce((sum, row) => sum + row.ndcg, 0) / perQuery.length,
    meanRecall:
      perQuery.reduce((sum, row) => sum + row.recall, 0) / perQuery.length,
    meanPrecision:
      perQuery.reduce((sum, row) => sum + row.precision, 0) / perQuery.length,
    unjudgedAtK: perQuery.reduce((sum, row) => sum + row.unjudged, 0),
    perQuery,
  };
}
