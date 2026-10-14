// Deliberately not nDCG/precision: independent expected positives are non-exhaustive.
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import process from 'node:process';
import { loadEvaluation } from './report-agent-task-engine.mjs';

export function summarizeKnownPositives(tasks, baseline, candidate, catalog) {
  assert.equal(tasks.label, 'illustrative');
  const ids = new Set(catalog.map(row => row.id));
  const queryIds = tasks.queries.map(row => row.id);
  assert.equal(new Set(queryIds).size, queryIds.length);
  for (const run of [baseline, candidate])
    assert.deepEqual(Object.keys(run).sort(), [...queryIds].sort());
  const rows = tasks.queries.map(task => {
    assert.ok(['answerable', 'no-known-relevant'].includes(task.answerability));
    const positives = Object.entries(task.relevance)
      .filter(([, grade]) => grade >= 2)
      .map(([id]) => id);
    for (const [id, grade] of Object.entries(task.relevance)) {
      assert.ok(ids.has(id));
      assert.ok(Number.isInteger(grade) && grade >= 0 && grade <= 3);
    }
    assert.equal(positives.length > 0, task.answerability === 'answerable');
    const systems = {};
    for (const [name, run] of Object.entries({ baseline, candidate })) {
      const rank = run[task.id];
      assert.ok(Array.isArray(rank) && rank.length <= 10);
      assert.equal(new Set(rank).size, rank.length);
      rank.forEach(id => assert.ok(ids.has(id)));
      systems[name] = {
        returned: rank.length,
        knownPositiveHits: rank.filter(id => positives.includes(id)),
      };
    }
    return {
      id: task.id,
      language: task.language,
      audience: task.audience,
      answerability: task.answerability,
      ...systems,
    };
  });
  const supported = rows.filter(row => row.answerability === 'answerable');
  const counts = name => ({
    empty: rows.filter(row => !row[name].returned).length,
    answerableKnownPositiveHit: supported.filter(
      row => row[name].knownPositiveHits.length,
    ).length,
    noKnownRelevantNonempty: rows.filter(
      row => row.answerability === 'no-known-relevant' && row[name].returned,
    ).length,
  });
  const a = counts('baseline'),
    b = counts('candidate');
  const lostKnownPositiveQueries = supported
    .filter(
      row =>
        row.baseline.knownPositiveHits.length &&
        !row.candidate.knownPositiveHits.length,
    )
    .map(row => row.id);
  const newlyNonemptyUnsupportedQueries = rows
    .filter(
      row =>
        row.answerability === 'no-known-relevant' &&
        !row.baseline.returned &&
        row.candidate.returned,
    )
    .map(row => row.id);
  return {
    label: 'illustrative',
    queryCount: rows.length,
    answerableCount: supported.length,
    baseline: a,
    candidate: b,
    rows,
    gate: {
      passed:
        b.answerableKnownPositiveHit > a.answerableKnownPositiveHit &&
        !lostKnownPositiveQueries.length &&
        !newlyNonemptyUnsupportedQueries.length,
      lostKnownPositiveQueries,
      newlyNonemptyUnsupportedQueries,
    },
    limitations: [
      'Engine-only branch, not application aggregation or real-user quality',
      'Agent-authored public queries and source-backed expected positives, not human labels',
      'Expected positives are non-exhaustive: no full recall, precision or nDCG claim',
      'Gate concerns this bounded recall repair; it does not satisfy the original ranking promotion gate',
    ],
  };
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const args = process.argv.slice(2);
  assert.equal(
    args.length,
    7,
    'Provide tasks, baseline, candidate, catalog, manifest, protocol, NEW report',
  );
  const inputs = await Promise.all(
    args
      .slice(0, 6)
      .map(async file => JSON.parse(await readFile(file, 'utf8'))),
  );
  const { verifyExperimentEvidence } = await loadEvaluation();
  const evidence = verifyExperimentEvidence(...inputs);
  const report = {
    ...summarizeKnownPositives(...inputs.slice(0, 4)),
    evidence,
  };
  await writeFile(args[6], JSON.stringify(report, null, 2) + '\n', {
    flag: 'wx',
  });
}
