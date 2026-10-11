import { NacosMcpProvider } from '../../../../services/core/search/NacosMcpProvider.js';
import { SearchParams } from '../../../../types/search.js';
import { vi, describe, it, expect, beforeEach, afterEach, Mock } from 'vitest';
import { NacosClient } from '../../../../services/providers/nacos/NacosClient.js';
import { VectorDB } from '../../../../services/common/vector/VectorDB.js';
import { McpManager } from '../../../../services/providers/nacos/NacosMcpManager.js';
import logger from '../../../../utils/logger.js';

// Mock the logger to prevent console output during tests
vi.mock('../../../../utils/logger.js', () => ({
  default: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

// Mock the VectorDB and McpManager to avoid real network calls
vi.mock('../../../../services/vector/VectorDB.js', () => ({
  VectorDB: vi.fn().mockImplementation(() => ({
    start: vi.fn().mockResolvedValue(undefined),
    isReady: vi.fn().mockResolvedValue(true),
    close: vi.fn().mockResolvedValue(undefined),
    _collectionId: 'test-collection',
  })),
}));

vi.mock('../../../../services/mcp/McpManager.js', () => ({
  McpManager: vi.fn().mockImplementation(() => ({
    startSync: vi.fn().mockResolvedValue(undefined),
    stopSync: vi.fn().mockResolvedValue(undefined),
    search: vi.fn().mockResolvedValue([]),
  })),
}));

describe('NacosMcpProvider', () => {
  let provider: NacosMcpProvider;
  let mockNacosClient: any;
  let mockVectorDB: any;
  let mockMcpManager: any;
  let mockLogger: any;

  const mockConfig = {
    serverAddr: 'http://localhost:8848',
    username: 'test',
    password: 'test123',
    mcpHost: 'localhost',
    mcpPort: 3000,
    authToken: 'test-token',
    minSimilarity: 0.3,
    limit: 10,
    debug: true,
  };

  beforeEach(async () => {
    // Reset all mocks before each test
    vi.clearAllMocks();

    // Create mock implementations
    mockNacosClient = {
      init: vi.fn().mockResolvedValue(undefined),
      close: vi.fn().mockResolvedValue(undefined),
      isReady: vi.fn().mockResolvedValue(true),
      searchMcpByKeyword: vi.fn().mockResolvedValue([
        {
          name: 'test-server',
          groupName: 'DEFAULT_GROUP',
          metadata: {
            description: 'Test server description',
          },
          toDict: () => ({
            name: 'test-server',
            description: 'Test server description',
            agentConfig: {
              categories: ['test'],
              metadata: {
                description: 'Test server description',
              },
            },
          }),
        },
      ]),
      getAllServices: vi.fn().mockResolvedValue([]),
    };

    mockVectorDB = {
      start: vi.fn().mockResolvedValue(undefined),
      isReady: vi.fn().mockResolvedValue(true),
      close: vi.fn().mockResolvedValue(undefined),
      _collectionId: 'test-collection',
    };

    mockMcpManager = {
      startSync: vi.fn().mockResolvedValue(undefined),
      stopSync: vi.fn().mockResolvedValue(undefined),
      search: vi.fn().mockResolvedValue([
        {
          id: 'test-server',
          title: 'test-server',
          description: 'Test server description',
          categories: ['test'],
          tags: ['test'],
          score: 0.9,
          similarity: 0.9,
          sourceUrl: 'nacos://test-server',
          installations: {},
        },
      ]),
    };

    // Create a new instance in test mode to skip real initialization
    provider = new NacosMcpProvider(mockConfig, true);

    // Set up the mocks
    (provider as any).nacosClient = mockNacosClient;
    (provider as any).vectorDB = mockVectorDB;
    (provider as any).mcpManager = mockMcpManager;
    (provider as any)._isInitialized = true;

    // Mock the logger
    mockLogger = logger;
  });

  afterEach(async () => {
    // Clean up after each test
    if (provider) {
      await provider.close();
    }
  });

  afterAll(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  describe('close', () => {
    it('should close the Nacos client', async () => {
      // Mock the close methods
      mockMcpManager.stopSync = vi.fn().mockResolvedValue(undefined);
      mockNacosClient.close = vi.fn().mockResolvedValue(undefined);

      await provider.close();

      // Verify that the client's close method was called
      expect(mockNacosClient.close).toHaveBeenCalled();
      expect(mockMcpManager.stopSync).toHaveBeenCalled();

      // Verify that the provider is marked as not initialized
      expect((provider as any)._isInitialized).toBe(false);
    });

    it('should throw an error if provider is closed', async () => {
      // Mock the close methods
      mockMcpManager.stopSync = vi.fn().mockResolvedValue(undefined);
      mockNacosClient.close = vi.fn().mockResolvedValue(undefined);

      await provider.close();

      await expect(
        provider.search({ taskDescription: 'test after close' }),
      ).rejects.toThrow('NacosMcpProvider is closing or has been closed');
    });

    it('should handle errors during close', async () => {
      // Mock an error during close
      mockNacosClient.close.mockRejectedValue(new Error('Close failed'));

      await expect(provider.close()).resolves.not.toThrow();
      expect(mockVectorDB.close).toHaveBeenCalled(); // Should still call other close methods
    });
  });

  describe('initialization', () => {
    it('should initialize Nacos client, VectorDB, and McpManager', async () => {
      // Reset mocks and create a new provider without test mode
      const testProvider = new NacosMcpProvider(mockConfig);

      // Mock the init method to avoid real initialization
      const initSpy = vi
        .spyOn(testProvider as any, 'init')
        .mockImplementation(async () => {
          // Set up the mocked dependencies after initialization
          (testProvider as any).mcpManager = mockMcpManager;
          (testProvider as any).vectorDB = mockVectorDB;
          (testProvider as any).nacosClient = mockNacosClient;
          (testProvider as any)._isInitialized = true;
        });

      // Call search which should trigger initialization
      await testProvider.search({ taskDescription: 'test' });

      expect(initSpy).toHaveBeenCalled();
      await testProvider.close();
    });

    it('should throw an error if initialization fails', async () => {
      const testProvider = new NacosMcpProvider(mockConfig);
      vi.spyOn(testProvider as any, 'init').mockRejectedValue(
        new Error('Initialization failed'),
      );

      await expect(
        testProvider.search({ taskDescription: 'test' }),
      ).rejects.toThrow(
        'Failed to initialize NacosMcpProvider: Initialization failed',
      );

      await testProvider.close();
    });
  });

  describe('search', () => {
    it('should return an array of MCPServerResponse', async () => {
      // Mock the search result
      mockMcpManager.search.mockResolvedValue([
        {
          id: 'test-server',
          title: 'test-server',
          description: 'Test server description',
          categories: ['test'],
          tags: ['test'],
          score: 0.9,
          similarity: 0.9,
          sourceUrl: 'nacos://test-server',
          installations: {},
        },
      ]);

      // Setup mock return value - match the actual response structure
      const mockServer = {
        name: 'test-server',
        description: 'Test server description',
        agentConfig: {
          categories: ['test'],
          tags: ['test'],
          metadata: {
            vector: [0.1, 0.2, 0.3],
          },
        },
        toDict: () => ({
          name: 'test-server',
          description: 'Test server description',
          agentConfig: {
            categories: ['test'],
            tags: ['test'],
            metadata: {
              vector: [0.1, 0.2, 0.3],
            },
          },
        }),
      };

      // Mock the searchMcpByKeyword to return our test server
      mockNacosClient.searchMcpByKeyword.mockResolvedValueOnce([mockServer]);
      mockMcpManager.search.mockResolvedValueOnce([
        {
          id: 'test-server',
          score: 0.9,
          metadata: {
            original: mockServer.toDict(),
          },
        },
      ]);

      const searchParams: SearchParams = {
        taskDescription: 'test search',
        keywords: ['test'],
        capabilities: ['test-capability'],
      };

      const results = await provider.search(searchParams);

      // Verify we got an array with at least one result
      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBeGreaterThan(0);

      // Check the structure of the first result
      const result = results[0];
      expect(result).toMatchObject({
        id: 'test-server',
        title: 'test-server',
        description: 'Test server description',
        sourceUrl: expect.stringContaining('nacos://'),
        similarity: expect.any(Number),
        score: expect.any(Number),
        installations: expect.any(Object),
        categories: expect.arrayContaining([expect.any(String)]),
        tags: expect.arrayContaining([expect.any(String)]),
      });

      // Verify search was called with the first keyword
      expect(mockNacosClient.searchMcpByKeyword).toHaveBeenCalledWith('test');
    });

    it('should handle empty keywords by extracting from task description', async () => {
      // Mock the search result
      mockMcpManager.search.mockResolvedValue([
        {
          id: 'test-server',
          title: 'test-server',
          description: 'Test server description',
          categories: ['test'],
          tags: ['test'],
          score: 0.9,
          similarity: 0.9,
          sourceUrl: 'nacos://test-server',
          installations: {},
        },
      ]);

      // Setup mock return value - match the actual response structure
      const mockServer = {
        name: 'test-server',
        description: 'Test server description',
        agentConfig: {
          categories: ['test'],
          tags: ['test'],
        },
        toDict: () => ({
          name: 'test-server',
          description: 'Test server description',
          agentConfig: {
            categories: ['test'],
            tags: ['test'],
          },
        }),
      };

      mockNacosClient.searchMcpByKeyword.mockResolvedValueOnce([mockServer]);

      const searchParams: SearchParams = {
        taskDescription: 'test search with no keywords',
      };

      const results = await provider.search(searchParams);

      // Verify we got an array with at least one result
      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBeGreaterThan(0);

      // Check the structure of the first result
      const result = results[0];
      expect(result).toMatchObject({
        id: 'test-server',
        title: 'test-server',
        description: 'Test server description',
        sourceUrl: expect.stringContaining('nacos://'),
        similarity: expect.any(Number),
        score: expect.any(Number),
        installations: expect.any(Object),
        categories: expect.arrayContaining([expect.any(String)]),
        tags: expect.arrayContaining([expect.any(String)]),
      });

      // Verify search was called with the first word of the task description
      // Note: The actual implementation might call it multiple times with different keywords
      expect(mockNacosClient.searchMcpByKeyword).toHaveBeenCalledWith('test');
    });

    it('should handle errors during search', async () => {
      // Mock the searchNacosMcpServers method to throw an error
      vi.spyOn(provider as any, 'searchNacosMcpServers').mockRejectedValue(
        new Error('Search failed'),
      );

      const searchParams: SearchParams = {
        taskDescription: 'test error handling',
        keywords: ['test'],
      };

      await expect(provider.search(searchParams)).rejects.toThrow(
        'Search failed',
      );
    });

    it('should handle empty search results', async () => {
      // Mock empty results
      mockMcpManager.search.mockResolvedValueOnce([]);
      mockNacosClient.searchMcpByKeyword.mockResolvedValueOnce([]);

      const searchParams: SearchParams = {
        taskDescription: 'test empty search',
        keywords: ['empty'],
      };

      const results = await provider.search(searchParams);
      expect(results).toEqual([]);
    });

    it('should handle vector search', async () => {
      const vectorServer = {
        name: 'vector-server',
        description: 'Vector search test',
        agentConfig: {
          categories: ['vector'],
          metadata: {
            vector: [0.1, 0.2, 0.3],
          },
        },
        toDict: () => ({
          name: 'vector-server',
          description: 'Vector search test',
          agentConfig: {
            categories: ['vector'],
            metadata: {
              vector: [0.1, 0.2, 0.3],
            },
          },
        }),
      };

      // Mock vector search results
      mockMcpManager.search.mockResolvedValueOnce([
        {
          id: 'vector-server',
          score: 0.95,
          metadata: {
            original: vectorServer.toDict(),
          },
        },
      ]);

      const searchParams: SearchParams = {
        taskDescription: 'vector search test',
      };

      const results = await provider.search(searchParams);
      expect(results[0].id).toBe('vector-server');
      expect(mockMcpManager.search).toHaveBeenCalled();
    });

    it('should handle vector search errors', async () => {
      // Mock vector search failure
      const error = new Error('Vector search failed');
      mockMcpManager.search.mockRejectedValueOnce(error);

      // Mock the fallback keyword search
      mockNacosClient.searchMcpByKeyword.mockResolvedValueOnce([
        {
          name: 'fallback-server',
          description: 'Fallback test',
          agentConfig: {},
          toDict: () => ({
            name: 'fallback-server',
            description: 'Fallback test',
            agentConfig: {},
          }),
        },
      ]);

      const searchParams: SearchParams = {
        taskDescription: 'fallback test',
      };

      const results = await provider.search(searchParams);

      // Should still return results from the fallback search
      expect(results).toBeInstanceOf(Array);
      expect(mockNacosClient.searchMcpByKeyword).toHaveBeenCalled();

      // Verify the error was logged
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Vector search failed, falling back to keyword search',
        expect.any(Error),
      );
    });
  });

  describe('error handling', () => {
    it('should handle initialization errors in search', async () => {
      const testProvider = new NacosMcpProvider(mockConfig, true);

      // Mock the initialization to fail
      const initError = new Error('Init failed');
      vi.spyOn(testProvider as any, 'init').mockRejectedValue(initError);

      // Reset the initialization state
      (testProvider as any)._isInitialized = false;
      (testProvider as any)._initializationPromise = null;

      await expect(
        testProvider.search({ taskDescription: 'test' }),
      ).rejects.toThrow('Failed to initialize NacosMcpProvider: Init failed');

      // Verify the error was logged
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to initialize NacosMcpProvider:',
        expect.any(Error),
      );

      await testProvider.close();
    });

    it('should handle errors during vector DB operations', async () => {
      // Create a new test provider
      const testProvider = new NacosMcpProvider(mockConfig, true);

      // Mock the vector DB to fail
      const failingVectorDB = {
        start: vi.fn().mockResolvedValue(undefined),
        isReady: vi.fn().mockRejectedValue(new Error('Vector DB not ready')),
        close: vi.fn().mockResolvedValue(undefined),
      };

      // Mock the nacos client to also fail for fallback search
      const failingNacosClient = {
        init: vi.fn().mockResolvedValue(undefined),
        close: vi.fn().mockResolvedValue(undefined),
        isReady: vi.fn().mockResolvedValue(true),
        searchMcpByKeyword: vi
          .fn()
          .mockRejectedValue(new Error('Nacos search failed')),
        getAllServices: vi.fn().mockResolvedValue([]),
      };

      // Set up the test provider with the failing components
      (testProvider as any).vectorDB = failingVectorDB;
      (testProvider as any).nacosClient = failingNacosClient;
      (testProvider as any).mcpManager = {
        search: vi.fn().mockRejectedValue(new Error('Vector search failed')),
      };

      // Reset initialization state
      (testProvider as any)._isInitialized = true;

      await expect(
        testProvider.search({ taskDescription: 'test' }),
      ).rejects.toThrow('Vector search failed');
    });
  });
});
