import { open, readFile, unlink } from 'node:fs/promises';
import { resolve } from 'node:path';
import { MeiliSearch } from 'meilisearch';
import {
  prepareJudgmentPool,
  validateQueries,
  validateRankings,
} from './judgmentPool.js';

async function main() {
  const args = process.argv.slice(2);
  const options = new Map<string, string[]>();
  const allowed = [
    '--queries',
    '--catalog',
    '--rankings',
    '--k',
    '--output',
    '--rankings-output',
  ];
  for (let i = 0; i < args.length; i += 2) {
    const name = args[i];
    const value = args[i + 1];
    if (
      !allowed.includes(name) ||
      !value ||
      value.startsWith('--') ||
      (name !== '--rankings' && options.has(name))
    )
      throw new Error('Invalid arguments');
    options.set(name, [...(options.get(name) || []), value]);
  }
  const option = (name: string) => options.get(name)?.[0];
  const queriesFile = option('--queries');
  const catalogFile = option('--catalog');
  const output = option('--output');
  const rankingsOutput = option('--rankings-output');
  if (!queriesFile || !catalogFile || !output)
    throw new Error('Missing required paths');
  const inputs = [
    queriesFile,
    catalogFile,
    ...(options.get('--rankings') || []),
  ].map(p => resolve(p));
  const outputs = [output, ...(rankingsOutput ? [rankingsOutput] : [])].map(p =>
    resolve(p),
  );
  if (
    outputs.some(p => inputs.includes(p)) ||
    new Set(outputs).size !== outputs.length
  )
    throw new Error('Output must not replace inputs');
  const readJson = async (file: string): Promise<unknown> =>
    JSON.parse(await readFile(file, 'utf8'));
  const dataset = validateQueries(await readJson(queriesFile));
  const catalog = await readJson(catalogFile);
  const k = Number(option('--k') || 10);
  if (!Number.isInteger(k) || k < 1 || k > 1000)
    throw new Error('Invalid depth');
  const runs: unknown[] = [];
  for (const file of options.get('--rankings') || [])
    runs.push(await readJson(file));
  if (!runs.length) {
    const host = process.env.MEILI_EVAL_HOST;
    const index = process.env.MEILI_EVAL_INDEX;
    if (!host || !index) throw new Error('Missing Meilisearch configuration');
    const client = new MeiliSearch({
      host,
      apiKey: process.env.MEILI_EVAL_API_KEY,
    });
    const rankings: Record<string, string[]> = Object.create(null);
    for (const item of dataset.queries) {
      const result = await client.index(index).search<{
        id: unknown;
        catalog_id?: unknown;
      }>(item.query, { limit: k, attributesToRetrieve: ['id', 'catalog_id'] });
      const ids = result.hits.map(hit =>
        hit.catalog_id === undefined ? hit.id : hit.catalog_id,
      );
      if (ids.some(id => typeof id !== 'string'))
        throw new Error('Invalid public ID');
      rankings[item.id] = ids as string[];
    }
    runs.push(validateRankings(dataset, rankings));
  }
  if (rankingsOutput && runs.length !== 1)
    throw new Error('Export exactly one run at a time');
  const pool = prepareJudgmentPool(dataset, runs, catalog, k);
  // Reserve every output exclusively before writing; remove only this run's
  // newly created files on failure so a retry cannot be blocked by a partial run.
  const files: { path: string; handle: Awaited<ReturnType<typeof open>> }[] =
    [];
  try {
    for (const path of outputs)
      files.push({ path, handle: await open(path, 'wx') });
    await files[0].handle.writeFile(`${JSON.stringify(pool, null, 2)}\n`);
    if (rankingsOutput)
      await files[1].handle.writeFile(`${JSON.stringify(runs[0], null, 2)}\n`);
    for (const file of files) await file.handle.close();
  } catch (error) {
    for (const file of files) {
      await file.handle.close().catch(() => undefined);
      await unlink(file.path).catch(() => undefined);
    }
    throw error;
  }
  process.stdout.write(
    'Prepared unjudged pool. Assign independent grades before evaluation.\n',
  );
}
main().catch(() => {
  // SDK details may contain credentials or connection URLs; never echo them.
  process.stderr.write(
    'Judgment preparation failed. Check inputs, output paths and index configuration.\n',
  );
  process.exitCode = 1;
});
