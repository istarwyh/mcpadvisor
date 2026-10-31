import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import {
  mkdtemp,
  mkdir,
  copyFile,
  writeFile,
  readFile,
  rm,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { URL } from 'node:url';
import { join } from 'node:path';
import process from 'node:process';
import { setTimeout as delay } from 'node:timers/promises';

const script = new URL('./e2e.run.sh', import.meta.url);
async function fixture(overrides = {}) {
  const root = await mkdtemp(join(tmpdir(), 'inspector-runner-'));
  const bin = join(root, 'bin');
  await mkdir(bin);
  await mkdir(join(root, 'scripts/e2e'), { recursive: true });
  await copyFile(script, join(root, 'scripts/e2e/e2e.run.sh'));
  const commands = {
    pnpm: `echo $$ > "$FIXTURE_ROOT/build.pid"
if [[ "\${WAIT_BUILD:-}" == 1 ]]; then sleep 60 & wait; fi
exit "\${BUILD_STATUS:-0}"`,
    lsof: 'exit "${PORT_STATUS:-1}"',
    curl: 'exit "${HEALTH_STATUS:-0}"',
    'mcp-inspector': `echo $$ > "$FIXTURE_ROOT/inspector.pid"
if [[ "\${INSPECTOR_STATUS:-}" != "" ]]; then exit "$INSPECTOR_STATUS"; fi
sleep 60 &
echo $! > "$FIXTURE_ROOT/descendant.pid"
if [[ "\${NO_URL:-}" != 1 ]]; then
 echo 'Open inspector with token pre-filled: http://127.0.0.1:6274?MCP_INSPECTOR_API_TOKEN=abcdef123456'
fi
wait`,
    npx: `if [[ "$1" == --yes ]]; then
 [[ "$2" == --package=@modelcontextprotocol/inspector@2.10.1 && "$3" == mcp-inspector && "$4" == --protocol-era && "$5" == modern ]] || exit 98
 exec mcp-inspector
fi
echo "$*" > "$FIXTURE_ROOT/playwright.args"
echo $$ > "$FIXTURE_ROOT/playwright.pid"
if [[ "\${WAIT_TEST:-}" == 1 ]]; then sleep 60 & wait; fi
exit "\${TEST_STATUS:-0}"`,
    ...overrides,
  };
  for (const [name, body] of Object.entries(commands)) {
    if (body === null) continue;
    await writeFile(join(bin, name), `#!/bin/bash\n${body}\n`, { mode: 0o755 });
  }
  return { root, bin };
}
function launch(f, env = {}, mode = 'headless') {
  const child = spawn(
    'bash',
    [join(f.root, 'scripts/e2e/e2e.run.sh'), ...[mode].flat()],
    {
      cwd: tmpdir(),
      env: {
        ...process.env,
        PATH: `${f.bin}:/usr/bin:/bin`,
        FIXTURE_ROOT: f.root,
        E2E_STARTUP_TIMEOUT: '3',
        E2E_HEALTH_TIMEOUT: '1',
        ...env,
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  );
  let output = '';
  child.stdout.on('data', b => {
    output += b;
  });
  child.stderr.on('data', b => {
    output += b;
  });
  const done = new Promise((resolve, reject) => {
    child.once('error', reject);
    child.once('exit', (status, signal) => resolve({ status, signal, output }));
  });
  return { child, done };
}
async function waitFile(path) {
  for (let i = 0; i < 150; i++) {
    try {
      return await readFile(path, 'utf8');
    } catch {
      await delay(20);
    }
  }
  throw new Error(`Timed out waiting for ${path}`);
}
async function assertStopped(path) {
  let pid;
  try {
    pid = Number(await readFile(path, 'utf8'));
  } catch {
    return;
  }
  for (let i = 0; i < 100; i++) {
    try {
      process.kill(pid, 0);
    } catch {
      return;
    }
    // Linux may briefly retain an already-dead orphan as a zombie.
    try {
      if (/^State:\s+Z/m.test(await readFile(`/proc/${pid}/status`, 'utf8')))
        return;
    } catch {
      /* Other POSIX hosts have no /proc. */
    }
    await delay(20);
  }
  assert.fail(`Owned child ${pid} is still alive`);
}
async function check(env, expected, overrides = {}, mode = 'headless') {
  const f = await fixture(overrides);
  const r = launch(f, env, mode);
  try {
    const result = await r.done;
    assert.equal(result.status, expected, result.output);
    assert.doesNotMatch(result.output, /abcdef123456/);
    await assertStopped(join(f.root, 'inspector.pid'));
    await assertStopped(join(f.root, 'descendant.pid'));
    return result;
  } finally {
    r.child.kill('SIGTERM');
    await r.done;
    await rm(f.root, { recursive: true, force: true });
  }
}
for (const [name, env, expected] of [
  ['build failure', { BUILD_STATUS: '9' }, 9],
  ['early Inspector failure', { INSPECTOR_STATUS: '127' }, 127],
  ['early clean Inspector exit is not success', { INSPECTOR_STATUS: '0' }, 1],
  ['Inspector startup timeout', { NO_URL: '1', E2E_STARTUP_TIMEOUT: '1' }, 1],
  ['HTTP health failure', { HEALTH_STATUS: '22' }, 1],
  ['Playwright failure', { TEST_STATUS: '7' }, 7],
  ['successful headless run terminates', {}, 0],
  [
    'occupied port fails without terminating its owner',
    { PORT_STATUS: '0' },
    1,
  ],
]) {
  test(name, { timeout: 12000 }, async () => {
    await check(env, expected);
  });
}
test(
  'failed pinned Inspector execution is an explicit failure',
  { timeout: 12000 },
  async () => {
    await check({}, 127, { 'mcp-inspector': null });
  },
);
test(
  'invalid mode and timeout fail before build',
  { timeout: 12000 },
  async () => {
    await check({}, 2, {}, 'typo');
    await check({ E2E_STARTUP_TIMEOUT: '0' }, 2);
  },
);
for (const signal of ['SIGTERM', 'SIGINT']) {
  test(
    `${signal} preserves failure and cleans owned children only`,
    { timeout: 15000 },
    async () => {
      const f = await fixture();
      const unrelated = spawn(
        'bash',
        ['-c', 'exec -a inspector-unrelated sleep 60'],
        { stdio: 'ignore' },
      );
      const r = launch(f, { WAIT_TEST: '1' });
      try {
        await waitFile(join(f.root, 'playwright.pid'));
        r.child.kill(signal);
        const result = await r.done;
        assert.equal(
          result.status,
          signal === 'SIGINT' ? 130 : 143,
          result.output,
        );
        await assertStopped(join(f.root, 'inspector.pid'));
        await assertStopped(join(f.root, 'descendant.pid'));
        await assertStopped(join(f.root, 'playwright.pid'));
        assert.doesNotThrow(() => process.kill(unrelated.pid, 0));
      } finally {
        r.child.kill('SIGTERM');
        unrelated.kill();
        await rm(f.root, { recursive: true, force: true });
      }
    },
  );
}

for (const signal of ['SIGTERM', 'SIGINT']) {
  test(
    `${signal} interrupts and cleans the build stage`,
    { timeout: 15000 },
    async () => {
      const f = await fixture();
      const r = launch(f, { WAIT_BUILD: '1' });
      try {
        await waitFile(join(f.root, 'build.pid'));
        r.child.kill(signal);
        const result = await r.done;
        assert.equal(
          result.status,
          signal === 'SIGINT' ? 130 : 143,
          result.output,
        );
        await assertStopped(join(f.root, 'build.pid'));
      } finally {
        r.child.kill('SIGTERM');
        await rm(f.root, { recursive: true, force: true });
      }
    },
  );
}

for (const [mode, expected] of [
  ['headless', 'playwright test'],
  [
    ['headless', 'tests/e2e/mcp-inspector.spec.ts', '--retries=0'],
    'playwright test tests/e2e/mcp-inspector.spec.ts --retries=0',
  ],
]) {
  test(`preserves Playwright scope: ${expected}`, async () => {
    const f = await fixture();
    const r = launch(f, {}, mode);
    try {
      const result = await r.done;
      assert.equal(result.status, 0, result.output);
      assert.equal(
        (await readFile(join(f.root, 'playwright.args'), 'utf8')).trim(),
        expected,
      );
    } finally {
      r.child.kill('SIGTERM');
      await r.done;
      await rm(f.root, { recursive: true, force: true });
    }
  });
}
