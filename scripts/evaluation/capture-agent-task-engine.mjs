// Standalone engine-only experiment. No npm packages or production index access.
// This mirrors the checked-in provider document mapping and localController
// settings; it does NOT execute or verify those application modules.
import { Buffer } from 'node:buffer';
import console from 'node:console';
import process from 'node:process';
import { setTimeout } from 'node:timers';
import { URL } from 'node:url';
import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { stripTypeScriptTypes } from 'node:module';
import {
  createTrackedIndex,
  cleanupTrackedIndexes,
} from './engine-capture-lifecycle.mjs';
import http from 'node:http';
import path from 'node:path';

const hash = value =>
  createHash('sha256').update(JSON.stringify(value)).digest('hex');
const [queriesFile, catalogFile, protocolFile, output] = process.argv.slice(2);
const url = new URL(
  process.env.MEILI_EXPERIMENT_HOST || 'http://127.0.0.1:17713',
);
if (
  url.protocol !== 'http:' ||
  url.hostname !== '127.0.0.1' ||
  url.username ||
  url.password ||
  url.pathname !== '/' ||
  url.search ||
  url.hash
)
  throw new Error(
    'Only a disposable numeric IPv4 loopback engine is supported',
  );
if (
  !queriesFile ||
  !catalogFile ||
  !protocolFile ||
  !output ||
  process.argv.length !== 6
)
  throw new Error(
    'Provide queries, catalog, protocol and a NEW output directory',
  );
const queryBytes = await readFile(queriesFile, 'utf8');
const catalogBytes = await readFile(catalogFile, 'utf8');
const protocolBytes = await readFile(protocolFile, 'utf8');
const tasks = JSON.parse(queryBytes);
const catalog = JSON.parse(catalogBytes);
const protocol = JSON.parse(protocolBytes);
const byteHash = value => createHash('sha256').update(value).digest('hex');
const mode = protocol.mode || 'field-priority';
if (
  !['field-priority', 'query-preparation'].includes(mode) ||
  protocol.k !== 10 ||
  protocol.meilisearchVersion !== '1.15.2'
)
  throw new Error('Unsupported frozen protocol');
for (const name of ['baseline', 'candidate']) {
  const attributes = protocol[`${name}SearchableAttributes`];
  if (
    !Array.isArray(attributes) ||
    attributes.length !== 4 ||
    new Set(attributes).size !== 4 ||
    attributes.some(
      value => !['title', 'description', 'categories', 'tags'].includes(value),
    )
  )
    throw new Error(
      'Protocol must specify the four application searchable attributes',
    );
}
if (
  mode === 'query-preparation' &&
  hash(protocol.baselineSearchableAttributes) !==
    hash(protocol.candidateSearchableAttributes)
)
  throw new Error('Query preparation must keep index settings unchanged');
if (protocol.queryByteHash && protocol.queryByteHash !== byteHash(queryBytes))
  throw new Error('Frozen query hash mismatch');
if (
  protocol.catalogByteHash &&
  protocol.catalogByteHash !== byteHash(catalogBytes)
)
  throw new Error('Frozen corpus hash mismatch');
let planner;
let plannerHash = null;
if (mode === 'query-preparation') {
  const source = await readFile(
    new URL(
      '../../src/services/core/search/meilisearchQuery.ts',
      import.meta.url,
    ),
    'utf8',
  );
  plannerHash = byteHash(source);
  if (protocol.queryPlannerSha256 !== plannerHash)
    throw new Error('Query planner differs from frozen protocol');
  planner = (
    await import(
      `data:text/javascript;base64,${Buffer.from(stripTypeScriptTypes(source)).toString('base64')}`
    )
  ).buildMeilisearchQuery;
}
if (
  tasks.label !== 'illustrative' ||
  !Array.isArray(tasks.queries) ||
  !tasks.queries.length ||
  !Array.isArray(catalog) ||
  !catalog.length
)
  throw new Error('Invalid public-task inputs');
for (const row of catalog)
  if (
    !row ||
    typeof row.id !== 'string' ||
    !row.id.trim() ||
    typeof row.display_name !== 'string' ||
    typeof row.repository?.url !== 'string'
  )
    throw new Error('Invalid catalog');
if (
  new Set(catalog.map(row => row.id)).size !== catalog.length ||
  new Set(tasks.queries.map(q => q.id)).size !== tasks.queries.length
)
  throw new Error('Duplicate IDs');
const documents = catalog.map(row => ({
  id: /^[a-zA-Z0-9_-]+$/.test(row.id)
    ? row.id
    : createHash('sha256').update(row.id).digest('hex'),
  catalog_id: row.id,
  title: row.display_name,
  description: typeof row.description === 'string' ? row.description : '',
  github_url: row.repository.url,
  categories: Array.isArray(row.categories)
    ? row.categories.filter(value => typeof value === 'string')
    : [],
  tags: Array.isArray(row.tags)
    ? row.tags.filter(value => typeof value === 'string')
    : [],
  installations: row.installations || {},
}));
const request = (method, pathname, payload) =>
  new Promise((resolve, reject) => {
    const body = payload === undefined ? undefined : JSON.stringify(payload);
    const req = http.request(
      new URL(pathname, url),
      {
        method,
        timeout: 15000,
        headers: body
          ? {
              'content-type': 'application/json',
              'content-length': Buffer.byteLength(body),
            }
          : {},
      },
      res => {
        let data = '';
        res.setEncoding('utf8');
        res.on('data', chunk => {
          data += chunk;
        });
        res.on('end', () => {
          if (!res.statusCode || res.statusCode >= 300)
            return reject(new Error('Engine HTTP request failed'));
          try {
            resolve(data ? JSON.parse(data) : undefined);
          } catch {
            reject(new Error('Invalid engine response'));
          }
        });
      },
    );
    req.on('error', reject);
    req.on('timeout', () => req.destroy(new Error('Engine request timed out')));
    req.end(body);
  });
