import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { MeiliSearch } from 'meilisearch';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

const host = process.env.MEILI_FULLTEXT_TEST_HOST;
const key = process.env.MEILI_FULLTEXT_TEST_KEY;
const engine = host ? new MeiliSearch({ host, apiKey: key }) : undefined;
const index = `evaluation_test_${Date.now()}_${process.pid}`;
let directory: string;
const exec = promisify(execFile);
async function run(queries: unknown[]) {
  const file = path.join(directory, 'judgments.json');
  await writeFile(file, JSON.stringify({ label: 'illustrative', queries }));
  return exec(
    process.execPath,
    ['build/evaluation/evaluateSearch.js', '--judgments', file, '--k', '2'],
    {
      env: {
        ...process.env,
        MEILI_EVAL_HOST: host,
        MEILI_EVAL_INDEX: index,
        MEILI_EVAL_API_KEY: key,
      },
      timeout: 15000,
    },
  );
}
describe.skipIf(!host)('真实引擎中的质量评价 CLI', () => {
  beforeAll(async () => {
    directory = await mkdtemp(path.join(tmpdir(), 'mcp-evaluation-'));
    const task = await engine!.index(index).addDocuments(
      [
        {
          id: 'hashed_internal_key',
          catalog_id: 'org/server name',
          title: 'Filesystem',
        },
        { id: 'postgres', title: 'Postgres' },
        { id: 'broken', catalog_id: 42, title: 'BrokenCatalog' },
      ],
      { primaryKey: 'id' },
    );
    await engine!.tasks.waitForTask(task.taskUid);
  });
  afterAll(async () => {
    try {
      const task = await engine!.deleteIndex(index);
      await engine!.tasks.waitForTask(task.taskUid);
    } finally {
      if (directory) await rm(directory, { recursive: true, force: true });
    }
  });
  it('读取原始目录 ID 和旧索引 ID，不修改索引并保留示例标签', async () => {
    const result = await run([
      { id: 'files', query: 'Filesystem', relevance: { 'org/server name': 3 } },
      { id: 'sql', query: 'Postgres', relevance: { postgres: 3 } },
    ]);
    const report = JSON.parse(result.stdout);
    expect(report.label).toBe('illustrative');
    expect(report.baseline.meanNdcg).toBe(1);
    expect(report.baseline.meanRecall).toBe(1);
    expect((await engine!.index(index).getStats()).numberOfDocuments).toBe(3);
  });
  it('拒绝错误的公开 ID 类型，以非零退出而不输出连接凭据', async () => {
    await expect(
      run([{ id: 'bad', query: 'BrokenCatalog', relevance: { broken: 3 } }]),
    ).rejects.toMatchObject({
      code: 1,
      stdout: '',
      stderr:
        'Search quality evaluation failed. Check dataset, rankings and index configuration.\n',
    });
  });
});
