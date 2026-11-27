import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

const readJson = async path =>
  JSON.parse(await readFile(new URL(path, import.meta.url), 'utf8'));

test('MCP Registry metadata identifies the exact npm artifact', async () => {
  const pkg = await readJson('../../package.json');
  const server = await readJson('../../server.json');

  assert.equal(server.name, 'io.github.istarwyh/mcpadvisor');
  assert.equal(pkg.mcpName, server.name);
  assert.equal(server.version, pkg.version);
  assert.deepEqual(server.packages, [
    {
      registryType: 'npm',
      registryBaseUrl: 'https://registry.npmjs.org',
      identifier: pkg.name,
      version: pkg.version,
      transport: { type: 'stdio' },
    },
  ]);
  assert.equal(Object.hasOwn(server, 'remotes'), false);
});
