/**
 * 离线数据加载器测试
 * 测试从本地文件加载兜底数据的功能
 */

import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import { OfflineDataLoader } from '../../../../services/providers/offline/offlineDataLoader.js';
import logger from '../../../../utils/logger.js';
import * as embedding from '../../../../utils/embedding.js';
import * as vectorUtils from '../../../../utils/vectorUtils.js';

// 模拟数据 - 使用与 OfflineDataLoader 中预期的格式匹配的数据结构
const mockServerData = [
  {
    name: '测试服务器1',
    display_name: '测试服务器1显示名称',
    description: '这是一个测试服务器',
    repository: {
      url: 'https://github.com/example/test-server-1',
    },
    categories: ['test', 'example'],
    tags: ['test', 'mock'],
  },
  {
    name: '测试服务器2',
    description: '这是另一个测试服务器',
    homepage: 'https://github.com/example/test-server-2',
    categories: 'test',
    tags: 'mock',
  },
];

// 创建临时测试文件路径
const TEST_DATA_PATH = path.join(process.cwd(), 'test-data.json');

describe('OfflineDataLoader', () => {
  // 在每个测试前创建测试数据文件
  beforeEach(() => {
    // 写入测试数据
    fs.writeFileSync(TEST_DATA_PATH, JSON.stringify(mockServerData), 'utf8');

    // 模拟日志函数
    vi.spyOn(logger, 'info').mockImplementation(() => {});
    vi.spyOn(logger, 'warn').mockImplementation(() => {});
    vi.spyOn(logger, 'error').mockImplementation(() => {});

    // 模拟嵌入向量和归一化函数
    vi.spyOn(embedding, 'getTextEmbedding').mockResolvedValue([0.1, 0.2, 0.3]);
    vi.spyOn(vectorUtils, 'normalizeVector').mockReturnValue([0.1, 0.2, 0.3]);
  });

  // 在每个测试后清理
  afterEach(() => {
    // 删除测试数据文件
    if (fs.existsSync(TEST_DATA_PATH)) {
      fs.unlinkSync(TEST_DATA_PATH);
    }

    // 恢复所有模拟
    vi.restoreAllMocks();
  });

  test('应该能够加载离线数据', async () => {
    // 创建加载器实例，使用测试数据路径
    const loader = new OfflineDataLoader(TEST_DATA_PATH);

    // 加载数据
    const data = await loader.loadFallbackData();

    // 验证数据
    expect(data).toHaveLength(2);
    expect(data[0].title).toBe('测试服务器1显示名称'); // 使用 display_name
    expect(data[1].title).toBe('测试服务器2'); // 使用 name
    expect(data[0].sourceUrl).toBe('https://github.com/example/test-server-1');
    expect(data[1].sourceUrl).toBe('https://github.com/example/test-server-2');
  });

  test('当数据文件不存在时应返回空数组', async () => {
    // 删除测试数据文件
    if (fs.existsSync(TEST_DATA_PATH)) {
      fs.unlinkSync(TEST_DATA_PATH);
    }

    // 创建加载器实例，使用不存在的路径，并禁用路径兵底逻辑
    const loader = new OfflineDataLoader('/path/does/not/exist.json', {
      disableFallbackPaths: true,
    });

    // 加载数据
    const data = await loader.loadFallbackData();

    // 验证返回空数组
    expect(data).toHaveLength(0);
    expect(logger.info).toHaveBeenCalledWith(
      'Fallback paths are disabled, returning empty array',
    );
  });

  test('应该能够加载带有嵌入向量的离线数据', async () => {
    // 创建加载器实例
    const loader = new OfflineDataLoader(TEST_DATA_PATH);

    // 加载带有嵌入向量的数据
    const data = await loader.loadFallbackDataWithEmbeddings();

    // 验证数据
    expect(data).toHaveLength(2);
    expect(data[0].id).toBe('https://github.com/example/test-server-1');
    expect(data[0].vector).toEqual([0.1, 0.2, 0.3]);
    expect(data[0].data.title).toBe('测试服务器1显示名称');
    expect(data[1].id).toBe('https://github.com/example/test-server-2');
  });

  test('应该能够设置新的数据路径', async () => {
    // 创建加载器实例
    const loader = new OfflineDataLoader('/initial/path.json');

    // 设置新路径
    loader.setFallbackDataPath(TEST_DATA_PATH);

    // 加载数据
    const data = await loader.loadFallbackData();

    // 验证数据
    expect(data).toHaveLength(2);
    expect(data[0].title).toBe('测试服务器1显示名称');
  });

  test('应该能够处理无效的JSON数据', async () => {
    // 写入无效的JSON数据
    fs.writeFileSync(TEST_DATA_PATH, 'invalid json data', 'utf8');

    // 创建加载器实例
    const loader = new OfflineDataLoader(TEST_DATA_PATH);

    // 加载数据
    const data = await loader.loadFallbackData();

    // 验证返回空数组
    expect(data).toHaveLength(0);
    expect(logger.error).toHaveBeenCalled();
  });
});
