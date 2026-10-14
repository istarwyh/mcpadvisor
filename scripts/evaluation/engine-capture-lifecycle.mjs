/** Track attempts before requests: an ambiguous response is never lost or deleted blindly. */
export async function createTrackedIndex(uid, attempts, request, wait, record) {
  const entry = { uid, creationTaskUid: null, state: 'creation-requested' };
  attempts.push(entry);
  await record();
  const creation = await request('POST', '/indexes', { uid, primaryKey: 'id' });
  entry.creationTaskUid = creation.taskUid;
  await record();
  const outcome = await wait(creation, true);
  if (
    outcome.status !== 'succeeded' ||
    outcome.type !== 'indexCreation' ||
    outcome.indexUid !== uid
  )
    throw new Error('Index ownership was not confirmed');
  entry.state = 'owned';
  await record();
}

export async function cleanupTrackedIndexes(attempts, request, wait, record) {
  const outcomes = await Promise.allSettled(
    attempts.map(async entry => {
      try {
        if (entry.creationTaskUid === null)
          throw new Error('Creation response is uncertain');
        // Reconcile the asynchronous creation even if the first poll timed out.
        const creation = await wait({ taskUid: entry.creationTaskUid }, true);
        if (creation.status === 'failed' || creation.status === 'canceled') {
          entry.state = 'not-created'; // Includes collision: never delete that index.
          return;
        }
        if (
          creation.status !== 'succeeded' ||
          creation.type !== 'indexCreation' ||
          creation.indexUid !== entry.uid
        )
          throw new Error('Index ownership is uncertain');
        const deletion = await request('DELETE', `/indexes/${entry.uid}`);
        entry.deletionTaskUid = deletion.taskUid;
        await wait(deletion);
        entry.state = 'deleted';
      } catch (error) {
        entry.state = 'cleanup-unresolved';
        throw error;
      } finally {
        await record();
      }
    }),
  );
  if (outcomes.some(outcome => outcome.status === 'rejected'))
    throw new Error(
      'Cleanup unresolved; retain the journal and disposable database for investigation',
    );
}
