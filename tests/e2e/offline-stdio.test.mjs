import { test } from 'node:test';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import assert from 'node:assert/strict';
import { mkdtemp, rm, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath, URL } from 'node:url';
import process from 'node:process';
import { LATEST_PROTOCOL_VERSION } from '@modelcontextprotocol/sdk/types.js';
import { startRawClient } from './helpers/raw-stdio-client.mjs';

const execFileAsync = promisify(execFile);
const root = fileURLToPath(new URL('../../', import.meta.url));
const fixture = fileURLToPath(
  new URL('./fixtures/offline-stdio-server.mjs', import.meta.url),
);
const catalog = JSON.parse(
  await readFile(
    new URL('../../data/mcp_server_list.json', import.meta.url),
    'utf8',
  ),
);

for (const mode of ['default', 'console', 'main']) {
  test(
    `default offline MCP keeps every stdout line protocol-only (${mode} logging)`,
    { timeout: 45000 },
    async () => {
      const logsDir = await mkdtemp(join(tmpdir(), 'mcp-offline-stdio-'));
      const client = startRawClient(fixture, {
        cwd: root,
        env: {
          PATH: process.env.PATH,
          MCP_COMPASS_MAIN: String(mode === 'main'),
          ENABLE_CONSOLE_LOGGING: String(mode === 'console'),
          ENABLE_FILE_LOGGING: 'false',
          LOG_LEVEL: 'debug',
          LOGS_DIR: logsDir,
        },
      });
      try {
        const initialized = await client.request('initialize', {
          protocolVersion: LATEST_PROTOCOL_VERSION,
          capabilities: {},
          clientInfo: {
            name: 'raw-offline-protocol-regression',
            version: '1.0.0',
          },
        });
        assert.ok(initialized.result.serverInfo);
        client.notify('notifications/initialized');
        const tools = await client.request('tools/list');
        assert.ok(
          tools.result.tools.some(
            tool => tool.name === 'recommend-mcp-servers',
          ),
        );
        const search = taskDescription =>
          client.request('tools/call', {
            name: 'recommend-mcp-servers',
            arguments: { taskDescription },
          });
        const results = await Promise.all(
          ['GitHub', 'PostgreSQL', 'Slack', 'Filesystem'].map(search),
        );
        for (const response of results) {
          assert.equal(response.result.isError, false);
          assert.ok(
            response.result.content.some(
              item => item.type === 'text' && item.text.includes('Title:'),
            ),
          );
        }
        assert.deepEqual(
          (await search('GitHub')).result,
          results[0].result,
          'warm search preserves the response',
        );
        assert.equal((await search(42)).result.isError, true);
        assert.ok((await client.request('tools/list')).result.tools.length > 0);
      } finally {
        await client.close();
        await rm(logsDir, { recursive: true, force: true });
      }
      assert.equal(client.report.messages.length, 9);
      assert.deepEqual(
        client.report.violations,
        [],
        'every stdout line must be valid JSON-RPC',
      );
      assert.match(client.report.stderr, /Loading fallback data from:/);
      assert.match(
        client.report.stderr,
        new RegExp(`Successfully added ${catalog.length} fallback entries`),
      );
      assert.equal(
        (
          client.report.stderr.match(
            /Successfully added \d+ fallback entries/g,
          ) || []
        ).length,
        1,
      );
      assert.match(client.report.stderr, /Text search - query keywords:/);
      if (mode !== 'default') {
        assert.match(
          client.report.stderr,
          /ServerService initialized successfully/,
        );
        assert.match(client.report.stderr, /Server running on stdio/);
      }
    },
  );
}

for (const mode of ['default', 'console', 'file', 'main']) {
  test(`config, installation and every enabled log level stay off stdout (${mode})`, async () => {
    const directory = await mkdtemp(join(tmpdir(), 'mcp-diagnostic-'));
    const configFile = join(directory, 'config.json');
    await writeFile(configFile, JSON.stringify({ stdioRegression: true }));
    try {
      const { stdout, stderr } = await execFileAsync(
        process.execPath,
        [
          fileURLToPath(
            new URL('./fixtures/runtime-diagnostics.mjs', import.meta.url),
          ),
        ],
        {
          cwd: root,
          env: {
            PATH: process.env.PATH,
            CONFIG_FILE: configFile,
            MCP_COMPASS_MAIN: String(mode === 'main'),
            ENABLE_CONSOLE_LOGGING: String(mode === 'console'),
            ENABLE_FILE_LOGGING: String(mode === 'file'),
            LOG_LEVEL: 'debug',
            LOGS_DIR: directory,
          },
          timeout: 10000,
        },
      );
      assert.equal(stdout, '');
      assert.match(stderr, /Loading custom config from:/);
      assert.match(stderr, /Found MCP configuration headings:/);
      assert.match(stderr, /Best matching heading:/);
      for (const level of ['error', 'warn', 'info', 'http', 'debug']) {
        if (mode === 'console' || mode === 'main')
          assert.ok(stderr.includes(`STDIO_LOG_LEVEL_${level}`));
        else assert.ok(!stderr.includes(`STDIO_LOG_LEVEL_${level}`));
      }
      if (mode === 'file' || mode === 'main') {
        const log = await readFile(join(directory, 'all.log'), 'utf8');
        for (const level of ['error', 'warn', 'info', 'http', 'debug'])
          assert.ok(log.includes(`STDIO_LOG_LEVEL_${level}`));
      }
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
}

test(
  'default offline MCP does not recommend unrelated products for an explicit specific request',
  { timeout: 45000 },
  async () => {
    const client = startRawClient(fixture, {
      cwd: root,
      env: {
        PATH: process.env.PATH,
        ENABLE_CONSOLE_LOGGING: 'false',
        ENABLE_FILE_LOGGING: 'false',
      },
    });
    try {
      await client.request('initialize', {
        protocolVersion: LATEST_PROTOCOL_VERSION,
        capabilities: {},
        clientInfo: { name: 'product-evidence-regression', version: '1.0.0' },
      });
      client.notify('notifications/initialized');
      const search = taskDescription =>
        client.request('tools/call', {
          name: 'recommend-mcp-servers',
          arguments: { taskDescription },
        });
      for (const query of [
        'I need a NeverKnown-specific database tool',
        '需要 neverknown-specific 数据库工具',
      ]) {
        const response = await search(query);
        assert.equal(response.result.isError, false);
        assert.ok(
          response.result.content.some(
            item =>
              item.type === 'text' &&
              item.text.includes('No matching MCP servers found') &&
              !item.text.includes('Title:'),
          ),
        );
      }
      const known = await search('I need a GitHub-specific MCP tool');
      assert.equal(known.result.isError, false);
      assert.ok(
        known.result.content.some(
          item => item.type === 'text' && item.text.includes('Title: GitHub'),
        ),
      );
      const generic = await search('I need a task-specific database tool');
      assert.equal(generic.result.isError, false);
      assert.ok(
        generic.result.content.some(
          item => item.type === 'text' && item.text.includes('Title:'),
        ),
      );
    } finally {
      await client.close();
    }
    assert.equal(client.report.messages.length, 5);
    assert.deepEqual(client.report.violations, []);
  },
);
