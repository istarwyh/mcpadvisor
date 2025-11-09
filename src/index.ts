#!/usr/bin/env node

import { SearchService } from './services/searchService.js';
import { CompassSearchProvider } from './services/core/search/CompassSearchProvider.js';
import { ServerService, TransportType, TransportConfig } from './services/core/server/index.js';
import logger from './utils/logger.js';
import path from 'path';
import { spawn } from 'child_process';
import fs from 'fs';
import os from 'os';
import { randomBytes } from 'crypto';
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

    // If user opts in, ensure local Meilisearch is running and configured
    const wantLocalMeili = process.argv.includes('--local-meilisearch');
    if (wantLocalMeili) {
      await ensureLocalMeilisearch();
    }

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
        // Try multiple potential script locations
        const possiblePaths = [
          path.resolve(process.cwd(), 'scripts', 'meilisearch', 'meilisearch.bootstrap.mjs'),
          path.resolve(process.cwd(), 'scripts', 'bootstrap-meilisearch.mjs'),
        ];

        const scriptPath = possiblePaths.find(p => {
          try {
            return require('fs').existsSync(p);
          } catch {
            return false;
          }
        });

        if (scriptPath) {
          const child = spawn(process.execPath, ['--no-deprecation', scriptPath], {
            env: { ...process.env },
            stdio: 'ignore',
            detached: true,
          });
          child.unref();
          logger.info('Triggered async Meilisearch bootstrap');
        } else {
          logger.debug('Bootstrap script not found, skipping');
        }
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

// Helpers
async function ensureLocalMeilisearch(): Promise<void> {
  const baseDir = path.join(os.homedir(), '.meilisearch');
  const dbPath = path.join(baseDir, 'data.ms');
  const host = process.env.MEILISEARCH_LOCAL_HOST || 'http://localhost:7700';
  const indexName = process.env.MEILISEARCH_INDEX_NAME || 'mcp_servers';

  const healthy = async (): Promise<boolean> => {
    try {
      const fetchFn: any = (globalThis as any).fetch;
      if (!fetchFn) return false;
      const res = await fetchFn(`${host}/health`);
      return res.ok;
    } catch {
      return false;
    }
  };

  if (await healthy()) {
    // Just enforce local instance mode for provider alignment
    process.env.MEILISEARCH_INSTANCE = 'local';
    process.env.MEILISEARCH_LOCAL_HOST = host;
    if (!process.env.MEILISEARCH_INDEX_NAME) process.env.MEILISEARCH_INDEX_NAME = indexName;
    logger.info('Detected running local Meilisearch; using it');
    return;
  }

  // Try to start a local Meilisearch instance
  try {
    fs.mkdirSync(baseDir, { recursive: true });
  } catch {}

  const candidates = [
    process.env.MEILISEARCH_BIN,
    'meilisearch',
    path.join(baseDir, 'bin', 'meilisearch'),
  ].filter(Boolean) as string[];

  const pickExisting = (): string | null => {
    for (const c of candidates) {
      try {
        // If absolute path, check fs; otherwise rely on PATH execution
        if (path.isAbsolute(c)) {
          if (fs.existsSync(c)) return c;
        } else {
          return c; // let spawn resolve from PATH
        }
      } catch {}
    }
    return null;
  };

  const bin = pickExisting();
  if (!bin) {
    logger.warn('Meilisearch binary not found in PATH or ~/.meilisearch/bin; skip auto-start');
    return;
  }

  const masterKey = process.env.MEILISEARCH_MASTER_KEY || randomKey();
  const args = [`--master-key=${masterKey}`, `--db-path=${dbPath}`];

  try {
    const child = spawn(bin, args, { stdio: 'ignore', detached: true });
    child.unref();
    logger.info('Starting local Meilisearch (background)...');
  } catch (e) {
    logger.warn('Failed to start Meilisearch automatically');
    return;
  }

  // Wait for health up to 60s
  const startedAt = Date.now();
  while (Date.now() - startedAt < 60000) {
    if (await healthy()) break;
    await new Promise(r => setTimeout(r, 1000));
  }

  if (!(await healthy())) {
    logger.warn('Meilisearch did not become healthy in 60s; continuing without local instance');
    return;
  }

  // Configure in-process env so provider uses local
  process.env.MEILISEARCH_INSTANCE = 'local';
  process.env.MEILISEARCH_LOCAL_HOST = host;
  process.env.MEILISEARCH_MASTER_KEY = masterKey;
  process.env.MEILISEARCH_INDEX_NAME = indexName;
  process.env.MEILISEARCH_DB_PATH = dbPath;
  logger.info('Local Meilisearch is ready; environment configured in-process');
}

function randomKey(): string {
  // 64 hex chars using Node crypto
  return randomBytes(32).toString('hex');
}
