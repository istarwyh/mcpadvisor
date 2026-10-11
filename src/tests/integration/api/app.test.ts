/**
 * Basic tests for the MCP Compass application
 */

import { describe, test, expect, beforeEach, vi, afterEach } from 'vitest';
import { CompassSearchProvider } from '../../../services/core/search/CompassSearchProvider.js';
import { SearchService } from '../../../services/searchService.js';
import { MCPServerResponse } from '../../../types/index.js';
import logger from '../../../utils/logger.js';

// Mock the global fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock the logger
vi.mock('../../../utils/logger', () => ({
  default: {
    info: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
  },
}));

describe('MCP Compass Application', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  test('SearchProvider can handle search requests', async () => {
    // Setup the fetch mock
    const mockResponse = [
      {
        title: 'Test MCP Server',
        description: 'A test MCP server',
        sourceUrl: 'https://github.com/test/mcp-server',
        similarity: 0.9,
      },
    ] as MCPServerResponse[];

    // Setup the fetch mock
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse,
    });

    // Create the search provider
    const searchProvider = new CompassSearchProvider();

    // Perform a search
    const results = await searchProvider.search({
      taskDescription: 'test query',
    });

    // Verify the results
    expect(results).toEqual(mockResponse);
    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(logger.info).toHaveBeenCalledWith(
      expect.stringContaining('Searching for MCP servers'),
    );
    expect(global.fetch).toHaveBeenCalledWith(
      'https://registry.mcphub.io/recommend?description=test%20query',
    );
  });

  test('SearchProvider handles API errors', async () => {
    // Setup the fetch mock to simulate an error
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
    });

    // Create the search provider
    const searchProvider = new CompassSearchProvider();

    // Expect the search to throw an error
    await expect(
      searchProvider.search({ taskDescription: 'test query' }),
    ).rejects.toThrow();
    expect(logger.error).toHaveBeenCalled();
    expect(global.fetch).toHaveBeenCalledWith(
      'https://registry.mcphub.io/recommend?description=test%20query',
    );
  });

  test('SearchService can handle multiple providers', async () => {
    // Create mock providers
    const mockProvider1 = {
      search: vi
        .fn()
        .mockImplementation((params: { taskDescription: string }) => {
          return Promise.resolve([
            {
              title: 'Provider 1 MCP Server',
              description: 'A test MCP server from provider 1',
              github_url: 'https://github.com/test/mcp-server-1',
              similarity: 0.9,
            },
            {
              title: 'Provider 1 Extra Server 1',
              description: 'An extra test MCP server from provider 1',
              github_url: 'https://github.com/test/mcp-server-extra-1',
              similarity: 0.7,
            },
            {
              title: 'Provider 1 Extra Server 2',
              description: 'Another extra test MCP server from provider 1',
              github_url: 'https://github.com/test/mcp-server-extra-2',
              similarity: 0.5,
            },
          ]);
        }),
    };

    const mockProvider2 = {
      search: vi
        .fn()
        .mockImplementation((params: { taskDescription: string }) => {
          return Promise.resolve([
            {
              title: 'Provider 2 MCP Server',
              description: 'A test MCP server from provider 2',
              github_url: 'https://github.com/test/mcp-server-2',
              similarity: 0.95,
            },
            {
              title: 'Provider 2 Extra Server',
              description: 'An extra test MCP server from provider 2',
              github_url: 'https://github.com/test/mcp-server-extra-3',
              similarity: 0.6,
            },
          ]);
        }),
    };

    // Create search service with multiple providers and limit option
    const searchService = new SearchService([mockProvider1, mockProvider2]);

    // Perform a search with limit option to ensure we only get top 2 results
    const results = await searchService.search(
      { taskDescription: 'test query' },
      { limit: 2 },
    );

    // Verify that both providers were called with SearchParams
    expect(mockProvider1.search).toHaveBeenCalledWith({
      taskDescription: 'test query',
    });
    expect(mockProvider2.search).toHaveBeenCalledWith({
      taskDescription: 'test query',
    });

    // Verify results are merged, sorted by similarity, and limited to 2
    expect(results).toHaveLength(2);
    expect(results[0].title).toBe('Provider 2 MCP Server'); // Higher similarity should be first
    expect(results[1].title).toBe('Provider 1 MCP Server');
  });

  test('SearchService merges and sorts results correctly', async () => {
    // Create mock providers with overlapping results
    const mockProvider1 = {
      search: vi.fn().mockImplementation(() => {
        return Promise.resolve([
          {
            title: 'Common Server',
            description: 'A server that appears in both providers',
            github_url: 'https://github.com/test/common-server',
            similarity: 0.85,
          },
          {
            title: 'Provider 1 Unique Server',
            description: 'A server unique to provider 1',
            github_url: 'https://github.com/test/unique-server-1',
            similarity: 0.75,
          },
        ]);
      }),
    };

    const mockProvider2 = {
      search: vi.fn().mockImplementation(() => {
        return Promise.resolve([
          {
            title: 'Common Server',
            description: 'A server that appears in both providers',
            github_url: 'https://github.com/test/common-server',
            similarity: 0.9, // Higher similarity than provider 1
          },
          {
            title: 'Provider 2 Unique Server',
            description: 'A server unique to provider 2',
            github_url: 'https://github.com/test/unique-server-2',
            similarity: 0.8,
          },
        ]);
      }),
    };

    // Create search service with multiple providers
    const searchService = new SearchService([mockProvider1, mockProvider2]);

    // Perform a search with SearchParams
    const results = await searchService.search({
      taskDescription: 'test query',
    });

    // Check sorting order by similarity
    expect(results[0].title).toBe('Common Server');
    expect(results[0].similarity).toBe(0.9); // Should take the higher similarity value
    expect(results[1].title).toBe('Provider 2 Unique Server');
    expect(results[2].title).toBe('Provider 1 Unique Server');
  });
});
