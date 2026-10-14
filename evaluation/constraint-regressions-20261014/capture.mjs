// Run from the candidate checkout after building both checkouts. Local engine only.
// Args: baseline checkout, candidate checkout, frozen suite, NEW output file.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { pathToFileURL, URL } from 'node:url';
import { setTimeout } from 'node:timers';

const { fetch } = globalThis;
const [baselineRoot, candidateRoot, suitePath, outputPath] = process.argv
  .slice(2)
  .map(p => path.resolve(p));
if (!outputPath)
  throw new Error('Provide baseline, candidate, suite and NEW output path');
const host = process.env.MEILI_FULLTEXT_TEST_HOST;
const url = new URL(host);
assert.equal(url.protocol, 'http:');
assert.equal(url.hostname, '127.0.0.1');
assert.equal(url.pathname, '/');
assert.ok(!url.username && !url.password && !url.search && !url.hash);
const request = async (method, route, body) => {
  const result = await fetch(new URL(route, url), {
    method,
    headers: { 'content-type': 'application/json' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  if (!result.ok) throw new Error(`Engine request failed: ${result.status}`);
  return result.json();
};
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const bytes = await readFile(suitePath);
const suite = JSON.parse(bytes);
assert.equal(
  hash(bytes),
  '38aebde39de98272aa67215811b00afb8b794204cb944d42ac6bade47e09e81a',
);
const catalogBytes = await readFile(
  path.join(candidateRoot, 'data/mcp_server_list.json'),
);
assert.equal(
  hash(catalogBytes),
  hash(await readFile(path.join(baselineRoot, 'data/mcp_server_list.json'))),
);
const catalog = Object.fromEntries(
  JSON.parse(catalogBytes).map(row => [row.id, row]),
);
const result = {
  label: 'illustrative',
  generatedAt: new Date().toISOString(),
  command:
    'MEILI_FULLTEXT_TEST_HOST=http://127.0.0.1:17714 node evaluation/constraint-regressions-20261014/capture.mjs BASELINE_CHECKOUT CANDIDATE_CHECKOUT evaluation/constraint-regressions-20261014/blind-suite.json NEW_OUTPUT',
  suiteSha256: hash(bytes),
  catalogSha256: hash(catalogBytes),
  catalogCount: Object.keys(catalog).length,
  version: await request('GET', '/version'),
  limitations: [
    'Independent authored regression probes, not production traffic or human relevance labels.',
    'Provider results are real Meilisearch; service-isolated runs use actual SearchService with offline disabled.',
    'Default aggregation includes actual offline fallback; it is separately reported and never attributed to Meili.',
    'Other online providers and optional professional reranking are not configured or exercised.',
    'Embedding model may fall back through the unmodified application behavior; stderr is captured separately.',
  ],
  runs: {},
};
assert.equal(result.version.pkgVersion, '1.15.2');
for (const [name, root] of [
  ['baseline', baselineRoot],
  ['candidate', candidateRoot],
]) {
  const git = (...args) =>
    execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
  const plannerPath = 'src/services/core/search/meilisearchQuery.ts';
  const plannerHash = hash(await readFile(path.join(root, plannerPath)));
  if (name === 'candidate')
    assert.equal(
      plannerHash,
      'bd9d12389364720bdf502f2d6633dbac907995f14eb989aea8314999541177bc',
    );
  if (name === 'baseline')
    assert.equal(git('rev-parse', 'HEAD'), suite.baselineCommit);
  const load = async file =>
    import(pathToFileURL(path.join(root, `build/${file}.js`)).href);
  const { MeilisearchSearchProvider } = await load(
    'services/core/search/MeilisearchSearchProvider',
  );
  const { LocalMeilisearchController } = await load(
    'services/providers/meilisearch/localController',
  );
  const { SearchService } = await load('services/searchService');
  const { buildMeilisearchQuery } = await load(
    'services/core/search/meilisearchQuery',
  );
  const { getEmbeddingProvider } = await load('utils/embedding');
  const indexName = `constraint_capture_${randomUUID().replaceAll('-', '')}`;
  // Reserve the index first so cleanup only removes an index owned by this run.
  const creation = await request('POST', '/indexes', {
    uid: indexName,
    primaryKey: 'id',
  });
  const waitTask = async task => {
    for (let attempt = 0; attempt < 600; attempt++) {
      const state = await request('GET', `/tasks/${task.taskUid}`);
      if (state.status === 'succeeded') return;
      if (['failed', 'canceled'].includes(state.status))
        throw new Error('Engine task failed');
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    throw new Error('Engine task timed out');
  };
  await waitTask(creation);
  try {
    const provider = new MeilisearchSearchProvider(
      { fetchData: async () => catalog },
      undefined,
      new LocalMeilisearchController({
        type: 'local',
        host,
        indexName,
        autoIndex: true,
      }),
    );
    const isolated = new SearchService([provider], { enabled: false });
    const aggregate = new SearchService([provider], {
      fallbackDataPath: path.join(root, 'data/mcp_server_list.json'),
    });
    const rows = [];
    const compact = values =>
      values.map(({ id, title, similarity, source }) => ({
        id,
        title,
        similarity,
        ...(source ? { source } : {}),
      }));
    for (const task of suite.cases) {
      const params = { taskDescription: task.query };
      rows.push({
        id: task.id,
        query: task.query,
        prepared: buildMeilisearchQuery(params, catalog),
        provider: compact(await provider.search(params)),
        isolated: compact(await isolated.search(params, { limit: 5 })),
        aggregate: compact(await aggregate.search(params, { limit: 5 })),
        embeddingProvider: getEmbeddingProvider().getName(),
      });
    }
    result.runs[name] = {
      buildFilesSha256: Object.fromEntries(
        await Promise.all(
          [
            'services/core/search/meilisearchQuery',
            'services/core/search/MeilisearchSearchProvider',
            'services/providers/meilisearch/localController',
            'services/searchService',
          ].map(async file => [
            file,
            hash(await readFile(path.join(root, `build/${file}.js`))),
          ]),
        ),
      ),
      sourceCommit: git('rev-parse', 'HEAD'),
      dirty: !!git('status', '--porcelain=v1', '--untracked-files=all'),
      trackedDiffSha256: hash(git('diff', 'HEAD')),
      plannerSha256: plannerHash,
      provider: 'MeilisearchSearchProvider + LocalMeilisearchController',
      settings: await request('GET', `/indexes/${indexName}/settings`),
      stats: await request('GET', `/indexes/${indexName}/stats`),
      rows,
    };
    assert.equal(
      result.runs[name].stats.numberOfDocuments,
      Object.keys(catalog).length,
    );
  } finally {
    await waitTask(await request('DELETE', `/indexes/${indexName}`));
  }
}
await writeFile(outputPath, `${JSON.stringify(result, null, 2)}\n`, {
  flag: 'wx',
});
