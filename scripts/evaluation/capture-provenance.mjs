import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, URL } from 'node:url';

export const CAPTURE_SOURCE_FILES = [
  'scripts/evaluation/capture-agent-task-engine.mjs',
  'scripts/evaluation/capture-provenance.mjs',
  'scripts/evaluation/engine-capture-lifecycle.mjs',
  'src/services/core/search/meilisearchQuery.ts',
];
const root = fileURLToPath(new URL('../../', import.meta.url));
const hash = value => createHash('sha256').update(value).digest('hex');

/** Record the actual checkout; dirty files are identified by exact byte hashes. */
export async function captureProvenance(
  cwd = root,
  files = CAPTURE_SOURCE_FILES,
) {
  const git = (...args) =>
    execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();
  const commit = git('rev-parse', '--verify', 'HEAD');
  if (!/^[a-f0-9]{40,64}$/.test(commit))
    throw new Error('Invalid source revision');
  const sourceFilesSha256 = Object.fromEntries(
    await Promise.all(
      files.map(async name => [
        name,
        hash(await readFile(path.join(cwd, name))),
      ]),
    ),
  );
  return {
    version: 1,
    commit,
    // Includes tracked and untracked files; ignore generated output outside the checkout.
    dirty: git('status', '--porcelain=v1', '--untracked-files=all') !== '',
    sourceFilesSha256,
  };
}

/** A checkout/source change during a capture invalidates its provenance. */
export function assertStableCaptureSource(before, after) {
  if (
    before.commit !== after.commit ||
    JSON.stringify(before.sourceFilesSha256) !==
      JSON.stringify(after.sourceFilesSha256)
  )
    throw new Error('Capture source changed during execution');
}
