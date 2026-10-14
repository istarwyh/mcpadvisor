import { URL } from 'node:url';
import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { loadEvaluation } from './report-agent-task-engine.mjs';
const clone = value => JSON.parse(JSON.stringify(value));
const {
  evaluateAgentTasks,
  validateAgentTasks,
  validateExperimentHost,
  contentHash,
} = await loadEvaluation();
const tasks = {
  label: 'illustrative',
  queries: ['development', 'holdout'].map((split, i) => ({
    id: `q${i}`,
    query: `task ${i}`,
    audience: 'developer',
    language: 'en',
    split,
    family: `family${i}`,
    intent: 'A supported task',
    critical: true,
  })),
};
const judgments = {
  label: 'illustrative',
  assessor: 'Synthetic unit fixture, not actual assessment',
  queries: tasks.queries.map(({ id, query }) => ({
    id,
    query,
    answerability: 'answerable',
    relevance: { a: 3, b: 0 },
    rationale: 'Synthetic fixture',
  })),
};
const good = { q0: ['a', 'b'], q1: ['a', 'b'] };
const bad = { q0: ['b', 'a'], q1: ['b', 'a'] };
const evaluate = (j = judgments, a = good, b = good) =>
  evaluateAgentTasks(tasks, j, a, b, ['a', 'b']);

test('identical rankings never pass the preregistered improvement gate', () => {
  const result = evaluate();
  assert.equal(result.development.baseline.meanNdcg, 1);
  assert.equal(result.holdout.meanNdcgDelta, 0);
  assert.equal(result.gate.passed, false);
});
test('both independent splits must improve, with no critical regression', () => {
  assert.equal(evaluate(judgments, bad, good).gate.passed, true);
  assert.equal(
    evaluate(judgments, bad, { ...good, q1: bad.q1 }).gate.passed,
    false,
  );
  assert.deepEqual(evaluate(judgments, good, bad).gate.criticalRegressions, [
    'q0',
    'q1',
  ]);
});
test('a relevant catalog supplement gives empty retrieval zero, not exclusion', () => {
  const result = evaluate(judgments, { q0: [], q1: [] }, { q0: [], q1: [] });
  assert.equal(result.development.scoredQueries, 1);
  assert.equal(result.development.baseline.meanNdcg, 0);
  assert.equal(result.development.relativeNdcgChange, null);
});
test('unsupported queries may have weak grades, are visible, and are not fake successes', () => {
  const j = clone(judgments);
  j.queries[1].answerability = 'no-known-relevant';
  j.queries[1].relevance = { a: 1, b: 0 };
  const result = evaluate(j, good, { q0: good.q0, q1: [] });
  assert.equal(result.holdout.scoredQueries, 0);
  assert.equal(result.holdout.baseline, null);
  assert.equal(result.holdout.noKnownRelevant.length, 1);
  assert.equal(result.gate.passed, false);
});
test('reject unfinished or missing grades, unknown IDs and silent query omissions', () => {
  for (const change of [
    j => (j.queries[0].relevance.a = null),
    j => delete j.queries[0].relevance.b,
    j => j.queries.pop(),
  ]) {
    const j = clone(judgments);
    change(j);
    assert.throws(() => evaluate(j));
  }
  assert.throws(() => evaluate(judgments, { q0: ['other'], q1: [] }, good));
  assert.throws(() => evaluate(judgments, { q0: ['a'] }, good));
});
test('freeze exact query text and prevent family leakage', () => {
  const j = clone(judgments);
  j.queries[0].query = 'changed';
  assert.throws(() => evaluate(j));
  const t = clone(tasks);
  t.queries[1].family = t.queries[0].family;
  assert.throws(() => validateAgentTasks(t));
});
test('capture host guard excludes remote URLs, credentials and non-root paths', () => {
  assert.equal(
    validateExperimentHost('http://127.0.0.1:17713'),
    'http://127.0.0.1:17713',
  );
  for (const host of [
    'https://example.com',
    'http://localhost:17713',
    'http://user:pass@127.0.0.1',
    'http://127.0.0.1/index',
    'http://127.0.0.1/?key=x',
  ])
    assert.throws(() => validateExperimentHost(host));
});
test('checked-in engine evidence covers exact frozen queries/corpus and only the one setting changes', async () => {
  const directory = new URL(
    '../../evaluation/agent-tasks-20261014/',
    import.meta.url,
  );
  const json = async name =>
    JSON.parse(await readFile(new URL(name, directory), 'utf8'));
  const q = await json('queries.json');
  const m = await json('engine-run/manifest.json');
  const catalog = JSON.parse(
    await readFile(
      new URL('../../data/mcp_server_list.json', import.meta.url),
      'utf8',
    ),
  );
  assert.equal(m.queryHash, contentHash(q));
  assert.equal(m.catalogHash, contentHash(catalog));
  assert.equal(m.catalogCount, catalog.length);
  assert.equal(m.meilisearchVersion, '1.15.2');
  assert.equal(m.k, 10);
  const a = await json('engine-run/baseline.json');
  const b = await json('engine-run/candidate.json');
  assert.deepEqual(Object.keys(a).sort(), q.queries.map(x => x.id).sort());
  assert.deepEqual(Object.keys(b).sort(), Object.keys(a).sort());
  const sa = clone(m.settings.baseline);
  const sb = clone(m.settings.candidate);
  assert.deepEqual(sa.searchableAttributes, [
    'title',
    'description',
    'categories',
    'tags',
  ]);
  assert.deepEqual(sb.searchableAttributes, [
    'title',
    'tags',
    'categories',
    'description',
  ]);
  delete sa.searchableAttributes;
  delete sb.searchableAttributes;
  assert.deepEqual(sa, sb);
});

