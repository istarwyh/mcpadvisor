// Rebuild both checkouts and bind source/build snapshots. Local engine only.
// Args: baseline checkout, candidate checkout, frozen suite, NEW output file.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { readFile, writeFile, readdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
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
const sourceSnapshot = async root => {
  const git = (...args) =>
    execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
  const paths = git(
    'ls-files',
    '--cached',
    '--others',
    '--exclude-standard',
    '-z',
    'src',
    'tsconfig.json',
    'package.json',
    'pnpm-lock.yaml',
  )
    .split('\0')
    .filter(Boolean)
    .sort();
  return {
    commit: git('rev-parse', 'HEAD'),
    worktreeStatus: git('status', '--porcelain=v1', '--untracked-files=all'),
    trackedDiffSha256: hash(git('diff', 'HEAD')),
    files: Object.fromEntries(
      await Promise.all(
        paths.map(async file => [
          file,
          hash(await readFile(path.join(root, file))),
        ]),
      ),
    ),
  };
};
const buildSnapshot = async root => {
  const walk = async relative => {
    const files = [];
    for (const item of await readdir(path.join(root, relative), {
      withFileTypes: true,
    })) {
      const name = path.join(relative, item.name);
      if (item.isDirectory()) files.push(...(await walk(name)));
      else if (item.isFile()) files.push(name);
      else throw new Error('Build snapshot must contain regular files');
    }
    return files;
  };
  const paths = (await walk('build')).sort();
  return Object.fromEntries(
    await Promise.all(
      paths.map(async file => [
        file,
        hash(await readFile(path.join(root, file))),
      ]),
    ),
  );
};
const captureScriptSha256 = hash(await readFile(new URL(import.meta.url)));
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
  validationStatus:
    'Observed 16-case regression replay for offline initialization single-flight; not independent holdout validation',
  captureScriptSha256,
  command:
    'MEILI_FULLTEXT_TEST_HOST=http://127.0.0.1:17715 node evaluation/offline-initialization-20261015/capture-observed.mjs BASELINE_CHECKOUT CANDIDATE_CHECKOUT evaluation/constraint-regressions-20261014/blind-suite.json NEW_OUTPUT',
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
      '5348aaed138475a9af467d0859aa57b22f5a5f46f32aa622bbe46ac70d5a43ef',
    );
  if (name === 'baseline')
    assert.equal(
      git('rev-parse', 'HEAD'),
      '5c13693ca7e1fc6b3bde8f4d9b050f147ba10533',
    );
  const sourceBefore = await sourceSnapshot(root);
  const require = createRequire(pathToFileURL(path.join(root, 'package.json')));
  const compilerVersion = require('typescript/package.json').version;
  execFileSync(process.execPath, [require.resolve('typescript/bin/tsc')], {
    cwd: root,
    stdio: 'pipe',
  });
  assert.deepEqual(
    await sourceSnapshot(root),
    sourceBefore,
    'Source changed while building',
  );
  const buildBefore = await buildSnapshot(root);
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
  const { OfflineDataLoader } = await load(
    'services/providers/offline/offlineDataLoader',
  );
  const { WritableInMemoryVectorEngine } = await load(
    'services/providers/offline/writableVectorEngine',
  );
  const initialization = { loads: 0, insertions: 0 };
  const originalLoad =
    OfflineDataLoader.prototype.loadFallbackDataWithEmbeddings;
  const originalAdd = WritableInMemoryVectorEngine.prototype.addEntry;
  OfflineDataLoader.prototype.loadFallbackDataWithEmbeddings = function (
    ...args
  ) {
    initialization.loads++;
    return originalLoad.apply(this, args);
  };
  WritableInMemoryVectorEngine.prototype.addEntry = function (...args) {
    initialization.insertions++;
    return originalAdd.apply(this, args);
  };
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
  try {
    await waitTask(creation);
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
      values.map(({ id, title, similarity, score, source }) => ({
        id,
        title,
        similarity,
        ...(score === undefined ? {} : { score }),
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
      initialization,
      freshBuild: {
        command: 'node node_modules/typescript/bin/tsc',
        compilerVersion,
      },
      sourceSnapshot: sourceBefore,
      sourceSnapshotSha256: hash(JSON.stringify(sourceBefore)),
      buildFilesSha256: buildBefore,
      buildSnapshotSha256: hash(JSON.stringify(buildBefore)),
      sourceCommit: sourceBefore.commit,
      dirty: !!sourceBefore.worktreeStatus,
      worktreeStatus: sourceBefore.worktreeStatus,
      trackedDiffSha256: sourceBefore.trackedDiffSha256,
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
    assert.deepEqual(
      await sourceSnapshot(root),
      sourceBefore,
      'Source changed during capture',
    );
    assert.deepEqual(
      await buildSnapshot(root),
      buildBefore,
      'Build changed during capture',
    );
  } finally {
    OfflineDataLoader.prototype.loadFallbackDataWithEmbeddings = originalLoad;
    WritableInMemoryVectorEngine.prototype.addEntry = originalAdd;
    await waitTask(await request('DELETE', `/indexes/${indexName}`));
  }
}
assert.equal(
  hash(await readFile(new URL(import.meta.url))),
  captureScriptSha256,
  'Capture runner changed during execution',
);
await writeFile(outputPath, `${JSON.stringify(result, null, 2)}\n`, {
  flag: 'wx',
});
