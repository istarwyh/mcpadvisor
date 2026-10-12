import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { MeiliSearch } from 'meilisearch';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { access, mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

const exec = promisify(execFile);
let directory: string;
const queries = {
  label: 'illustrative',
  queries: [{ id: 'q', query: 'Filesystem' }],
};
const catalog = [{ id: 'org/filesystem' }, { id: 'legacy' }];
async function run(extra: string[] = [], env = process.env) {
  return exec(
    process.execPath,
    [
      'build/evaluation/prepareJudgments.js',
      '--queries',
      path.join(directory, 'queries.json'),
      '--catalog',
      path.join(directory, 'catalog.json'),
      ...extra,
    ],
    { env, timeout: 15000 },
  );
}
beforeAll(async () => {
  directory = await mkdtemp(path.join(tmpdir(), 'mcp-judgments-'));
  await writeFile(
    path.join(directory, 'queries.json'),
    JSON.stringify(queries),
  );
  await writeFile(
    path.join(directory, 'catalog.json'),
    JSON.stringify(catalog),
  );
  await writeFile(
    path.join(directory, 'baseline.json'),
    JSON.stringify({ q: ['org/filesystem'] }),
  );
  await writeFile(
    path.join(directory, 'candidate.json'),
    JSON.stringify({ q: ['legacy'] }),
  );
});
afterAll(async () => {
  if (directory) await rm(directory, { recursive: true, force: true });
});

describe('候选池 CLI 离线闭环', () => {
  it('合并文件中的新候选，并可由已有评估 CLI 读取完成后的标注', async () => {
    const output = path.join(directory, 'pool.json');
    await run([
      '--rankings',
      path.join(directory, 'baseline.json'),
      '--rankings',
      path.join(directory, 'candidate.json'),
      '--output',
      output,
    ]);
    const pool = JSON.parse(await readFile(output, 'utf8'));
    expect(pool.queries[0].relevance).toEqual({
      'org/filesystem': null,
      legacy: null,
    });
    const evaluate = () =>
      exec(process.execPath, [
        'build/evaluation/evaluateSearch.js',
        '--judgments',
        output,
        '--rankings',
        path.join(directory, 'baseline.json'),
        '--compare',
        path.join(directory, 'candidate.json'),
      ]);
    await expect(evaluate()).rejects.toMatchObject({ code: 1 });
    // Synthetic test-only labels; never presented as independent business grades.
    pool.queries[0].relevance = { 'org/filesystem': 3, legacy: 2 };
    await writeFile(output, JSON.stringify(pool));
    const result = JSON.parse((await evaluate()).stdout);
    expect(result.label).toBe('illustrative');
    expect(result.candidate.unjudgedAtK).toBe(0);
  });
  it('第二个输出冲突时清理本次预留文件，并允许重试', async () => {
    const output = path.join(directory, 'retry-pool.json');
    const rankings = path.join(directory, 'candidate.json');
    await expect(
      run([
        '--rankings',
        path.join(directory, 'baseline.json'),
        '--output',
        output,
        '--rankings-output',
        rankings,
      ]),
    ).rejects.toMatchObject({ code: 1 });
    await expect(access(output)).rejects.toThrow();
    await run([
      '--rankings',
      path.join(directory, 'baseline.json'),
      '--output',
      output,
    ]);
    expect(JSON.parse(await readFile(output, 'utf8')).label).toBe(
      'illustrative',
    );
  });
  it('拒绝覆盖输入或已有输出，且不输出连接凭据', async () => {
    const file = path.join(directory, 'baseline.json');
    const before = await readFile(file, 'utf8');
    await expect(
      run(['--rankings', file, '--output', file]),
    ).rejects.toMatchObject({
      code: 1,
      stdout: '',
      stderr:
        'Judgment preparation failed. Check inputs, output paths and index configuration.\n',
    });
    expect(await readFile(file, 'utf8')).toBe(before);
  });
});

const host = process.env.MEILI_FULLTEXT_TEST_HOST;
const key = process.env.MEILI_FULLTEXT_TEST_KEY;
const engine = host ? new MeiliSearch({ host, apiKey: key }) : undefined;
const index = `judgment_pool_${Date.now()}_${process.pid}`;
describe.skipIf(!host)('真实引擎无标签采集', () => {
  beforeAll(async () => {
    const task = await engine!.index(index).addDocuments(
      [
        { id: 'hashed', catalog_id: 'org/filesystem', title: 'Filesystem' },
        { id: 'legacy', title: 'Filesystem' },
      ],
      { primaryKey: 'id' },
    );
    await engine!.tasks.waitForTask(task.taskUid);
  });
  afterAll(async () => {
    const task = await engine!.deleteIndex(index);
    await engine!.tasks.waitForTask(task.taskUid);
  });
  it('只读采集原始与旧 ID、导出可重放排名，不需要先编造标签', async () => {
    const output = path.join(directory, 'live-pool.json');
    const rankings = path.join(directory, 'live-rankings.json');
    const before = await engine!.index(index).getSettings();
    await run(['--output', output, '--rankings-output', rankings], {
      ...process.env,
      MEILI_EVAL_HOST: host,
      MEILI_EVAL_INDEX: index,
      MEILI_EVAL_API_KEY: key,
    });
    expect(JSON.parse(await readFile(rankings, 'utf8')).q.sort()).toEqual([
      'legacy',
      'org/filesystem',
    ]);
    expect(
      JSON.parse(await readFile(output, 'utf8')).queries[0].relevance,
    ).toEqual({ 'org/filesystem': null, legacy: null });
    expect(await engine!.index(index).getSettings()).toEqual(before);
    expect((await engine!.index(index).getStats()).numberOfDocuments).toBe(2);
  });
});
