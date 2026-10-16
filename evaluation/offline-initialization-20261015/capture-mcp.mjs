import { URL } from 'node:url';
import assert from 'node:assert/strict';
import { writeFile, readFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { randomUUID } from 'node:crypto';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { MeiliSearch } from 'meilisearch';
import process from 'node:process';
const host = new URL(process.env.MEILI_FULLTEXT_TEST_HOST);
assert.equal(host.protocol, 'http:');
assert.equal(host.hostname, '127.0.0.1');
assert.equal(host.pathname, '/');
assert.ok(!host.username && !host.password && !host.search && !host.hash);
const root = new URL('../../', import.meta.url).pathname;
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const provenance = async () => ({
  commit: execFileSync('git', ['rev-parse', 'HEAD'], {
    cwd: root,
    encoding: 'utf8',
  }).trim(),
  source: hash(
    await readFile(
      new URL(
        '../../src/services/providers/offline/enhancedMemoryVectorEngine.ts',
        import.meta.url,
      ),
    ),
  ),
  build: hash(
    await readFile(
      new URL(
        '../../build/services/providers/offline/enhancedMemoryVectorEngine.js',
        import.meta.url,
      ),
    ),
  ),
  catalog: hash(
    await readFile(new URL('../../data/mcp_server_list.json', import.meta.url)),
  ),
  runner: hash(await readFile(new URL(import.meta.url))),
  fixture: hash(await readFile(new URL('./mcp-fixture.mjs', import.meta.url))),
});
const before = await provenance();
const index = `offline_protocol_${randomUUID().replaceAll('-', '')}`;
const engine = new MeiliSearch({ host: process.env.MEILI_FULLTEXT_TEST_HOST });
const client = new Client(
  { name: 'offline-concurrency-validation', version: '1.0.0' },
  { capabilities: {} },
);
const errors = [];
client.onerror = error => errors.push(error.message);
const transport = new StdioClientTransport({
  command: process.execPath,
  args: [new URL('./mcp-fixture.mjs', import.meta.url).pathname],
  env: {
    ...process.env,
    MCP_PROTOCOL_INDEX: index,
    ENABLE_CONSOLE_LOGGING: 'false',
    ENABLE_FILE_LOGGING: 'false',
  },
  stderr: 'pipe',
});
let stderr = '';
const report = {
  index,
  provenance: before,
  queries: ['GitHub', 'PostgreSQL', 'Slack', 'Filesystem'],
  errors,
  results: [],
};
try {
  const connecting = client.connect(transport);
  transport.stderr?.on('data', chunk => {
    stderr += chunk.toString();
  });
  await connecting;
  assert.ok(
    (await client.listTools()).tools.some(
      t => t.name === 'recommend-mcp-servers',
    ),
  );
  report.results = await Promise.all(
    report.queries.map(taskDescription =>
      client.callTool(
        { name: 'recommend-mcp-servers', arguments: { taskDescription } },
        undefined,
        { timeout: 120000 },
      ),
    ),
  );
  report.documentCount = (
    await engine.index(index).getStats()
  ).numberOfDocuments;
  report.loaderCalls = (stderr.match(/OFFLINE_LOAD_STARTED/g) || []).length;
  report.addEntryCalls =
    [...stderr.matchAll(/OFFLINE_INSERTIONS=(\d+)/g)]
      .map(x => Number(x[1]))
      .at(-1) || 0;
  report.toolErrors = report.results.filter(r => r.isError).length;
  report.limitations = [
    'Instrumentation counts actual loader/insertion calls. No runtime behavior, ranking, or model is replaced. Existing stdout diagnostics are retained and parser errors recorded. Four observed product queries, not independent holdout.',
  ];
} catch (error) {
  report.failure = error.stack;
} finally {
  try {
    await client.close();
  } catch (error) {
    report.closeError = error.message;
  }
  try {
    const task = await engine.deleteIndex(index);
    await engine.tasks.waitForTask(task.taskUid);
  } catch (error) {
    report.cleanupError = error.message;
  }
  report.provenanceAfter = await provenance();
  report.provenanceUnchanged =
    JSON.stringify(before) === JSON.stringify(report.provenanceAfter);
  await writeFile(process.argv[2], JSON.stringify(report, null, 2) + '\n', {
    flag: 'wx',
  });
  await writeFile(process.argv[2] + '.stderr.txt', stderr, { flag: 'wx' });
}
