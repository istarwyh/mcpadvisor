import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import logger from '../../../utils/logger.js';
import ts from 'typescript';

const mocks = vi.hoisted(() => ({
  start: vi.fn(),
  spawn: vi.fn(),
  unref: vi.fn(),
  exit: vi.fn(),
}));
vi.mock('../../../services/searchService.js', () => ({
  SearchService: class {},
}));
vi.mock('../../../config/cline.js', () => ({
  createOptionalClineProvider: () => undefined,
}));
vi.mock('../../../services/core/search/ProfessionalReranker.js', () => ({
  createOptionalProfessionalReranker: () => undefined,
}));
vi.mock('../../../services/core/search/MeilisearchSearchProvider.js', () => ({
  MeilisearchSearchProvider: class {},
}));
vi.mock('../../../services/core/search/CompassSearchProvider.js', () => ({
  CompassSearchProvider: class {},
}));
vi.mock('../../../services/core/search/GetMcpSearchProvider.js', () => ({
  GetMcpSearchProvider: class {},
}));
vi.mock('../../../services/core/search/NacosMcpProvider.js', () => ({
  NacosMcpProvider: class {},
}));
vi.mock('@chatmcp/sdk/utils/index.js', () => ({
  getParamValue: () => undefined,
}));
vi.mock('child_process', () => ({ spawn: mocks.spawn }));
vi.mock('../../../services/core/server/index.js', () => ({
  ServerService: class {
    start = mocks.start;
  },
  TransportType: { STDIO: 'stdio', SSE: 'sse', REST: 'rest' },
}));

let directory: string;
let preferredPath: string;
let fallbackPath: string;

beforeEach(() => {
  vi.resetModules();
  vi.resetAllMocks();
  directory = fs.mkdtempSync(path.join(os.tmpdir(), 'mcpadvisor-bootstrap-'));
  preferredPath = path.join(
    directory,
    'scripts',
    'meilisearch',
    'meilisearch.bootstrap.mjs',
  );
  fallbackPath = path.join(directory, 'scripts', 'bootstrap-meilisearch.mjs');
  vi.spyOn(process, 'cwd').mockReturnValue(directory);
  vi.spyOn(process, 'exit').mockImplementation(
    mocks.exit as unknown as typeof process.exit,
  );
  vi.stubEnv('MEILISEARCH_INSTANCE', 'local');
  vi.stubEnv('NACOS_SERVER_ADDR', '');
  // Match the native ESM CLI environment even if the runner exposes require.
  vi.stubGlobal('require', undefined);
  mocks.spawn.mockReturnValue({ unref: mocks.unref });
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  fs.rmSync(directory, { recursive: true, force: true });
});

function createScript(scriptPath: string) {
  fs.mkdirSync(path.dirname(scriptPath), { recursive: true });
  fs.writeFileSync(scriptPath, '// Bootstrap fixture; never executed.\n');
}

async function startApplication() {
  await import('../../../index.js');
  await vi.waitFor(() => expect(mocks.start).toHaveBeenCalledTimes(1));
  expect(mocks.exit).not.toHaveBeenCalled();
}

function expectBootstrap(scriptPath: string) {
  expect(mocks.spawn).toHaveBeenCalledExactlyOnceWith(
    process.execPath,
    ['--no-deprecation', scriptPath],
    { env: { ...process.env }, stdio: 'ignore', detached: true },
  );
  expect(mocks.unref).toHaveBeenCalledTimes(1);
}

