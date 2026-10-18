import express, { type Application } from 'express';
import type { Server as HttpServer } from 'node:http';
import {
  createMcpHandler,
  type McpHttpHandler,
  type McpServerFactory,
} from '@modelcontextprotocol/server';
import {
  hostHeaderValidation,
  originValidation,
  toNodeHandler,
} from '@modelcontextprotocol/node';
import { SERVER_NAME, SERVER_VERSION } from '../../../../config/constants.js';
import { SourcesEndpoint } from '../endpoints/SourcesEndpoint.js';
import type { TransportConfig } from '../types.js';
import logger from '../../../../utils/logger.js';

const LOOPBACK_HOSTS = ['localhost', '127.0.0.1', '[::1]'];

/** The only remote MCP entry. SDK owns validation, codecs, streams and cleanup. */
export class StatelessHttpServer {
  private readonly app: Application;
  private readonly handler: McpHttpHandler;
  private listener?: HttpServer;

  constructor(
    factory: McpServerFactory,
    private readonly config: TransportConfig,
  ) {
    this.handler = createMcpHandler(factory, {
      legacy: 'reject',
      responseMode: config.responseMode ?? 'auto',
      onerror: error => logger.error('MCP request failed', { error }),
    });
    this.app = express();
    this.app.disable('x-powered-by');
    const validateHost = hostHeaderValidation(
      config.allowedHostnames ?? LOOPBACK_HOSTS,
    );
    const validateOrigin = originValidation(
      config.allowedOriginHostnames ?? LOOPBACK_HOSTS,
    );
    this.app.use((req, res, next) => {
      if (validateHost(req, res) && validateOrigin(req, res)) next();
    });
    const mcp = toNodeHandler(this.handler, {
      onerror: error => logger.error('MCP HTTP adapter failed', { error }),
    });
    // No global body parser: the SDK bounds and parses /mcp itself.
    this.app.all('/mcp', (req, res, next) => {
      mcp(req, res).catch(next);
    });
    this.app.get('/health', (_req, res) => {
      res.json({ status: 'ok', server: SERVER_NAME, version: SERVER_VERSION });
    });
    this.app.post(
      '/api/sources',
      express.json({ limit: '1mb' }),
      (req, res, next) => {
        SourcesEndpoint.handleRequest(req, res).catch(next);
      },
    );
    // Retirement notices contain no legacy transport or protocol implementation.
    this.app.all(['/sse', '/messages', '/rest'], (_req, res) => {
      res.status(410).json({
        error: 'Legacy SSE/REST transport is retired.',
        endpoint: '/mcp',
        protocolVersion: '2026-07-28',
        migration:
          'Use --mode=http with a 2026-07-28 MCP client, or modern stdio.',
      });
    });
  }

  getApp(): Application {
    return this.app;
  }

  async start(): Promise<void> {
    if (this.listener) throw new Error('HTTP server already started');
    await new Promise<void>((resolve, reject) => {
      this.listener = this.app.listen(
        this.config.port,
        this.config.host ?? '127.0.0.1',
        error => (error ? reject(error) : resolve()),
      );
      this.listener.once('error', reject);
    });
  }

  async close(): Promise<void> {
    await this.handler.close();
    const listener = this.listener;
    this.listener = undefined;
    if (listener?.listening) {
      await new Promise<void>((resolve, reject) =>
        listener.close(error => (error ? reject(error) : resolve())),
      );
    }
  }
}
