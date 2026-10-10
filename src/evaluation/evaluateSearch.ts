import { readFile, writeFile } from 'node:fs/promises';
import { MeiliSearch } from 'meilisearch';
import { evaluateRun, type QueryJudgments } from './searchQuality.js';

async function main() {
  const args = process.argv.slice(2);
  function option(name: string) {
    const index = args.indexOf(name);
    if (index < 0) return undefined;
    const value = args[index + 1];
    if (!value || value.startsWith('--'))
      throw new Error(`Missing value for ${name}`);
    return value;
  }
  const judgmentsFile = option('--judgments');
  if (!judgmentsFile)
    throw new Error(
      'Provide --judgments and either --rankings or MEILI_EVAL_HOST/MEILI_EVAL_INDEX',
    );
  const raw: unknown = JSON.parse(await readFile(judgmentsFile, 'utf8'));
  const dataset = raw as { label?: string; queries?: QueryJudgments[] };
  if (
    !['illustrative', 'business'].includes(dataset?.label || '') ||
    !Array.isArray(dataset.queries)
  )
    throw new Error(
      'Dataset needs an illustrative/business label and queries array',
    );
  const k = Number(option('--k') || 10);
  if (!Number.isInteger(k) || k < 1 || k > 1000)
    throw new Error('K must be an integer from 1 to 1000');
  const rankingsFile = option('--rankings');
  let rankings: Record<string, string[]>;
  if (rankingsFile) rankings = JSON.parse(await readFile(rankingsFile, 'utf8'));
  else {
    const host = process.env.MEILI_EVAL_HOST;
    const index = process.env.MEILI_EVAL_INDEX;
    if (!host || !index)
      throw new Error(
        'MEILI_EVAL_HOST and MEILI_EVAL_INDEX are required for live evaluation',
      );
    const client = new MeiliSearch({
      host,
      apiKey: process.env.MEILI_EVAL_API_KEY,
    });
    rankings = {};
    for (const item of dataset.queries) {
      const response = await client.index(index).search<{
        id: unknown;
      }>(item.query, { limit: k, attributesToRetrieve: ['id'] });
      if (response.hits.some(hit => typeof hit.id !== 'string'))
        throw new Error('Every search hit must have a string id');
      rankings[item.id] = response.hits.map(hit => hit.id as string);
    }
  }
  const baseline = evaluateRun(dataset.queries, rankings, k);
  const compareFile = option('--compare');
  const candidate = compareFile
    ? evaluateRun(
        dataset.queries,
        JSON.parse(await readFile(compareFile, 'utf8')),
        k,
      )
    : undefined;
  const report = {
    label: dataset.label,
    generatedAt: new Date().toISOString(),
    baseline,
    candidate,
    relativeNdcgChange:
      candidate && baseline.meanNdcg > 0
        ? (candidate.meanNdcg - baseline.meanNdcg) / baseline.meanNdcg
        : null,
    note:
      dataset.label === 'illustrative'
        ? 'Illustrative judgments only; this is not a measured business improvement.'
        : 'Business judgments require representative query coverage and independent review.',
  };
  const json = `${JSON.stringify(report, null, 2)}\n`;
  const output = option('--output');
  if (output) await writeFile(output, json);
  process.stdout.write(json);
}
main().catch(() => {
  // Do not expose SDK error details containing connection URLs or credentials.
  process.stderr.write(
    'Search quality evaluation failed. Check dataset, rankings and index configuration.\n',
  );
  process.exitCode = 1;
});
