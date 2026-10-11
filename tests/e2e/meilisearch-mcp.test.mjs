import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath, URL } from 'node:url';
import process from 'node:process';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { MeiliSearch, MeiliSearchApiError } from 'meilisearch';

const host = process.env.MEILI_FULLTEXT_TEST_HOST;
if (!host)
  throw new Error(
    'Set MEILI_FULLTEXT_TEST_HOST for real MCP protocol E2E tests',
  );
const engine = new MeiliSearch({
  host,
  apiKey: process.env.MEILI_FULLTEXT_TEST_KEY,
});
const root = fileURLToPath(new URL('../../', import.meta.url));
const fixture = fileURLToPath(
  new URL('./fixtures/fulltext-server.mjs', import.meta.url),
);
const clients = [];
const indexes = [];
async function connect(failing = false) {
  const index = `mcp_protocol_${Date.now()}_${process.pid}_${indexes.length}`;
  indexes.push(index);
  const client = new Client(
    {
      name: 'fulltext-protocol-test',
      version: '1.0.0',
    },
    { capabilities: {} },
  );
  clients.push(client);
  const env = Object.fromEntries(
    Object.entries(process.env).filter(
      ([, value]) => typeof value === 'string',
    ),
  );
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [fixture, ...(failing ? ['failing'] : [])],
    cwd: root,
    env: {
      ...env,
      MCP_PROTOCOL_INDEX: index,
      MCP_COMPASS_MAIN: 'false',
      ENABLE_CONSOLE_LOGGING: 'false',
      ENABLE_FILE_LOGGING: 'false',
    },
    stderr: 'pipe',
  });
  await client.connect(transport);
  return { client, index };
}
after(async () => {
  await Promise.all(clients.map(client => client.close()));
  for (const index of indexes) {
    try {
      const task = await engine.deleteIndex(index);
      await engine.tasks.waitForTask(task.taskUid);
    } catch (error) {
      if (
        !(error instanceof MeiliSearchApiError) ||
        error.cause?.code !== 'index_not_found'
      )
        throw error;
    }
  }
});
test(
  '真实 MCP 初始化、工具发现及全文搜索输出',
  { timeout: 15000 },
  async () => {
    const { client, index } = await connect();
    const tools = await client.listTools();
    assert.ok(tools.tools.some(tool => tool.name === 'recommend-mcp-servers'));
    const result = await client.callTool({
      name: 'recommend-mcp-servers',
      arguments: { taskDescription: 'Filesystem' },
    });
    assert.equal(result.isError, false);
    assert.ok(
      result.content.some(
        item =>
          item.type === 'text' &&
          item.text.includes('Title: Filesystem') &&
          item.text.includes('https://github.com/example/filesystem'),
      ),
    );
    assert.equal((await engine.index(index).getStats()).numberOfDocuments, 2);
  },
);
test(
  '非法 API 输入返回工具错误且协议连接保持可用',
  { timeout: 15000 },
  async () => {
    const { client } = await connect();
    const result = await client.callTool({
      name: 'recommend-mcp-servers',
      arguments: { taskDescription: 42 },
    });
    assert.equal(result.isError, true);
    assert.ok((await client.listTools()).tools.length > 0);
  },
);
test(
  '下游目录失败时返回空结果提示，协议连接保持可用',
  { timeout: 15000 },
  async () => {
    const { client } = await connect(true);
    const result = await client.callTool({
      name: 'recommend-mcp-servers',
      arguments: { taskDescription: 'Filesystem' },
    });
    assert.equal(result.isError, false);
    assert.ok(
      result.content.some(
        item =>
          item.type === 'text' &&
          item.text.includes('No matching MCP servers found') &&
          !item.text.includes('Title:'),
      ),
    );
    assert.ok((await client.listTools()).tools.length > 0);
  },
);
