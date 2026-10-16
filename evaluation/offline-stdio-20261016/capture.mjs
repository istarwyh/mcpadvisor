import assert from 'node:assert/strict';
import { readFile, writeFile, mkdtemp, rm } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath, URL } from 'node:url';
import process from 'node:process';
import { LATEST_PROTOCOL_VERSION } from '@modelcontextprotocol/sdk/types.js';
import { startRawClient } from '../../tests/e2e/helpers/raw-stdio-client.mjs';

const root = resolve(process.argv[2]);
const output = resolve(process.argv[3]);
const hash = value => createHash('sha256').update(value).digest('hex');
const files = [
  'src/utils/logger.ts',
  'src/services/core/search/OfflineSearchProvider.ts',
  'src/services/providers/offline/enhancedMemoryVectorEngine.ts',
  'data/mcp_server_list.json',
  'build/utils/logger.js',
  'build/services/core/search/OfflineSearchProvider.js',
  'build/services/providers/offline/enhancedMemoryVectorEngine.js',
  'tests/e2e/fixtures/offline-stdio-server.mjs',
];
const snapshot = async () =>
  Object.fromEntries(
    await Promise.all(
      files.map(async file => [file, hash(await readFile(join(root, file)))]),
    ),
  );
const sources = await snapshot();
const directory = await mkdtemp(join(tmpdir(), 'mcp-protocol-capture-'));
const client = startRawClient(
  join(root, 'tests/e2e/fixtures/offline-stdio-server.mjs'),
  {
    cwd: root,
    env: {
      PATH: process.env.PATH,
      MCP_COMPASS_MAIN: 'false',
      ENABLE_CONSOLE_LOGGING: 'false',
      ENABLE_FILE_LOGGING: 'false',
      LOGS_DIR: directory,
    },
  },
);
const queries = ['GitHub', 'PostgreSQL', 'Slack', 'Filesystem'];
try {
  const init = await client.request('initialize', {
    protocolVersion: LATEST_PROTOCOL_VERSION,
    capabilities: {},
    clientInfo: { name: 'offline-stdio-capture', version: '1.0.0' },
  });
  assert.ok(init.result.serverInfo);
  client.notify('notifications/initialized');
  assert.ok((await client.request('tools/list')).result.tools.length);
  for (const response of await Promise.all(
    queries.map(taskDescription =>
      client.request('tools/call', {
        name: 'recommend-mcp-servers',
        arguments: { taskDescription },
      }),
    ),
  ))
    assert.equal(response.result.isError, false);
} finally {
  await client.close();
  await rm(directory, { recursive: true, force: true });
}
assert.deepEqual(await snapshot(), sources);
const report = {
  generatedAt: new Date().toISOString(),
  commit: execFileSync('git', ['rev-parse', 'HEAD'], {
    cwd: root,
    encoding: 'utf8',
  }).trim(),
  sources,
  runnerSha256: hash(await readFile(fileURLToPath(import.meta.url))),
  helperSha256: hash(
    await readFile(
      new URL('../../tests/e2e/helpers/raw-stdio-client.mjs', import.meta.url),
    ),
  ),
  queries,
  protocolMessages: client.report.messages.length,
  invalidStdoutLines: client.report.violations.length,
  responses: client.report.messages
    .filter(message => message.id >= 3)
    .sort((a, b) => a.id - b.id),
  limitation:
    'Full catalog and default offline configuration; model fetch fails explicitly in the test fixture so production SimpleEmbeddingProvider fallback is deterministic. No Meilisearch provider or Inspector UI in this capture. Does not measure ranking uplift.',
};
await writeFile(output, JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
await writeFile(output + '.stdout.txt', client.report.stdout, { flag: 'wx' });
await writeFile(output + '.stderr.txt', client.report.stderr, { flag: 'wx' });
process.stdout.write(
  JSON.stringify({
    protocolMessages: report.protocolMessages,
    invalidStdoutLines: report.invalidStdoutLines,
  }) + '\n',
);
