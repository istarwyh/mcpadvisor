/**
 * Meilisearch 配置管理器测试
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { MeilisearchConfigManager } from '../../../config/meilisearch.js';

describe('MeilisearchConfigManager', () => {
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    // 保存原始环境变量
    originalEnv = { ...process.env };
  });

  afterEach(() => {
    // 恢复原始环境变量
    process.env = originalEnv;
  });

  it('should return cloud config by default', () => {
    // 清除相关环境变量
    delete process.env.MEILISEARCH_INSTANCE;
    delete process.env.MEILISEARCH_LOCAL_HOST;
    delete process.env.MEILISEARCH_MASTER_KEY;

    const manager = MeilisearchConfigManager.getInstance();
    const config = manager.getActiveConfig();

    expect(config.type).toBe('cloud');
    expect(config.host).toBe('https://edge.meilisearch.com');
    expect(config.indexName).toBe('mcp_server_info_from_getmcp_io');
    expect(config.apiKey).toBeDefined();
  });

  it('should return local config when MEILISEARCH_INSTANCE=local', () => {
    process.env.MEILISEARCH_INSTANCE = 'local';
    process.env.MEILISEARCH_LOCAL_HOST = 'http://localhost:7700';
    process.env.MEILISEARCH_MASTER_KEY = 'testkey';
    process.env.MEILISEARCH_INDEX_NAME = 'test_index';

    const manager = MeilisearchConfigManager.getInstance();
    const config = manager.getActiveConfig();

    expect(config.type).toBe('local');
    expect(config.host).toBe('http://localhost:7700');
    expect(config.masterKey).toBe('testkey');
    expect(config.indexName).toBe('test_index');
  });

  it('should use default values for local config when env vars are missing', () => {
    process.env.MEILISEARCH_INSTANCE = 'local';
    // 不设置其他环境变量
    delete process.env.MEILISEARCH_LOCAL_HOST;
    delete process.env.MEILISEARCH_MASTER_KEY;
    delete process.env.MEILISEARCH_INDEX_NAME;

    const manager = MeilisearchConfigManager.getInstance();
    const config = manager.getActiveConfig();

    expect(config.type).toBe('local');
    expect(config.host).toBe('http://localhost:7700');
    expect(config.masterKey).toBe('developmentKey');
    expect(config.indexName).toBe('mcp_servers');
  });

  it('should return fallback config for local instance', () => {
    process.env.MEILISEARCH_INSTANCE = 'local';

    const manager = MeilisearchConfigManager.getInstance();
    const fallbackConfig = manager.getFallbackConfig();

    expect(fallbackConfig).not.toBeNull();
    expect(fallbackConfig?.type).toBe('cloud');
    expect(fallbackConfig?.host).toBe('https://edge.meilisearch.com');
  });

  it('should return null fallback config for cloud instance', () => {
    process.env.MEILISEARCH_INSTANCE = 'cloud';

    const manager = MeilisearchConfigManager.getInstance();
    const fallbackConfig = manager.getFallbackConfig();

    expect(fallbackConfig).toBeNull();
  });

  it('should be a singleton', () => {
    const manager1 = MeilisearchConfigManager.getInstance();
    const manager2 = MeilisearchConfigManager.getInstance();

    expect(manager1).toBe(manager2);
  });

  it('should handle custom cloud API key from environment', () => {
    process.env.MEILISEARCH_INSTANCE = 'cloud';
    process.env.MEILISEARCH_CLOUD_API_KEY = 'test-custom-key';

    const manager = MeilisearchConfigManager.getInstance();
    const config = manager.getActiveConfig();

    expect(config.type).toBe('cloud');
    expect(config.apiKey).toBe('test-custom-key');
  });
});
