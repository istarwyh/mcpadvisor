import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  captureProvenance,
  assertStableCaptureSource,
} from './capture-provenance.mjs';

test('provenance records actual commits, dirty state and source byte hashes', async () => {
  const cwd = await mkdtemp(path.join(tmpdir(), 'capture-provenance-'));
  const git = (...args) =>
    execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();
  try {
    git('init', '-q');
    git('config', 'user.name', 'Test');
    git('config', 'user.email', 'test@example.invalid');
    await writeFile(path.join(cwd, 'source.mjs'), 'original');
    git('add', 'source.mjs');
    git('commit', '-qm', 'initial source');
    const original = await captureProvenance(cwd, ['source.mjs']);
    assert.equal(original.commit, git('rev-parse', 'HEAD'));
    assert.equal(original.dirty, false);
    await writeFile(path.join(cwd, 'source.mjs'), 'changed');
    const dirty = await captureProvenance(cwd, ['source.mjs']);
    assert.equal(dirty.commit, original.commit);
    assert.equal(dirty.dirty, true);
    assert.equal(
      dirty.sourceFilesSha256['source.mjs'],
      createHash('sha256').update('changed').digest('hex'),
    );
    assert.throws(
      () => assertStableCaptureSource(original, dirty),
      /source changed/,
    );
    git('add', 'source.mjs');
    git('commit', '-qm', 'changed source');
    const next = await captureProvenance(cwd, ['source.mjs']);
    assert.notEqual(next.commit, original.commit);
    assert.equal(next.dirty, false);
    assert.throws(
      () => assertStableCaptureSource(dirty, next),
      /source changed/,
    );
    assertStableCaptureSource(
      next,
      await captureProvenance(cwd, ['source.mjs']),
    );
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
});
