/**
 * Failover Meilisearch 客户端测试
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  FailoverMeilisearchClient,
  MeilisearchClientFactory,
} from '../../../services/providers/meilisearch/controller.js';

// Mock the config manager
vi.mock('../../../config/meilisearch.js', () => ({
  MeilisearchConfigManager: {
    getInstance: vi.fn(() => ({
      getActiveConfig: vi.fn(() => ({
        type: 'local',
        host: 'http://localhost:7700',
        masterKey: 'testkey',
        indexName: 'test_index',
      })),
      getFallbackConfig: vi.fn(() => ({
        type: 'cloud',
        host: 'https://edge.meilisearch.com',
        apiKey: 'cloudkey',
        indexName: 'cloud_index',
      })),
    })),
  },
}));

// Mock the local controller
vi.mock('../../../services/providers/meilisearch/localController.js', () => ({
  LocalMeilisearchController: vi.fn().mockImplementation(() => ({
    search: vi.fn(),
    healthCheck: vi.fn(),
  })),
}));

// Mock MeiliSearch
vi.mock('meilisearch', () => ({
  MeiliSearch: vi.fn().mockImplementation(() => ({
    index: vi.fn(() => ({
      search: vi.fn(),
    })),
    health: vi.fn(),
  })),
}));

describe('FailoverMeilisearchClient', () => {
  let client: FailoverMeilisearchClient;

  beforeEach(() => {
    vi.clearAllMocks();
    client = new FailoverMeilisearchClient();
  });

  it('should create client with primary and fallback', () => {
    expect(client).toBeInstanceOf(FailoverMeilisearchClient);
  });

  it('should use primary client for successful search', async () => {
    const mockResults = { hits: [{ id: '1', title: 'Test' }] };

    // Mock primary client success
    const primaryClient = (client as any).primaryClient;
    primaryClient.search = vi.fn().mockResolvedValue(mockResults);

    const results = await client.search('test query');

    expect(results).toEqual(mockResults);
    expect(primaryClient.search).toHaveBeenCalledWith('test query', undefined);
  });

  it('should fallback to secondary client when primary fails', async () => {
    const mockResults = { hits: [{ id: '1', title: 'Fallback Test' }] };

    // Mock primary client failure
    const primaryClient = (client as any).primaryClient;
    primaryClient.search = vi
      .fn()
      .mockRejectedValue(new Error('Primary failed'));

    // Mock fallback client success
    const fallbackClient = (client as any).fallbackClient;
    fallbackClient.search = vi.fn().mockResolvedValue(mockResults);

    const results = await client.search('test query');

    expect(results).toEqual(mockResults);
    expect(primaryClient.search).toHaveBeenCalledWith('test query', undefined);
    expect(fallbackClient.search).toHaveBeenCalledWith('test query', undefined);
  });

  it('should throw error when both primary and fallback fail', async () => {
    // Mock both clients failure
    const primaryClient = (client as any).primaryClient;
    primaryClient.search = vi
      .fn()
      .mockRejectedValue(new Error('Primary failed'));

    const fallbackClient = (client as any).fallbackClient;
    fallbackClient.search = vi
      .fn()
      .mockRejectedValue(new Error('Fallback failed'));

    await expect(client.search('test query')).rejects.toThrow(
      'Fallback failed',
    );
  });

  it('should handle health check from primary client', async () => {
    const primaryClient = (client as any).primaryClient;
    primaryClient.healthCheck = vi.fn().mockResolvedValue(true);

    const result = await client.healthCheck();

    expect(result).toBe(true);
    expect(primaryClient.healthCheck).toHaveBeenCalled();
  });

  it('should fallback to secondary health check when primary fails', async () => {
    const primaryClient = (client as any).primaryClient;
    primaryClient.healthCheck = vi
      .fn()
      .mockRejectedValue(new Error('Health check failed'));

    const fallbackClient = (client as any).fallbackClient;
    fallbackClient.healthCheck = vi.fn().mockResolvedValue(true);

    const result = await client.healthCheck();

    expect(result).toBe(true);
    expect(fallbackClient.healthCheck).toHaveBeenCalled();
  });

  it('should handle missing health check method gracefully', async () => {
    const primaryClient = (client as any).primaryClient;
    delete primaryClient.healthCheck;

    const result = await client.healthCheck();

    expect(result).toBe(true);
  });
});
