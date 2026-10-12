import { createHash } from 'node:crypto';

export interface EvaluationQueries {
  label: 'illustrative' | 'business';
  queries: { id: string; query: string }[];
}

function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export function validateQueries(value: unknown): EvaluationQueries {
  if (
    !isObject(value) ||
    (value.label !== 'illustrative' && value.label !== 'business') ||
    !Array.isArray(value.queries) ||
    !value.queries.length
  )
    throw new Error('Expected labeled queries');
  const ids = new Set<string>();
  for (const item of value.queries) {
    if (
      !isObject(item) ||
      typeof item.id !== 'string' ||
      !item.id.trim() ||
      typeof item.query !== 'string' ||
      !item.query.trim() ||
      ids.has(item.id)
    )
      throw new Error('Expected unique query IDs and nonblank text');
    ids.add(item.id);
  }
  return value as unknown as EvaluationQueries;
}

/** Validate full runs before truncating; missing queries are not empty runs. */
export function validateRankings(
  queries: EvaluationQueries,
  value: unknown,
): Record<string, string[]> {
  if (!isObject(value) || Object.keys(value).length !== queries.queries.length)
    throw new Error('Rankings must cover exactly the query set');
  for (const { id } of queries.queries) {
    const ranking = value[id];
    if (
      !Object.hasOwn(value, id) ||
      !Array.isArray(ranking) ||
      ranking.some(id => typeof id !== 'string' || !id.trim()) ||
      new Set(ranking).size !== ranking.length
    )
      throw new Error('Expected unique nonblank result IDs for every query');
  }
  return value as Record<string, string[]>;
}

/** Pool top-K from every system without leaking system names or rank order. */
export function prepareJudgmentPool(
  input: unknown,
  rawRuns: unknown[],
  catalog: unknown,
  k = 10,
) {
  const dataset = validateQueries(input);
  if (!Number.isInteger(k) || k < 1 || k > 1000 || !rawRuns.length)
    throw new Error('Expected runs and K from 1 to 1000');
  if (!Array.isArray(catalog)) throw new Error('Expected a catalog array');
  const documents = new Map<
    string,
    { id: string; name: string; description: string }
  >();
  for (const item of catalog) {
    if (
      !isObject(item) ||
      typeof item.id !== 'string' ||
      !item.id.trim() ||
      documents.has(item.id)
    )
      throw new Error('Catalog IDs must be unique strings');
    documents.set(item.id, {
      id: item.id,
      name:
        typeof item.display_name === 'string'
          ? item.display_name
          : typeof item.name === 'string'
            ? item.name
            : item.id,
      description: typeof item.description === 'string' ? item.description : '',
    });
  }
  const runs = rawRuns.map(run => validateRankings(dataset, run));
  // Reject mismatched snapshots, including unknown IDs outside the pool depth.
  for (const run of runs)
    for (const ids of Object.values(run))
      for (const id of ids)
        if (!documents.has(id))
          throw new Error('Ranking ID is absent from catalog');
  const selected = new Set<string>();
  const queries = dataset.queries.map(({ id, query }) => {
    const pool = new Set(runs.flatMap(run => run[id].slice(0, k)));
    // A fixed content hash is reproducible and independent of source/rank.
    const key = (documentId: string) =>
      createHash('sha256')
        .update(JSON.stringify([id, documentId]))
        .digest('hex');
    const ids = [...pool].sort((a, b) => {
      const aa = key(a);
      const bb = key(b);
      return aa < bb ? -1 : aa > bb ? 1 : a < b ? -1 : a > b ? 1 : 0;
    });
    ids.forEach(id => selected.add(id));
    return {
      id,
      query,
      candidateIds: ids,
      relevance: Object.fromEntries(ids.map(id => [id, null])),
    };
  });
  return {
    label: dataset.label,
    poolDepth: k,
    catalogSha256: createHash('sha256')
      .update(JSON.stringify(catalog))
      .digest('hex'),
    note: 'Unjudged pool: null is not grade 0. Independently assign grades 0–3 before evaluation. This is not business acceptance evidence.',
    queries,
    documents: [...selected].sort().map(id => documents.get(id)!),
  };
}
