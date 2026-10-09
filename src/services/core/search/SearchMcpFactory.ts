/**
 * Factory for creating and managing MCP search providers
 * Centralizes search functionality for different MCP search providers
 */

import { SearchService } from '../../searchService.js';
import { SearchOptions, MCPServerResponse } from '../../../types/index.js';
import type { SearchParams } from '../../../types/search.js';
import { OfflineSearchProvider } from './OfflineSearchProvider.js';
import { GetMcpSearchProvider } from './GetMcpSearchProvider.js';
import { ClineSearchProvider } from './ClineSearchProvider.js';
import { CompassSearchProvider } from './CompassSearchProvider.js';
import { MeilisearchSearchProvider } from './MeilisearchSearchProvider.js';
import { NacosMcpProvider } from './NacosMcpProvider.js';
import logger from '../../../utils/logger.js';
import type { NacosMcpProviderConfig } from '../../../types/nacos.js';

/**
 * Search using the Offline provider
 * @param query Search query or params
 * @param options Search options
 * @param fallbackDataPath Path to fallback data
 * @param textMatchWeight Weight for text matching (default: 0.7)
 * @returns Array of MCP server responses
 */
export async function searchOffline(
  query: string | SearchParams,
  options: SearchOptions = {},
  fallbackDataPath?: string,
  textMatchWeight: number = 0.7,
): Promise<MCPServerResponse[]> {
  const searchParams = typeof query === 'string' 
    ? { taskDescription: query }
    : query;
  
  try {
    logger.info(`Searching offline with query: "${query}"`, 'OfflineSearch', {
      query,
      options,
    });

    const startTime = Date.now();
    const provider = new OfflineSearchProvider({
      fallbackDataPath,
      minSimilarity: options.minSimilarity || 0.3,
      textMatchWeight,
      vectorSearchWeight: 1 - textMatchWeight,
    });

    logger.debug('Using OfflineSearchProvider', 'OfflineSearch');
    const service = new SearchService([provider]);
    const results = await service.search(searchParams, options);
    const duration = Date.now() - startTime;

    logger.info(
      `Offline search completed in ${duration}ms with ${results.length} results`,
      'OfflineSearch',
      {
        duration,
        resultCount: results.length,
      },
    );

    return results;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(`Error searching offline: ${errorMessage}`, 'OfflineSearch', {
      error: errorMessage,
    });
    throw error;
  }
}

/**
 * Search using the GetMCP provider
 * @param query Search query or params
 * @param options Search options
 * @returns Array of MCP server responses
 */
export async function searchGetMcp(
  query: string | SearchParams,
  options: SearchOptions = {},
): Promise<MCPServerResponse[]> {
  const searchParams = typeof query === 'string' 
    ? { taskDescription: query }
    : query;
    
  try {
    logger.info(`Searching GetMCP with query: "${query}"`, 'GetMcpSearch', {
      query,
      options,
    });

    const provider = new GetMcpSearchProvider();
    logger.debug('Created GetMcpSearchProvider instance', 'GetMcpSearch');

    const service = new SearchService([provider]);
    logger.debug('Created SearchService with GetMcpSearchProvider', 'GetMcpSearch');

    const startTime = Date.now();
    const results = await service.search(searchParams, options);
    const duration = Date.now() - startTime;

    logger.info(
      `GetMCP search completed in ${duration}ms with ${results.length} results`,
      'GetMcpSearch',
      {
        duration,
        resultCount: results.length,
      },
    );

    return results;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(`Error searching GetMCP: ${errorMessage}`, 'GetMcpSearch', {
      error: errorMessage,
    });
    throw error;
  }
}

/**
 * Search using the Compass provider
 * @param query Search query or params
 * @param options Search options
 * @returns Array of MCP server responses
 */
export async function searchCompass(
  query: string | SearchParams,
  options: SearchOptions = {},
): Promise<MCPServerResponse[]> {
  const searchParams = typeof query === 'string' 
    ? { taskDescription: query }
    : query;
    
  try {
    logger.info(`Searching Compass with query: "${query}"`, 'CompassSearch', {
      query,
      options,
    });

    const provider = new CompassSearchProvider();
    logger.debug('Created CompassSearchProvider instance', 'CompassSearch');

    const service = new SearchService([provider]);
    logger.debug('Created SearchService with CompassSearchProvider', 'CompassSearch');

    const startTime = Date.now();
    const results = await service.search(searchParams, options);
    const duration = Date.now() - startTime;

    logger.info(
      `Compass search completed in ${duration}ms with ${results.length} results`,
      'CompassSearch',
      {
        duration,
        resultCount: results.length,
      },
    );

    return results;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(`Error searching Compass: ${errorMessage}`, 'CompassSearch', {
      error: errorMessage,
    });
    throw error;
  }
}

