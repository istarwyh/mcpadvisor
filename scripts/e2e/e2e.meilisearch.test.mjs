import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath, URL } from 'node:url';
import process from 'node:process';

const script = fileURLToPath(new URL('./e2e.meilisearch.sh', import.meta.url));
const root = fileURLToPath(new URL('../../', import.meta.url)).replace(
  /\/$/,
  '',
);
function run(code) {
  return spawnSync('bash', ['-c', `source "$AUDIT_SCRIPT"\n${code}`], {
    env: { ...process.env, AUDIT_SCRIPT: script, AUDIT_ROOT: root },
    encoding: 'utf8',
    timeout: 5000,
  });
}
test('E2E 从嵌套脚本位置定位真实仓库根目录', () => {
  const result = run('[[ "$PROJECT_ROOT" == "$AUDIT_ROOT" ]]');
  assert.equal(result.status, 0, result.stderr);
});
test('健康检查等待循环不会因为第一次计数返回非零而提前退出', () => {
  const result = run(
    'calls=0\nnc() { calls=$((calls + 1)); [[ $calls -gt 1 ]]; }\nsleep() { :; }\nwait_for_port 9999 fixture 2',
  );
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /9999/);
});
test('清理后保留失败退出码，SIGTERM 不会被报告为通过', () => {
  assert.equal(run('exit 7').status, 7);
  const result = run('pnpm() { return 143; }\nrun_tests');
  assert.equal(result.status, 143, result.stderr);
});
test('清理不会结束名字含 meilisearch 的非本次启动进程', async () => {
  const unrelated = spawn(
    'bash',
    ['-c', 'exec -a meilisearch-unrelated-fixture sleep 30'],
    { stdio: 'ignore' },
  );
  try {
    const result = run('cleanup');
    assert.equal(result.status, 0, result.stderr);
    assert.doesNotThrow(() => process.kill(unrelated.pid, 0));
  } finally {
    unrelated.kill();
  }
});
