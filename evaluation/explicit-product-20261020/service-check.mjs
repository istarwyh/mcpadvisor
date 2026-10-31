import process from 'node:process';
import console from 'node:console';
import { pathToFileURL } from 'node:url';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
const [root, suitePath, outputPath] = process.argv.slice(2);
if (!root || !suitePath || !outputPath)
  throw Error('Usage: node service-check.mjs CHECKOUT SUITE_JSON NEW_OUTPUT');
// Run capture.mjs first to freshly build and bind this checkout.
const { SearchService } = await import(
  pathToFileURL(path.join(root, 'build/services/searchService.js'))
);
const suite = JSON.parse(await readFile(suitePath));
const fixture = suite.fixtures.map((r, i) => ({
  similarity: 0.95 - i * 0.001,
  description: '',
  sourceUrl: 'https://example.test/' + r.id,
  ...r,
}));
const results = [];
for (const id of [
  'h01',
  'h07',
  'h09',
  'h10',
  'h13',
  'h14',
  'h19',
  'h24',
  'h26',
]) {
  const q = suite.unit_cases.find(x => x.id === id);
  const acceptable = q.expected_ids ?? fixture.map(r => r.id);
  const rows = [...fixture].sort(
    (a, b) =>
      (acceptable.includes(a.id) ? 1 : 0) - (acceptable.includes(b.id) ? 1 : 0),
  );
  const service = new SearchService([{ search: async () => rows }], {
    enabled: false,
  });
  const actual = await service.search(
    { taskDescription: q.query },
    { limit: 1, minSimilarity: 0 },
  );
  const pass = acceptable.length
    ? actual.length === 1 && acceptable.includes(actual[0].id)
    : actual.length === 0;
  results.push({
    id,
    query: q.query,
    path: 'top-k',
    actual: actual.map(r => r.id),
    pass,
  });
}
const q = suite.unit_cases.find(x => x.id === 'h01');
let seen;
let fail = false;
const ranker = {
  rerank: async (_query, rows) => {
    seen = rows.map(r => r.id);
    if (fail) throw Error('controlled evaluation failure');
    return [...rows].reverse();
  },
};
const service = new SearchService(
  [{ search: async () => fixture }],
  { enabled: false },
  ranker,
);
for (const mode of ['success', 'failure']) {
  fail = mode === 'failure';
  const actual = await service.search(
    { taskDescription: q.query },
    { limit: 5, minSimilarity: 0 },
  );
  results.push({
    id: 'h01',
    path: 'professional-' + mode,
    inputIds: seen,
    actual: actual.map(r => r.id),
    pass:
      !!seen &&
      seen.length === q.expected_ids.length &&
      seen.every(id => q.expected_ids.includes(id)) &&
      actual.length === q.expected_ids.length &&
      actual.every(r => q.expected_ids.includes(r.id)),
  });
}
await writeFile(outputPath, JSON.stringify({ results }, null, 2) + '\n', {
  flag: 'wx',
});
console.log(
  JSON.stringify({
    pass: results.filter(x => x.pass).length,
    total: results.length,
  }),
);