describe('local Meilisearch bootstrap at CLI startup', () => {
  it('uses the preferred script from the working directory in ESM', async () => {
    createScript(preferredPath);
    createScript(fallbackPath);
    await startApplication();
    expectBootstrap(preferredPath);
  });

  it('uses the legacy location when the preferred script is absent', async () => {
    createScript(fallbackPath);
    await startApplication();
    expectBootstrap(fallbackPath);
  });

  it('starts the server without spawning when neither script exists', async () => {
    await startApplication();
    expect(mocks.spawn).not.toHaveBeenCalled();
    expect(logger.debug).toHaveBeenCalledWith(
      'Bootstrap script not found, skipping',
    );
  });

  it('continues to the fallback after a filesystem lookup error', async () => {
    createScript(fallbackPath);
    const existsSync = fs.existsSync.bind(fs);
    vi.spyOn(fs, 'existsSync').mockImplementation(candidate => {
      if (candidate === preferredPath)
        throw new Error('Filesystem unavailable');
      return existsSync(candidate);
    });
    await startApplication();
    expectBootstrap(fallbackPath);
  });

  it('still starts the server if both script lookups throw', async () => {
    vi.spyOn(fs, 'existsSync').mockImplementation(() => {
      throw new Error('Filesystem unavailable');
    });
    await startApplication();
    expect(mocks.spawn).not.toHaveBeenCalled();
  });

  it('treats a bootstrap spawn failure as nonfatal', async () => {
    createScript(preferredPath);
    mocks.spawn.mockImplementation(() => {
      throw new Error('Spawn unavailable');
    });
    await startApplication();
    expect(mocks.spawn).toHaveBeenCalledTimes(1);
    expect(mocks.unref).not.toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalledWith('Skip Meilisearch bootstrap');
  });

  it('does not spawn a local bootstrap in cloud mode', async () => {
    vi.stubEnv('MEILISEARCH_INSTANCE', 'cloud');
    createScript(preferredPath);
    await startApplication();
    expect(mocks.spawn).not.toHaveBeenCalled();
  });
});

// Vitest can supply CommonJS require even for this ESM entrypoint. Execute the
// actual transpiled module in Node too, with only service/process boundaries
// stubbed by a loader, so this catches ESM-only startup failures.
it('finds and spawns the bootstrap in a native Node ESM process', async () => {
  createScript(preferredPath);
  const source = fs.readFileSync(
    new URL('../../../index.ts', import.meta.url),
    'utf8',
  );
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ES2022,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  const entryPath = path.join(directory, 'entry.mjs');
  fs.writeFileSync(entryPath, compiled);
  const serviceStubs = `
    const spawns = [];
    export const createOptionalClineProvider = () => undefined;
    export const createOptionalProfessionalReranker = () => undefined;
    export const getParamValue = () => undefined;
    export class SearchService {}
    export class CompassSearchProvider {}
    export class GetMcpSearchProvider {}
    export class MeilisearchSearchProvider {}
    export class NacosMcpProvider {}
    export const TransportType = { STDIO: 'stdio', SSE: 'sse', REST: 'rest' };
    export function spawn(command, args, options) {
      spawns.push({ command, args, stdio: options.stdio, detached: options.detached });
      return { unref() {} };
    }
    export class ServerService {
      async start() { console.log(JSON.stringify({ spawns })); }
    }
    export default { info() {}, warn() {}, error() {}, debug() {} };
  `;
  const stubUrl = `data:text/javascript,${encodeURIComponent(serviceStubs)}`;
  const loaderPath = path.join(directory, 'loader.mjs');
  fs.writeFileSync(
    loaderPath,
    `
    export async function resolve(specifier, context, nextResolve) {
      if (specifier.startsWith('./') || specifier === '@chatmcp/sdk/utils/index.js'
          || specifier === 'child_process') {
        return { url: ${JSON.stringify(stubUrl)}, shortCircuit: true };
      }
      return nextResolve(specifier, context);
    }
  `,
  );
  const { execFileSync } =
    await vi.importActual<typeof import('child_process')>('child_process');
  const output = execFileSync(
    process.execPath,
    ['--loader', loaderPath, entryPath],
    {
      cwd: directory,
      env: { ...process.env },
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  );
  expect(JSON.parse(output).spawns).toEqual([
    {
      command: process.execPath,
      args: ['--no-deprecation', preferredPath],
      stdio: 'ignore',
      detached: true,
    },
  ]);
});
