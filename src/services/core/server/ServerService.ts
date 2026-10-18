import {
  serveStdio,
  type StdioServerHandle,
} from '@modelcontextprotocol/server/stdio';
import type { McpServerFactory } from '@modelcontextprotocol/server';
import type { SearchService } from '../../searchService.js';
import { TransportType, type TransportConfig } from './types.js';
import { createMcpServerFactory } from './stateless/McpServerFactory.js';
import { StatelessHttpServer } from './stateless/StatelessHttpServer.js';
import logger from '../../../utils/logger.js';

/** Application lifecycle only; modern protocol and HTTP responsibilities are separate. */
export class ServerService {
  private readonly factory: McpServerFactory;
  private stdio?: StdioServerHandle;
  private http?: StatelessHttpServer;

  constructor(searchService: SearchService) {
    if (!searchService) throw new Error('SearchService is required');
    this.factory = createMcpServerFactory(searchService);
    logger.info('ServerService initialized successfully');
  }

  async startWithStdio(): Promise<void> {
    if (this.stdio || this.http) throw new Error('Server already started');
    this.stdio = serveStdio(this.factory, {
      legacy: 'reject',
      onerror: error => logger.error('MCP stdio request failed', { error }),
    });
    logger.info('MCP Advisor Server running on stdio (2026-07-28)');
  }

  async startWithHttp(config: TransportConfig): Promise<void> {
    if (this.stdio || this.http) throw new Error('Server already started');
    this.http = new StatelessHttpServer(this.factory, config);
    try {
      await this.http.start();
    } catch (error) {
      await this.http.close();
      this.http = undefined;
      throw error;
    }
  }

  async start(
    transportType: TransportType = TransportType.STDIO,
    transportConfig?: TransportConfig,
  ): Promise<void> {
    if (transportType === TransportType.STDIO) return this.startWithStdio();
    if (transportType === TransportType.HTTP && transportConfig) {
      return this.startWithHttp(transportConfig);
    }
    throw new Error(
      'Use stdio or http with an HTTP configuration. Legacy sse/rest are retired.',
    );
  }

  async close(): Promise<void> {
    await this.stdio?.close();
    await this.http?.close();
    this.stdio = undefined;
    this.http = undefined;
  }
}
