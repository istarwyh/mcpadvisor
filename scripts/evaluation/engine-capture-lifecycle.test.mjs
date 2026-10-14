import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createTrackedIndex,
  cleanupTrackedIndexes,
} from './engine-capture-lifecycle.mjs';
test('creation polling timeout is reconciled and cleaned instead of orphaned', async () => {
  const entries = [];
  const requests = [];
  let first = true;
  const request = async (method, path) => {
    requests.push([method, path]);
    return { taskUid: method === 'POST' ? 1 : 2 };
  };
  const wait = async task => {
    if (first) {
      first = false;
      throw Error('timeout');
    }
    return {
      status: 'succeeded',
      type: task.taskUid === 1 ? 'indexCreation' : 'indexDeletion',
      indexUid: 'ours',
    };
  };
  await assert.rejects(
    createTrackedIndex('ours', entries, request, wait, async () => {}),
  );
  assert.equal(entries[0].creationTaskUid, 1);
  await cleanupTrackedIndexes(entries, request, wait, async () => {});
  assert.equal(entries[0].state, 'deleted');
  assert.deepEqual(requests, [
    ['POST', '/indexes'],
    ['DELETE', '/indexes/ours'],
  ]);
});
test("a failed collision never deletes someone else's index", async () => {
  const entries = [
    { uid: 'existing', creationTaskUid: 1, state: 'creation-requested' },
  ];
  let deletions = 0;
  await cleanupTrackedIndexes(
    entries,
    async () => {
      deletions++;
    },
    async () => ({ status: 'failed' }),
    async () => {},
  );
  assert.equal(deletions, 0);
  assert.equal(entries[0].state, 'not-created');
});
test('cleanup attempts all confirmed indexes even when one deletion fails', async () => {
  const entries = [
    { uid: 'one', creationTaskUid: 1 },
    { uid: 'two', creationTaskUid: 2 },
  ];
  const deleted = [];
  const request = async (method, path) => {
    deleted.push(path);
    if (path.endsWith('one')) throw Error('delete failed');
    return { taskUid: 3 };
  };
  const wait = async task => ({
    status: 'succeeded',
    type: task.taskUid === 3 ? 'indexDeletion' : 'indexCreation',
    indexUid: task.taskUid === 1 ? 'one' : 'two',
  });
  await assert.rejects(
    cleanupTrackedIndexes(entries, request, wait, async () => {}),
  );
  assert.deepEqual(deleted, ['/indexes/one', '/indexes/two']);
  assert.equal(entries[1].state, 'deleted');
});
test('ambiguous creation response stays journaled and is not blindly deleted', async () => {
  const entries = [];
  let snapshots = 0;
  await assert.rejects(
    createTrackedIndex(
      'uncertain',
      entries,
      async () => {
        throw Error('connection lost');
      },
      async () => {},
      async () => {
        snapshots++;
      },
    ),
  );
  assert.equal(snapshots, 1);
  assert.equal(entries[0].uid, 'uncertain');
  await assert.rejects(
    cleanupTrackedIndexes(
      entries,
      async () => {
        throw Error('must not delete');
      },
      async () => {},
      async () => {},
    ),
  );
  assert.equal(entries[0].state, 'cleanup-unresolved');
});
