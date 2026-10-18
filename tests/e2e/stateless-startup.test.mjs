import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { readFile, access } from 'node:fs/promises';
import { fileURLToPath, URL } from 'node:url';
import process from 'node:process';
import path from 'node:path';
import { Client } from '@modelcontextprotocol/client';
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio';

const root = fileURLToPath(new URL('../../', import.meta.url));
const run = promisify(execFile);

test('compiled default dependency graph cannot reach legacy code or SDKs', async () => {
  const visited = new Set();
  async function visit(file) {
    if (visited.has(file)) return;
    visited.add(file);
    assert.ok(!file.includes('/legacy/'), file);
    const text = await readFile(file, 'utf8');
    assert.ok(!/@chatmcp\/sdk|@modelcontextprotocol\/sdk/.test(text), file);
    for (const match of text.matchAll(
      /(?:from\s*|import\s*\()\s*['"](\.[^'"]+)['"]/g,
    )) {
      await visit(path.resolve(path.dirname(file), match[1]));
    }
  }
  await visit(path.join(root, 'build/index.js'));
  assert.ok(
    visited.size > 20,
    'traversed the real application dependency graph',
  );
  await assert.rejects(
    access(path.join(root, 'build/services/core/server/legacy')),
  );
  await assert.rejects(
    access(
      path.join(root, 'build/services/core/server/transports/ExpressServer.js'),
    ),
  );
  for (const name of [
    'ServerService.ts',
    'transports/ExpressServer.ts',
    'handlers/RequestHandlerFactory.ts',
  ]) {
    assert.match(
      await readFile(
        path.join(root, 'src/services/core/server/legacy', name),
        'utf8',
      ),
      /@deprecated/,
    );
  }
});

for (const mode of ['sse', 'rest']) {
  test(`retired ${mode} CLI fails with migration instructions and no stdout`, async () => {
    await assert.rejects(
      run(process.execPath, ['build/index.js', `--mode=${mode}`], {
        cwd: root,
        timeout: 15000,
        env: { PATH: process.env.PATH },
      }),
      error => {
        assert.equal(error.code, 1);
        assert.equal(error.stdout, '');
        assert.match(error.stderr, /Legacy sse\/rest modes are retired/);
        assert.match(error.stderr, /--mode=http/);
        return true;
      },
    );
  });
}

test('official SDK 2.3.1 explicitly pinned modern stdio supports discover, tools, resources', async () => {
  const client = new Client(
    { name: 'modern-stdio-acceptance', version: '1' },
    {
      versionNegotiation: { mode: { pin: '2026-07-28' } },
    },
  );
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [path.join(root, 'tests/e2e/fixtures/offline-stdio-server.mjs')],
    cwd: root,
    env: {
      PATH: process.env.PATH,
      LOG_DIR: path.join(root, 'tests/e2e/fixtures'),
    },
    stderr: 'pipe',
  });
  try {
    await client.connect(transport);
    assert.equal(client.getProtocolEra(), 'modern');
    assert.deepEqual(client.getDiscoverResult().supportedVersions, [
      '2026-07-28',
    ]);
    assert.ok((await client.listTools()).tools.length >= 2);
    const call = await client.callTool({
      name: 'recommend-mcp-servers',
      arguments: { taskDescription: 'GitHub' },
    });
    assert.equal(call.isError, false);
    assert.ok(
      call.content.some(
        item => item.type === 'text' && item.text.includes('GitHub'),
      ),
    );
    assert.deepEqual((await client.listResources()).resources, []);
    assert.deepEqual(
      (await client.listResourceTemplates()).resourceTemplates,
      [],
    );
  } finally {
    await client.close();
  }
});

test('modern stdio reads real resources without handshake and rejects legacy or incomplete metadata', async () => {
  const { mkdtemp, writeFile, rm } = await import('node:fs/promises');
  const { tmpdir } = await import('node:os');
  const { pathToFileURL } = await import('node:url');
  const { startRawClient } = await import('./helpers/raw-stdio-client.mjs');
  const directory = await mkdtemp(path.join(tmpdir(), 'mcp-modern-resource-'));
  const file = path.join(directory, 'fixture.log');
  await writeFile(file, 'isolated resource content');
  const uri = pathToFileURL(file).href;
  const client = startRawClient(
    path.join(root, 'tests/e2e/fixtures/offline-stdio-server.mjs'),
    {
      cwd: root,
      env: { PATH: process.env.PATH, LOG_DIR: directory },
    },
  );
  try {
    const legacy = await client.request(
      'initialize',
      {
        protocolVersion: '2025-11-25',
        capabilities: {},
        clientInfo: { name: 'old', version: '1' },
      },
      null,
    );
    assert.equal(legacy.error.code, -32022);
    const read = await client.request('resources/read', { uri });
    assert.equal(read.result.resultType, 'complete');
    assert.equal(read.result.cacheScope, 'private');
    assert.equal(read.result.ttlMs, 0);
    assert.equal(read.result.contents[0].text, 'isolated resource content');
    const listed = await client.request('resources/list');
    assert.ok(listed.result.resources.some(resource => resource.uri === uri));
    const malformed = await client.request(
      'tools/list',
      {},
      {
        'io.modelcontextprotocol/protocolVersion': '2026-07-28',
      },
    );
    assert.equal(malformed.error.code, -32602);
    assert.ok((await client.request('tools/list')).result.tools.length >= 2);
    assert.deepEqual(client.report.violations, []);
  } finally {
    await client.close();
    await rm(directory, { recursive: true, force: true });
  }
});
