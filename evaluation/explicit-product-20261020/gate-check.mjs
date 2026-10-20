import process from 'node:process';
import console from 'node:console';
// Run the exact production gate through TypeScript transpilation without loading models.
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdtemp, rm } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const [rootArg, suitePath, outputPath] = process.argv.slice(2);
if (!rootArg || !suitePath || !outputPath)
  throw Error('Usage: node gate-check.mjs CHECKOUT SUITE_JSON NEW_OUTPUT');
const root = path.resolve(rootArg);
const require = createRequire(pathToFileURL(path.join(root, 'package.json')));
const ts = require('typescript');
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const bytes = await readFile(suitePath);
assert.equal(
  hash(bytes),
  '7c7fde7cd7ba694d4d156543277f611510196d33ed8e445fefcee31ad389d994',
);
const suite = JSON.parse(bytes);
const temp = await mkdtemp(path.join(tmpdir(), 'mcpadvisor-gate-'));
try {
  await writeFile(path.join(temp, 'package.json'), '{"type":"module"}');
  const sourceHashes = {};
  for (const name of ['productEvidence', 'meilisearchQuery']) {
    const source = await readFile(
      path.join(root, 'src/services/core/search', name + '.ts'),
      'utf8',
    );
    sourceHashes[name] = hash(source);
    await writeFile(
      path.join(temp, name + '.js'),
      ts.transpileModule(source, {
        compilerOptions: {
          target: ts.ScriptTarget.ES2022,
          module: ts.ModuleKind.ES2022,
        },
      }).outputText,
    );
  }
  const { filterSpecificProductResults } = await import(
    pathToFileURL(path.join(temp, 'productEvidence.js'))
  );
  const rows = suite.fixtures.map(row => ({
    description: '',
    similarity: 0.9,
    sourceUrl: 'https://example.test',
    ...row,
  }));
  const groups = [{ providerName: 'independent-fixture', results: rows }];
  const results = suite.unit_cases.map(test => {
    const before = JSON.stringify(groups);
    const output = filterSpecificProductResults(
      { taskDescription: test.query },
      groups,
    );
    const actual = output[0].results.map(row => row.id);
    const expected = test.expected_ids ?? rows.map(row => row.id);
    return {
      ...test,
      actual,
      pass: JSON.stringify(expected) === JSON.stringify(actual),
      inputUnchanged: before === JSON.stringify(groups),
      survivorIdentityPreserved: output[0].results.every(row =>
        rows.includes(row),
      ),
    };
  });
  await writeFile(
    outputPath,
    JSON.stringify(
      {
        suiteSha256: hash(bytes),
        sourceHashes,
        compilerVersion: ts.version,
        results,
      },
      null,
      2,
    ) + '\n',
    { flag: 'wx' },
  );
  console.log(
    `${results.filter(row => row.pass).length}/${results.length} contracts passed`,
  );
} finally {
  await rm(temp, { recursive: true, force: true });
}