const wait = async (task, acceptFailed = false) => {
  const deadline = Date.now() + 30000;
  while (Date.now() < deadline) {
    const status = await request('GET', `/tasks/${task.taskUid}`);
    if (
      status.status === 'succeeded' ||
      (acceptFailed && ['failed', 'canceled'].includes(status.status))
    )
      return status;
    if (status.status === 'failed' || status.status === 'canceled')
      throw new Error('Engine task failed');
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  throw new Error('Engine task timed out');
};
const version = await request('GET', '/version');
if (version.pkgVersion !== '1.15.2')
  throw new Error('Frozen experiment requires Meilisearch 1.15.2');
await mkdir(output);
const save = (name, data) =>
  writeFile(path.join(output, name), `${JSON.stringify(data, null, 2)}\n`, {
    flag: 'wx',
  });
const attempts = [];
let journalWrites = Promise.resolve();
const record = () => {
  journalWrites = journalWrites.then(() =>
    writeFile(
      path.join(output, 'cleanup-journal.json'),
      `${JSON.stringify(attempts, null, 2)}\n`,
    ),
  );
  return journalWrites;
};
const runs = [];
const settings = {};
try {
  for (const name of ['baseline', 'candidate']) {
    const uid = `agent_engine_experiment_${randomUUID().replaceAll('-', '')}`;
    await createTrackedIndex(uid, attempts, request, wait, record);
    await wait(
      await request('PATCH', `/indexes/${uid}/settings`, {
        searchableAttributes: protocol[`${name}SearchableAttributes`],
        displayedAttributes: [
          'id',
          'catalog_id',
          'title',
          'description',
          'github_url',
          'categories',
          'tags',
          'installations',
        ],
        filterableAttributes: ['categories', 'tags'],
        sortableAttributes: ['title'],
      }),
    );
    await wait(await request('POST', `/indexes/${uid}/documents`, documents));
    const stats = await request('GET', `/indexes/${uid}/stats`);
    if (stats.numberOfDocuments !== catalog.length)
      throw new Error('Incomplete corpus');
    settings[name] = await request('GET', `/indexes/${uid}/settings`);
    const rankings = Object.create(null);
    for (const task of tasks.queries) {
      if (
        typeof task.id !== 'string' ||
        typeof task.query !== 'string' ||
        !task.query.trim()
      )
        throw new Error('Invalid query');
      const prepared =
        name === 'candidate' && mode === 'query-preparation'
          ? planner(
              { taskDescription: task.query },
              Object.fromEntries(catalog.map(row => [row.id, row])),
            )
          : { query: task.query };
      const response = prepared
        ? await request('POST', `/indexes/${uid}/search`, {
            q: prepared.query,
            limit: 10,
            showRankingScore: true,
            ...(prepared.matchingStrategy
              ? { matchingStrategy: prepared.matchingStrategy }
              : {}),
          })
        : { hits: [] };
      rankings[task.id] = response.hits.map(hit => hit.catalog_id);
      if (
        rankings[task.id].some(id => typeof id !== 'string') ||
        new Set(rankings[task.id]).size !== rankings[task.id].length
      )
        throw new Error('Invalid returned IDs');
    }
    runs.push(rankings);
    await save(`${name}.json`, rankings);
  }
  const selected = new Set();
  const pool = {
    label: 'illustrative',
    poolDepth: 10,
    catalogSha256: hash(catalog),
    note: 'Actual engine-only multi-run pool; independently assess every null grade. No business acceptance claim.',
    queries: tasks.queries.map(({ id, query }) => {
      const ids = [...new Set(runs.flatMap(run => run[id]))].sort((a, b) =>
        hash([id, a]).localeCompare(hash([id, b])),
      );
      ids.forEach(id => selected.add(id));
      return {
        id,
        query,
        candidateIds: ids,
        relevance: Object.fromEntries(ids.map(id => [id, null])),
      };
    }),
    documents: [...selected].sort().map(id => {
      const row = catalog.find(row => row.id === id);
      if (!row) throw new Error('Unknown catalog ID');
      return {
        id,
        name: row.display_name,
        description: row.description || '',
        source: row.repository.url,
      };
    }),
  };
  await save('unjudged-pool.json', pool);
} finally {
  await cleanupTrackedIndexes(attempts, request, wait, record);
}
await save('manifest.json', {
  label: 'illustrative',
  complete: true,
  generatedAt: new Date().toISOString(),
  nodeVersion: process.version,
  meilisearchVersion: version.pkgVersion,
  catalogCount: catalog.length,
  catalogHash: hash(catalog),
  queryHash: hash(tasks),
  catalogByteHash: byteHash(catalogBytes),
  queryByteHash: byteHash(queryBytes),
  protocolHash: hash(protocol),
  protocolByteHash: byteHash(protocolBytes),
  baselineHash: hash(runs[0]),
  candidateHash: hash(runs[1]),
  settingsHash: hash(settings),
  cleanupHash: hash(attempts),
  queryPlannerSha256: plannerHash,
  captureScriptSha256: byteHash(await readFile(new URL(import.meta.url))),
  k: 10,
  mode,
  settings,
  executionPath:
    'Actual isolated Meilisearch HTTP with mirrored application schema/settings. Query-preparation mode executes actual planner source through Node type erasure; application modules/full suite are not executed.',
  sourceCommit: 'e674eb197f5cbcce8d3f25bb7ea6b3e2eb3f5bc0',
});
console.log(
  'Captured actual engine-only rankings and blind pool; temporary indexes removed.',
);
