#!/usr/bin/env node

import { SearchService } from './services/searchService.js';
import { CompassSearchProvider } from './services/core/search/CompassSearchProvider.js';
import { ServerService, TransportType, TransportConfig } from './services/core/server/index.js';
import logger from './utils/logger.js';
import path from 'path';
import { spawn } from 'child_process';
import { GetMcpSearchProvider } from './services/core/search/GetMcpSearchProvider.js';
import { MeilisearchSearchProvider } from './services/core/search/MeilisearchSearchProvider.js';
import { getParamValue } from '@chatmcp/sdk/utils/index.js';
import { NacosMcpProvider } from './services/core/search/NacosMcpProvider.js';
import type { SearchProvider } from './types/index.js';

/**
 * Main application entry point
 * Initializes services and starts the MCP server
 */
async function main() {
  try {
    logger.info('Starting MCP Advisor application');

    // Get parameters from command line or environment variables
    const mode = getParamValue('mode') || process.env.TRANSPORT_TYPE || 'stdio';
    const port = parseInt(
      getParamValue('port') || process.env.SERVER_PORT || '3000',
      10,
    );
    const host =
      getParamValue('host') || process.env.SERVER_HOST || 'localhost';
    const messagePath =
      getParamValue('messagePath') || '/messages';
    const endpoint =
      getParamValue('endpoint') || process.env.ENDPOINT || '/rest';

    // Configure transport
    const transportConfig: TransportConfig = {
      port,
      host,
      ssePath: '/sse',
      messagePath,
      endpoint,
    };

    // Initialize search providers
    const searchProviders: SearchProvider[] = [
      new MeilisearchSearchProvider(),
      new CompassSearchProvider(),
      new GetMcpSearchProvider()
    ];

    // Add Nacos provider if environment variables are configured
    const nacosServerAddr = process.env.NACOS_SERVER_ADDR;
    const nacosUsername = process.env.NACOS_USERNAME;
    const nacosPassword = process.env.NACOS_PASSWORD;

    if (nacosServerAddr && nacosUsername && nacosPassword) {
      try {
        // Ensure required environment variables are defined
        const mcpHost = process.env.MCP_HOST || 'localhost';
        const mcpPort = process.env.MCP_PORT ? parseInt(process.env.MCP_PORT, 10) : 3000;
        const authToken = process.env.AUTH_TOKEN || '';
        const debug = process.env.NACOS_DEBUG === 'true';
        
        const nacosProvider = new NacosMcpProvider({
          serverAddr: nacosServerAddr,
          username: nacosUsername,
          password: nacosPassword,
          mcpHost,
          mcpPort,
          authToken,
          debug
        });
        
        // Initialize the provider asynchronously
        await nacosProvider.init();
        
        searchProviders.push(nacosProvider);
        logger.info('Nacos MCP provider initialized successfully');
      } catch (error) {
        logger.error(
          `Failed to initialize Nacos MCP provider: ${error instanceof Error ? error.message : String(error)}`,
          { error }
        );
      }
    } else {
      logger.warn(
        'Nacos MCP provider not initialized: Missing required environment variables (NACOS_SERVER_ADDR, NACOS_USERNAME, NACOS_PASSWORD)'
      );
    }
    
    const searchService = new SearchService(searchProviders);

    // Best-effort async bootstrap for local Meilisearch
    try {
      if ((process.env.MEILISEARCH_INSTANCE || 'cloud') === 'local') {
        const scriptPath = path.resolve(process.cwd(), 'scripts', 'bootstrap-meilisearch.mjs');
        const child = spawn(process.execPath, ['--no-deprecation', scriptPath], {
          env: { ...process.env },
          stdio: 'ignore',
          detached: true,
        });
        child.unref();
        logger.info('Triggered async Meilisearch bootstrap');
      }
    } catch (e) {
      logger.warn('Skip Meilisearch bootstrap');
    }

    // Determine transport type
    let transportType = TransportType.STDIO;
    if (mode === 'sse') {
      transportType = TransportType.SSE;
    } else if (mode === 'rest') {
      transportType = TransportType.REST;
    }

    // Start server
    const serverService = new ServerService(searchService);
    await serverService.start(transportType, transportConfig);

    logger.info(`MCP Advisor server started with ${transportType} transport,endpoint:${endpoint}`);
  } catch (error) {
    logger.error(
      `Fatal error in main(): ${error instanceof Error ? error.message : String(error)}`,
    );
    process.exit(1);
  }
}

main().catch(error => {
  logger.error(
    `Fatal error in main(): ${error instanceof Error ? error.message : String(error)}`,
  );
  process.exit(1);
});
