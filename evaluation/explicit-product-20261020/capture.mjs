import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import {
  readFile,
  writeFile,
  appendFile,
  open,
  unlink,
  access,
} from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { pathToFileURL, URL } from 'node:url';
import process from 'node:process';
import console from 'node:console';
import { setTimeout } from 'node:timers';
const { fetch } = globalThis;
const [rootArg, suitePath, outputPrefix, host] = process.argv.slice(2);
if (!rootArg || !suitePath || !outputPrefix || !host)
  throw Error(
    'Usage: node capture.mjs CHECKOUT SUITE_JSON NEW_OUTPUT_PREFIX LOOPBACK_HOST',
  );
const root = path.resolve(rootArg);
const label = path.basename(outputPrefix);
const outputPath = path.resolve(outputPrefix + '.json');
const logPath = path.resolve(outputPrefix + '-rows.jsonl');
// Fail quickly for existing files; atomic wx reservations below also close races.
for (const target of [outputPath, logPath]) {
  try {
    await access(target);
    throw new Error('Output already exists: ' + target);
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
}
const endpoint = new URL(host);
assert.equal(endpoint.protocol, 'http:');
assert.equal(endpoint.hostname, '127.0.0.1');
assert.equal(endpoint.pathname, '/');
assert.ok(
  !endpoint.username &&
    !endpoint.password &&
    !endpoint.search &&
    !endpoint.hash,
);
const sha = b => createHash('sha256').update(b).digest('hex');
const bytes = await readFile(suitePath);
assert.equal(
  sha(bytes),
  '7c7fde7cd7ba694d4d156543277f611510196d33ed8e445fefcee31ad389d994',
);
const suite = JSON.parse(bytes);
const publicBytes = await readFile(
  root + '/evaluation/product-evidence-20261016/public-probes.json',
);
assert.equal(
  sha(publicBytes),
  '315bef16aa1d60dd73bbf89bd783c1b0d4dd0e8da1776d23170a1d619049b821',
);
const probes = [
  ...suite.probes.map(p => ({ ...p, set: 'new-holdout' })),
  ...JSON.parse(publicBytes).probes.map(p => ({
    ...p,
    set: 'public-replay',
  })),
  ...suite.non_specific_catalog_queries.map((query, i) => ({
    id: 'o' + (i + 1),
    query,
    set: 'ordinary-parity',
  })),
];
const git = (...args) =>
  execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
const files = git(
  'ls-files',
  '-z',
  'src',
  'tsconfig.json',
  'package.json',
  'pnpm-lock.yaml',
  'data/mcp_server_list.json',
)
  .split('\0')
  .filter(Boolean)
  .sort();
const snapshot = async () =>
  Object.fromEntries(
    await Promise.all(
      files.map(async p => [p, sha(await readFile(path.join(root, p)))]),
    ),
  );
const sourceBefore = await snapshot();
const sourceCommit = git('rev-parse', 'HEAD');
if (label === 'baseline')
  assert.equal(sourceCommit, '769ea22683bc7875562983b6fdb6067d95e8257d');
const require = createRequire(pathToFileURL(path.join(root, 'package.json')));
execFileSync(process.execPath, [require.resolve('typescript/bin/tsc')], {
  cwd: root,
  stdio: 'pipe',
});
assert.deepEqual(await snapshot(), sourceBefore, 'source changed during build');
const load = async file =>
  import(pathToFileURL(path.join(root, 'build', file + '.js')));
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
const catalogBytes = await readFile(root + '/data/mcp_server_list.json');
const catalog = Object.fromEntries(
  JSON.parse(catalogBytes).map(row => [row.id, row]),
);
const request = async (method, route, body) => {
  const r = await fetch(host + route, {
    method,
    headers: { 'content-type': 'application/json' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  if (!r.ok) throw Error('HTTP ' + r.status);
  return r.json();
};
const waitTask = async task => {
  for (let i = 0; i < 600; i++) {
    let r = await request('GET', '/tasks/' + task.taskUid);
    if (r.status === 'succeeded') return;
    if (['failed', 'canceled'].includes(r.status))
      throw Error(JSON.stringify(r.error));
    await new Promise(r => setTimeout(r, 50));
  }
  throw Error('task timeout');
};
const index = 'review_fullphrase_' + randomUUID().replaceAll('-', '');
const compact = rows =>
  rows.map(({ id, title, similarity, score, source }) => ({
    id,
    title,
    similarity,
    ...(score === undefined ? {} : { score }),
    ...(source ? { source } : {}),
  }));
const result = {
  label,
  sourceCommit,
  sourceBefore,
  sourceSha256: sha(JSON.stringify(sourceBefore)),
  worktreeStatus: git('status', '--porcelain=v1'),
  suiteSha256: sha(bytes),
  catalogSha256: sha(catalogBytes),
  compilerVersion: require('typescript/package.json').version,
  engineVersion: await request('GET', '/version'),
  startedAt: new Date().toISOString(),
  rows: [],
};
// Reserve both output files before creating any engine resources. Never overwrite.
const output = await open(outputPath, 'wx');
try {
  await writeFile(logPath, '', { flag: 'wx' });
} catch (error) {
  await output.close();
  await unlink(outputPath); // Only the empty file created by this invocation.
  throw error;
}
let indexCreated = false;
result.indexName = index;
result.indexReservationState = 'not_started';
try {
  result.indexReservationState = 'requested';
  const reservation = await request('POST', '/indexes', {
    uid: index,
    primaryKey: 'id',
  });
  result.indexReservationState = 'accepted';
  await waitTask(reservation);
  indexCreated = true;
  result.indexReservationState = 'created';
  const provider = new MeilisearchSearchProvider(
    { fetchData: async () => catalog },
    undefined,
    new LocalMeilisearchController({
      type: 'local',
      host,
      indexName: index,
      autoIndex: true,
    }),
  );
  const isolated = new SearchService([provider], { enabled: false });
  const aggregate = new SearchService([provider], {
    fallbackDataPath: root + '/data/mcp_server_list.json',
  });
  const offline = new SearchService([], {
    fallbackDataPath: root + '/data/mcp_server_list.json',
  });
  for (const p of probes) {
    const params = { taskDescription: p.query };
    const r = {
      ...p,
      prepared: buildMeilisearchQuery(params, catalog),
      provider: compact(await provider.search(params)),
      isolated: compact(await isolated.search(params, { limit: 5 })),
      aggregate: compact(await aggregate.search(params, { limit: 5 })),
      offline: compact(await offline.search(params, { limit: 5 })),
      embeddingProvider: getEmbeddingProvider().getName(),
    };
    result.rows.push(r);
    await appendFile(logPath, JSON.stringify(r) + '\n');
  }
  result.settings = await request('GET', '/indexes/' + index + '/settings');
  result.stats = await request('GET', '/indexes/' + index + '/stats');
  assert.equal(result.stats.numberOfDocuments, Object.keys(catalog).length);
  assert.deepEqual(
    await snapshot(),
    sourceBefore,
    'source changed during capture',
  );
  result.completedAt = new Date().toISOString();
} catch (e) {
  result.failure = { message: e.message, stack: e.stack };
  process.exitCode = 1;
} finally {
  try {
    if (indexCreated) {
      await waitTask(await request('DELETE', '/indexes/' + index));
      result.indexRemoved = true;
    }
  } catch (error) {
    result.cleanupFailure = { message: error.message };
    process.exitCode = 1;
  }
  try {
    await output.writeFile(JSON.stringify(result, null, 2) + '\n');
  } finally {
    await output.close();
  }
  console.log(
    JSON.stringify({
      label,
      rows: result.rows.length,
      failure: result.failure?.message,
      cleanupFailure: result.cleanupFailure?.message,
      outputPath,
    }),
  );
}
