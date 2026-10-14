// Dependency-free runtime replay, NOT a substitute for tsc or application tests.
// Node's built-in type erasure executes the actual evaluation source functions.
import console from 'node:console';
import process from 'node:process';
import { stripTypeScriptTypes } from 'node:module';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL, URL } from 'node:url';

export async function loadEvaluation() {
  const directory = await mkdtemp(path.join(tmpdir(), 'agent-eval-runtime-'));
  try {
    await writeFile(path.join(directory, 'package.json'), '{"type":"module"}');
    for (const name of [
      'judgmentPool',
      'searchQuality',
      'agentTaskExperiment',
    ]) {
      const source = await readFile(
        new URL(`../../src/evaluation/${name}.ts`, import.meta.url),
        'utf8',
      );
      await writeFile(
        path.join(directory, `${name}.js`),
        stripTypeScriptTypes(source),
      );
    }
    return await import(
      pathToFileURL(path.join(directory, 'agentTaskExperiment.js')).href
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length !== 8)
    throw new Error(
      'Provide tasks, judgments, baseline, candidate, catalog, manifest, protocol, NEW report path',
    );
  const [tasks, judgments, baseline, candidate, catalog, manifest, protocol] =
    await Promise.all(
      args
        .slice(0, 7)
        .map(async file => JSON.parse(await readFile(file, 'utf8'))),
    );
  const { evaluateAgentTasks, verifyExperimentEvidence } =
    await loadEvaluation();
  const evidence = verifyExperimentEvidence(
    tasks,
    baseline,
    candidate,
    catalog,
    manifest,
    protocol,
  );
  const report = evaluateAgentTasks(
    tasks,
    judgments,
    baseline,
    candidate,
    catalog.map(row => row.id),
  );
  report.evidence = evidence;
  report.execution =
    'Actual evaluation source run through Node built-in type erasure; no tsc build/typecheck or application integration tests were run.';
  await writeFile(args[7], `${JSON.stringify(report, null, 2)}\n`, {
    flag: 'wx',
  });
  console.log(report.decision);
}
if (
  process.argv[1] &&
  pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url
) {
  main().catch(() => {
    console.error(
      'Evaluation failed. Check complete frozen inputs, Node 22.13+ and a NEW report path.',
    );
    process.exitCode = 1;
  });
}
