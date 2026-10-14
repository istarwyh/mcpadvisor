import assert from 'node:assert/strict';
import test from 'node:test';
import { summarizeKnownPositives } from './report-known-positive-engine.mjs';
const tasks = {
  label: 'illustrative',
  queries: [
    { id: 'q', answerability: 'answerable', relevance: { a: 3 } },
    { id: 'u', answerability: 'no-known-relevant', relevance: {} },
  ],
};
const catalog = [{ id: 'a' }, { id: 'b' }];
test('known-positive report separates nonempty retrieval from documented relevance', () => {
  const result = summarizeKnownPositives(
    tasks,
    { q: [], u: [] },
    { q: ['b'], u: [] },
    catalog,
  );
  assert.equal(result.candidate.empty, 1);
  assert.equal(result.candidate.answerableKnownPositiveHit, 0);
  assert.equal(result.gate.passed, false);
});
test('known-positive gate requires a gain without unsupported expansion', () => {
  assert.equal(
    summarizeKnownPositives(
      tasks,
      { q: [], u: [] },
      { q: ['a'], u: [] },
      catalog,
    ).gate.passed,
    true,
  );
  assert.equal(
    summarizeKnownPositives(
      tasks,
      { q: [], u: [] },
      { q: ['a'], u: ['b'] },
      catalog,
    ).gate.passed,
    false,
  );
});
test('known-positive report rejects missing queries and out-of-corpus judgments', () => {
  assert.throws(() =>
    summarizeKnownPositives(tasks, { q: [] }, { q: ['a'], u: [] }, catalog),
  );
  assert.throws(() =>
    summarizeKnownPositives(tasks, { q: [], u: [] }, { q: ['a'], u: [] }, [
      { id: 'b' },
    ]),
  );
});