/**
 * Search using the Meilisearch provider
 * @param query Search query or params
 * @param options Search options
 * @returns Array of MCP server responses
 */
export async function searchMeilisearch(
  query: string | SearchParams,
  options: SearchOptions = {},
): Promise<MCPServerResponse[]> {
  const searchParams = typeof query === 'string' 
    ? { taskDescription: query }
    : query;
    
  try {
    logger.info(
      `Searching Meilisearch with query: "${query}"`,
      'MeilisearchSearch',
      { query, options },
    );

    const provider = new MeilisearchSearchProvider();
    logger.debug('Created MeilisearchSearchProvider instance', 'MeilisearchSearch');

    const service = new SearchService([provider]);
    logger.debug('Created SearchService with MeilisearchSearchProvider', 'MeilisearchSearch');

    const startTime = Date.now();
    const results = await service.search(searchParams, options);
    const duration = Date.now() - startTime;

    logger.info(
      `Meilisearch search completed in ${duration}ms with ${results.length} results`,
      'MeilisearchSearch',
      {
        duration,
        resultCount: results.length,
      },
    );

    return results;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(
      `Error searching Meilisearch: ${errorMessage}`,
      'MeilisearchSearch',
      { error: errorMessage },
    );
    throw error;
  }
}

/**
 * Factory function to get a search function by provider name
 * @param providerName Name of the provider ('offline', 'getmcp', 'compass', 'meilisearch')
 * @returns The corresponding search function
 */
/**
 * Search using the Nacos MCP provider
 * @param query Search query or params
 * @param options Search options
 * @param config Nacos MCP provider configuration
 * @returns Array of MCP server responses
 */
export async function searchNacosMcp(
  query: string | SearchParams,
  options: SearchOptions = {},
  config: NacosMcpProviderConfig
): Promise<MCPServerResponse[]> {
  const searchParams = typeof query === 'string' 
    ? { taskDescription: query }
    : query;

  try {
    logger.info(`Searching Nacos MCP with query: "${query}"`, 'NacosMcpSearch', {
      query,
      options,
    });

    const startTime = Date.now();
    const provider = new NacosMcpProvider({
      ...config,
      minSimilarity: options.minSimilarity || 0.3,
      limit: options.limit || 10,
      debug: process.env.NODE_ENV === 'development',
    });

    logger.debug('Using NacosMcpProvider', 'NacosMcpSearch');
    const service = new SearchService([provider]);
    const results = await service.search(searchParams, options);
    const duration = Date.now() - startTime;

    logger.info(
      `Nacos MCP search completed in ${duration}ms with ${results.length} results`,
      'NacosMcpSearch',
      {
        duration,
        resultCount: results.length,
      },
    );

    return results;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(`Error searching Nacos MCP: ${errorMessage}`, 'NacosMcpSearch', {
      error: errorMessage,
    });
    throw error;
  }
}

// Reuse the opt-in provider so separate factory calls share its catalog cache.
let clineProvider: ClineSearchProvider | undefined;

export async function searchCline(
  query: string | SearchParams,
  options: SearchOptions = {},
): Promise<MCPServerResponse[]> {
  clineProvider ??= new ClineSearchProvider();
  const params = typeof query === 'string' ? { taskDescription: query } : query;
  return new SearchService([clineProvider]).search(params, options);
}

export function getSearchFunction(providerName: string) {
  const normalizedProviderName = providerName.toLowerCase();
  
  switch (normalizedProviderName) {
    case 'offline':
      return searchOffline;
    case 'getmcp':
      return searchGetMcp;
    case 'cline':
      return searchCline;
    case 'compass':
      return searchCompass;
    case 'meilisearch':
      return searchMeilisearch;
    case 'nacos':
    case 'nacos-mcp':
      return (query: string | SearchParams, options: SearchOptions & { authToken?: string } = {}) => {
        // Create config with required fields and optional authToken
        const config = {
          serverAddr: process.env.NACOS_SERVER_ADDR || 'http://localhost:8848',
          username: process.env.NACOS_USERNAME || 'nacos',
          password: process.env.NACOS_PASSWORD || 'nacos',
          mcpHost: process.env.MCP_HOST || 'localhost',
          mcpPort: process.env.MCP_PORT ? parseInt(process.env.MCP_PORT, 10) : 3000,
          authToken: options.authToken || process.env.MCP_AUTH_TOKEN || '',
        };
        
        // Remove authToken from options to avoid passing it twice
        const { authToken, ...searchOptions } = options;
        
        return searchNacosMcp(query, searchOptions, config);
      };
    default:
      throw new Error(`Unknown search provider: ${providerName}`);
  }
}
