// Baseline + candidate raw stdio, real Meilisearch and default offline aggregation.
import assert from 'node:assert/strict';
import process from 'node:process';
import path from 'node:path';
import { readFile, writeFile } from 'node:fs/promises';
import { createHash, randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath, URL } from 'node:url';
import { LATEST_PROTOCOL_VERSION } from '@modelcontextprotocol/sdk/types.js';
import { MeiliSearch } from 'meilisearch';
import { startRawClient } from './raw-stdio-client.mjs';
const hash = value => createHash('sha256').update(value).digest('hex');
const [baseline, candidate, suiteFile, outputFile] = process.argv
  .slice(2)
  .map(value => path.resolve(value));
const suiteBytes = await readFile(suiteFile);
assert.equal(
  hash(suiteBytes),
  '315bef16aa1d60dd73bbf89bd783c1b0d4dd0e8da1776d23170a1d619049b821',
);
const suite = JSON.parse(suiteBytes);
const host = new URL(process.env.MEILI_FULLTEXT_TEST_HOST);
assert.equal(host.protocol, 'http:');
assert.equal(host.hostname, '127.0.0.1');
assert.ok(!host.username && !host.password && !host.search && !host.hash);
const engine = new MeiliSearch({ host: host.href });
const report = {
  generatedAt: new Date().toISOString(),
  suiteSha256: hash(suiteBytes),
  harnessSha256: hash(await readFile(fileURLToPath(import.meta.url))),
  fixtureSha256: hash(
    await readFile(new URL('./mcp-fixture.mjs', import.meta.url)),
  ),
  rawClientSha256: hash(
    await readFile(new URL('./raw-stdio-client.mjs', import.meta.url)),
  ),
  version: await engine.getVersion(),
  runs: {},
};
for (const [name, root] of [
  ['baseline', baseline],
  ['candidate', candidate],
]) {
  const git = (...args) =>
    execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
  const snapshot = async () => {
    const names = git(
      'ls-files',
      '--cached',
      '--others',
      '--exclude-standard',
      '-z',
      'src',
      'package.json',
      'pnpm-lock.yaml',
    )
      .split('\0')
      .filter(Boolean)
      .sort();
    return {
      commit: git('rev-parse', 'HEAD'),
      status: git('status', '--porcelain'),
      source: Object.fromEntries(
        await Promise.all(
          names.map(async file => [
            file,
            hash(await readFile(path.join(root, file))),
          ]),
        ),
      ),
      buildSearchService: hash(
        await readFile(path.join(root, 'build/services/searchService.js')),
      ),
    };
  };
  const before = await snapshot();
  const index = `product_protocol_${randomUUID().replaceAll('-', '')}`;
  const creation = await engine.createIndex(index, { primaryKey: 'id' });
  await engine.tasks.waitForTask(creation.taskUid);
  const client = startRawClient(
    fileURLToPath(new URL('./mcp-fixture.mjs', import.meta.url)),
    {
      cwd: root,
      env: {
        ...process.env,
        MCP_CAPTURE_ROOT: root,
        MCP_PROTOCOL_INDEX: index,
        ENABLE_CONSOLE_LOGGING: 'false',
        ENABLE_FILE_LOGGING: 'false',
      },
    },
  );
  const rows = [];
  try {
    const initialized = await client.request('initialize', {
      protocolVersion: LATEST_PROTOCOL_VERSION,
      capabilities: {},
      clientInfo: { name: 'frozen-product-evidence', version: '1.0.0' },
    });
    assert.ok(initialized.result.serverInfo);
    client.notify('notifications/initialized');
    assert.ok(
      (await client.request('tools/list')).result.tools.some(
        tool => tool.name === 'recommend-mcp-servers',
      ),
    );
    for (const probe of suite.probes)
      rows.push({
        id: probe.id,
        query: probe.query,
        response: await client.request('tools/call', {
          name: 'recommend-mcp-servers',
          arguments: { taskDescription: probe.query },
        }),
      });
    assert.equal((await engine.index(index).getStats()).numberOfDocuments, 212);
  } finally {
    await client.close();
    const deleted = await engine.deleteIndex(index);
    await engine.tasks.waitForTask(deleted.taskUid);
  }
  assert.deepEqual(
    await snapshot(),
    before,
    'source/build changed during raw capture',
  );
  const stdoutFile = `${outputFile}.${name}.stdout`;
  const stderrFile = `${outputFile}.${name}.stderr`;
  await writeFile(stdoutFile, client.report.stdout, { flag: 'wx' });
  await writeFile(stderrFile, client.report.stderr, { flag: 'wx' });
  report.runs[name] = {
    provenance: before,
    rows,
    violations: client.report.violations,
    messageCount: client.report.messages.length,
    stdout: {
      file: path.basename(stdoutFile),
      sha256: hash(client.report.stdout),
    },
    stderr: {
      file: path.basename(stderrFile),
      sha256: hash(client.report.stderr),
    },
  };
}
report.remainingIndexes = await engine.getIndexes();
await writeFile(outputFile, `${JSON.stringify(report, null, 2)}\n`, {
  flag: 'wx',
});
