/**
 * Vitest 全局设置文件
 * 这个文件在所有测试运行之前执行，用于设置全局环境和模拟
 */

import { vi, beforeEach, afterEach } from 'vitest';

// 在测试环境中禁用原生模块以避免 onnxruntime-node 绑定问题
vi.mock('@xenova/transformers', () => ({
  pipeline: vi.fn(() =>
    Promise.resolve((text: string) => ({
      data: new Array(384).fill(0).map(() => Math.random()),
    })),
  ),
  env: {
    allowLocalModels: false,
    useFS: false,
    useBrowserCache: false,
    remoteHost: 'https://hf-mirror.com',
    backends: {
      onnx: {
        wasm: {
          numThreads: 1,
          wasmPaths:
            'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.14.0/dist/',
        },
      },
    },
  },
}));

// 在集成测试中，我们需要真实的网络请求，所以不模拟 fetch
// 只在特定的单元测试中模拟 fetch，而不是全局模拟
// global.fetch = vi.fn();

// 模拟 logger 以避免测试中的实际日志记录
vi.mock('../utils/logger.js', () => ({
  __esModule: true,
  default: {
    info: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
  },
}));

// 设置全局的测试超时时间为 30 秒
vi.setConfig({
  testTimeout: 30000,
});

// 在每个测试前重置所有模拟
beforeEach(() => {
  vi.clearAllMocks();
});

// 清理函数，在每个测试之后运行
afterEach(() => {
  vi.clearAllMocks();
});

// 直接在 setup.ts 中实现 Jest 兼容层
// 注意：这个兼容层只是临时的，最终应该完全迁移到 Vitest API
const setupJestCompat = () => {
  console.log('Jest 兼容层已加载，请尽快将测试文件迁移到 Vitest 原生 API');

  return {
    fn: vi.fn,
    mock: vi.mock,
    spyOn: vi.spyOn,
    setTimeout: (timeout: number) => {
      vi.setConfig({ testTimeout: timeout });
      return vi;
    },
    clearAllMocks: vi.clearAllMocks,
    resetAllMocks: vi.resetAllMocks,
    restoreAllMocks: vi.restoreAllMocks,
  };
};

// 导出兼容层
export const jest = setupJestCompat();
