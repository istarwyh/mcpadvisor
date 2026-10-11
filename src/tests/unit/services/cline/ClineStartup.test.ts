import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import fs from 'fs';
import { EventEmitter } from 'node:events';
import logger from '../../../../utils/logger.js';
import path from 'node:path';

const mocks = vi.hoisted(() => ({
  searchService: vi.fn(),
  start: vi.fn(),
  exit: vi.fn(),
  spawn: vi.fn(),
  unref: vi.fn(),
}));
vi.mock('child_process', () => ({ spawn: mocks.spawn }));
vi.mock('../../../../services/searchService.js', () => ({
  SearchService: class {
    constructor(providers: unknown[]) {
      mocks.searchService(providers);
    }
  },
}));
vi.mock(
  '../../../../services/core/search/MeilisearchSearchProvider.js',
  () => ({ MeilisearchSearchProvider: class {} }),
);
vi.mock('../../../../services/core/search/CompassSearchProvider.js', () => ({
  CompassSearchProvider: class {},
}));
vi.mock('../../../../services/core/search/GetMcpSearchProvider.js', () => ({
  GetMcpSearchProvider: class {},
}));
vi.mock('../../../../services/core/search/NacosMcpProvider.js', () => ({
  NacosMcpProvider: class {},
}));
vi.mock('@chatmcp/sdk/utils/index.js', () => ({
  getParamValue: () => undefined,
}));
vi.mock('../../../../services/core/server/index.js', () => ({
  ServerService: class {
    start = mocks.start;
  },
  TransportType: { STDIO: 'stdio', SSE: 'sse', REST: 'rest' },
}));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.spawn.mockReturnValue(
    Object.assign(new EventEmitter(), { unref: mocks.unref }),
  );
  vi.resetModules();
  vi.stubEnv('MEILISEARCH_INSTANCE', 'cloud');
  vi.stubEnv('NACOS_SERVER_ADDR', '');
  vi.stubEnv('CLINE_MARKETPLACE_ENABLED', '');
  vi.spyOn(process, 'exit').mockImplementation(
    mocks.exit as unknown as typeof process.exit,
  );
  vi.stubGlobal('fetch', vi.fn());
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

it.each(['', 'false'])(
  'preserves the existing startup sources when Cline is %j',
  async enabled => {
    vi.stubEnv('CLINE_MARKETPLACE_ENABLED', enabled);
    await import('../../../../index.js');
    await vi.waitFor(() => expect(mocks.start).toHaveBeenCalledTimes(1));
    const providers = mocks.searchService.mock.calls[0][0];
    expect(
      providers.map((provider: object) => provider.constructor.name),
    ).toEqual([
      'MeilisearchSearchProvider',
      'CompassSearchProvider',
      'GetMcpSearchProvider',
    ]);
    expect(fetch).not.toHaveBeenCalled();
  },
);

it('registers the actual Cline provider only for an explicit true value', async () => {
  vi.stubEnv('CLINE_MARKETPLACE_ENABLED', 'true');
  await import('../../../../index.js');
  await vi.waitFor(() => expect(mocks.start).toHaveBeenCalledTimes(1));
  const providers = mocks.searchService.mock.calls[0][0];
  expect(
    providers.map((provider: object) => provider.constructor.name),
  ).toEqual([
    'MeilisearchSearchProvider',
    'CompassSearchProvider',
    'GetMcpSearchProvider',
    'ClineSearchProvider',
  ]);
  expect(fetch).not.toHaveBeenCalled();
});

it('rejects an invalid opt-in before starting a server', async () => {
  vi.stubEnv('CLINE_MARKETPLACE_ENABLED', 'yes');
  await import('../../../../index.js');
  await vi.waitFor(() => expect(mocks.exit).toHaveBeenCalledWith(1));
  expect(mocks.searchService).not.toHaveBeenCalled();
  expect(mocks.start).not.toHaveBeenCalled();
  expect(fetch).not.toHaveBeenCalled();
});

it('treats an absent opt-in as disabled and rejects unsupported values', async () => {
  const { createOptionalClineProvider } = await import(
    '../../../../config/cline.js'
  );
  delete process.env.CLINE_MARKETPLACE_ENABLED;
  expect(createOptionalClineProvider()).toBeUndefined();
  for (const value of ['1', 'TRUE', ' false ', 'enabled']) {
    expect(() => createOptionalClineProvider(value)).toThrow(
      'CLINE_MARKETPLACE_ENABLED',
    );
  }
});

it.each(['primary', 'fallback', 'absent'])(
  'ESM 启动时正确处理 %s 本地 Meilisearch 脚本',
  async available => {
    vi.stubEnv('MEILISEARCH_INSTANCE', 'local');
    const primary = path.resolve(
      process.cwd(),
      'scripts',
      'meilisearch',
      'meilisearch.bootstrap.mjs',
    );
    const fallback = path.resolve(
      process.cwd(),
      'scripts',
      'bootstrap-meilisearch.mjs',
    );
    vi.spyOn(fs, 'existsSync').mockImplementation(candidate => {
      if (available === 'fallback' && candidate === primary)
        throw new Error('Fixture path is inaccessible');
      return (
        candidate === (available === 'primary' ? primary : fallback) &&
        available !== 'absent'
      );
    });

    await import('../../../../index.js');
    await vi.waitFor(() => expect(mocks.start).toHaveBeenCalledTimes(1));
    expect(mocks.exit).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
    if (available === 'absent') {
      expect(mocks.spawn).not.toHaveBeenCalled();
    } else {
      expect(mocks.spawn).toHaveBeenCalledTimes(1);
      const [command, args, options] = mocks.spawn.mock.calls[0];
      expect(command).toBe(process.execPath);
      expect(args).toEqual([
        '--no-deprecation',
        available === 'primary' ? primary : fallback,
      ]);
      expect(options.stdio).toBe('ignore');
      expect(options.detached).toBe(true);
      expect(mocks.unref).toHaveBeenCalledTimes(1);
      const child = mocks.spawn.mock.results[0].value;
      expect(child.listenerCount('error')).toBe(1);
      expect(child.listenerCount('spawn')).toBe(1);
      expect(logger.info).not.toHaveBeenCalledWith(
        'Triggered async Meilisearch bootstrap',
      );
      child.emit('spawn');
      expect(logger.info).toHaveBeenCalledWith(
        'Triggered async Meilisearch bootstrap',
      );
    }
  },
);