test('weak grade1 cannot hide lost useful grade2/3 recall in the gate', () => {
  const j = clone(judgments);
  for (const query of j.queries) query.relevance = { a: 2, b: 3, c: 1 };
  const result = evaluateAgentTasks(
    tasks,
    j,
    { q0: ['a', 'b'], q1: ['a', 'b'] },
    { q0: ['b', 'c'], q1: ['b', 'c'] },
    ['a', 'b', 'c'],
  );
  assert.ok(result.development.meanNdcgDelta > 0);
  assert.equal(
    result.development.baseline.meanRecall,
    result.development.candidate.meanRecall,
  );
  assert.deepEqual(result.development.usefulRecall, {
    baseline: 1,
    candidate: 0.5,
  });
  assert.equal(result.gate.passed, false);
});

test('report evidence rejects altered queries, rankings, corpus and protocol', async () => {
  const { verifyExperimentEvidence } = await loadEvaluation();
  const c = [{ id: 'a' }, { id: 'b' }];
  const p = {
    k: 10,
    meilisearchVersion: '1.15.2',
    queryPlannerSha256: 'frozen',
    mode: 'query-preparation',
    baselineSearchableAttributes: ['title'],
    candidateSearchableAttributes: ['title'],
  };
  const m = {
    complete: true,
    k: 10,
    meilisearchVersion: '1.15.2',
    queryHash: contentHash(tasks),
    catalogHash: contentHash(c),
    baselineHash: contentHash(good),
    candidateHash: contentHash(bad),
    protocolHash: contentHash(p),
    mode: 'query-preparation',
    settings: {
      baseline: { searchableAttributes: ['title'] },
      candidate: { searchableAttributes: ['title'] },
    },
    settingsHash: contentHash({
      baseline: { searchableAttributes: ['title'] },
      candidate: { searchableAttributes: ['title'] },
    }),
    queryPlannerSha256: 'frozen',
  };
  assert.equal(
    verifyExperimentEvidence(tasks, good, bad, c, m, p).queryHash,
    m.queryHash,
  );
  assert.throws(() =>
    verifyExperimentEvidence(
      { ...tasks, label: 'changed' },
      good,
      bad,
      c,
      m,
      p,
    ),
  );
  assert.throws(() => verifyExperimentEvidence(tasks, bad, bad, c, m, p));
  assert.throws(() =>
    verifyExperimentEvidence(tasks, good, bad, [...c, { id: 'c' }], m, p),
  );
  assert.throws(() =>
    verifyExperimentEvidence(tasks, good, bad, c, m, { ...p, k: 20 }),
  );
  assert.throws(() =>
    verifyExperimentEvidence(tasks, good, bad, c, { ...m, complete: false }, p),
  );
  assert.throws(() =>
    verifyExperimentEvidence(
      tasks,
      good,
      bad,
      c,
      { ...m, mode: 'field-priority' },
      p,
    ),
  );
  const changed = {
    ...m.settings,
    candidate: { searchableAttributes: ['description'] },
  };
  assert.throws(() =>
    verifyExperimentEvidence(
      tasks,
      good,
      bad,
      c,
      { ...m, settings: changed, settingsHash: contentHash(changed) },
      p,
    ),
  );
  const extra = {
    ...m.settings,
    candidate: { searchableAttributes: ['title'], stopWords: ['postgresql'] },
  };
  assert.throws(() =>
    verifyExperimentEvidence(
      tasks,
      good,
      bad,
      c,
      { ...m, settings: extra, settingsHash: contentHash(extra) },
      p,
    ),
  );
});
