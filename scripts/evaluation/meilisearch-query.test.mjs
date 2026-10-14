import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { stripTypeScriptTypes } from 'node:module';
import { Buffer } from 'node:buffer';
import { URL } from 'node:url';
const source = stripTypeScriptTypes(
  await readFile(
    new URL(
      '../../src/services/core/search/meilisearchQuery.ts',
      import.meta.url,
    ),
    'utf8',
  ),
);
const { buildMeilisearchQuery } = await import(
  `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`
);
const catalog = {
  postgresql: {
    display_name: 'PostgreSQL',
    description: 'Read-only database access with schema inspection',
    tags: ['database', 'SQL'],
  },
  filesystem: {
    display_name: 'Filesystem',
    description: 'Read local files and directories',
    tags: ['file', 'filesystem'],
  },
  browser: {
    display_name: 'Browser Automation',
    description: 'Render JavaScript web pages',
    tags: ['browser', 'javascript', 'web'],
  },
};
test('short literals preserve existing semantics', () => {
  assert.deepEqual(
    buildMeilisearchQuery({ taskDescription: 'PostgreSQL' }, catalog),
    { query: 'PostgreSQL' },
  );
});
test('important named or structured terms survive lengthy prefixes', () => {
  let q = buildMeilisearchQuery(
    {
      taskDescription:
        'I want a useful way to work on a project with my existing PostgreSQL database',
    },
    catalog,
  );
  assert.ok(q.query.startsWith('postgresql'));
  assert.ok(q.query.split(' ').length <= 10);
  q = buildMeilisearchQuery(
    {
      taskDescription:
        'I need a useful tool to help with a lengthy task description that hides the important word',
      keywords: ['PostgreSQL'],
      capabilities: ['schema'],
    },
    catalog,
  );
  assert.ok(q.query.startsWith('postgresql schema'));
});
test('Chinese finite capability aliases are usable without returning all records for unknown input', () => {
  assert.match(
    buildMeilisearchQuery(
      { taskDescription: '我需要查询数据库里的表' },
      catalog,
    ).query,
    /database/,
  );
  assert.match(
    buildMeilisearchQuery({ taskDescription: '请帮我读取本地文件' }, catalog)
      .query,
    /file/,
  );
  assert.equal(
    buildMeilisearchQuery(
      { taskDescription: '请帮我寻找独角兽传送门' },
      catalog,
    ),
    null,
  );
});
test('unknown exact product requests remain anchors rather than generic database recommendations', () => {
  for (const input of [
    'I need a NeverKnown-specific MCP server for database queries',
    '需要专门对接 NeverKnown 的数据库工具',
  ]) {
    const q = buildMeilisearchQuery({ taskDescription: input }, catalog);
    assert.ok(q.query.startsWith('neverknown'));
    assert.equal(q.matchingStrategy, 'last');
  }
});
test('all prepared queries use the widely supported last strategy', () => {
  assert.equal(
    buildMeilisearchQuery(
      { taskDescription: 'I want automation for a web task' },
      catalog,
    ).matchingStrategy,
    'last',
  );
});
test('direct product exclusions are not turned into positive anchors', () => {
  for (const taskDescription of [
    'I need a database tool, but not PostgreSQL',
    '我需要数据库工具，不要 PostgreSQL',
    '我不想使用 PostgreSQL，请给我其他数据库工具',
    '我不想使用PostgreSQL，请给我其他数据库工具',
    'I need database tools without PostgreSQL',
    'I need database tools, not using PostgreSQL',
  ])
    assert.equal(buildMeilisearchQuery({ taskDescription }, catalog), null);
});
test('ordinary named unknown product request stays anchored', () => {
  const q = buildMeilisearchQuery(
    { taskDescription: 'I need a NeverKnown database integration' },
    catalog,
  );
  assert.ok(q.query.startsWith('neverknown'));
  assert.equal(q.matchingStrategy, 'last');
});
test('a quoted fragment inside long prose does not skip query preparation', () => {
  const q = buildMeilisearchQuery(
    {
      taskDescription:
        'I want a useful way to help an agent work with a "PostgreSQL" database and inspect schema',
    },
    catalog,
  );
  assert.ok(q.query.startsWith('postgresql'));
});

test('explicit generic terms cannot erase known or unknown product constraints', () => {
  for (const taskDescription of [
    'I need a NeverKnown-specific database tool',
    'I need a NeverKnown database integration',
  ])
    assert.ok(
      buildMeilisearchQuery(
        { taskDescription, keywords: ['database'] },
        catalog,
      ).query.startsWith('neverknown'),
    );
  assert.ok(
    buildMeilisearchQuery(
      {
        taskDescription: 'I need PostgreSQL',
        capabilities: ['schema inspection'],
      },
      catalog,
    ).query.startsWith('postgresql'),
  );
});
test('product is first and multiword or hyphenated anchors remain phrases', () => {
  const q = buildMeilisearchQuery(
    {
      taskDescription: 'I need PostgreSQL',
      keywords: ['one-two-three-four-five-six-seven-eight-nine-ten-eleven'],
    },
    catalog,
  );
  assert.ok(
    q.query.startsWith(
      'postgresql "one two three four five six seven eight nine ten eleven"',
    ),
  );
  const other = buildMeilisearchQuery(
    { taskDescription: '需要专门对接 Apache Kafka 的数据库工具' },
    catalog,
  );
  assert.ok(other.query.startsWith('"apache kafka"'));
});

test('punctuation-only structured or literal input cannot become an empty search', () => {
  for (const keywords of [['""'], ['___'], ['---']])
    assert.equal(
      buildMeilisearchQuery({ taskDescription: '', keywords }, catalog),
      null,
    );
  assert.equal(buildMeilisearchQuery({ taskDescription: '""' }, catalog), null);
});

test('sentence-initial adjectives do not become unknown-product anchors', () => {
  for (const adjective of ['Affordable', 'Minimalist']) {
    const q = buildMeilisearchQuery(
      { taskDescription: `${adjective} database tools that work for my team` },
      catalog,
    );
    assert.ok(!q.query.toLowerCase().includes(adjective.toLowerCase()));
    assert.ok(q.query.includes('database'));
  }
});
