import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { RestServerTransport } from '@chatmcp/sdk/server/rest.js';
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

import { SERVER_NAME, SERVER_VERSION } from '../../../config/constants.js';
import { SearchService } from '../../searchService.js';
import { TransportType, TransportConfig } from './types.js';
import { BaseToolHandler } from './tools/BaseToolHandler.js';
import { RecommendMcpServerToolHandler } from './tools/RecommendMcpServerToolHandler.js';
import { InstallMcpServerToolHandler } from './tools/InstallMcpServerToolHandler.js';
import { BaseResourceHandler } from './resources/BaseResourceHandler.js';
import { LogResourceHandler } from './resources/LogResourceHandler.js';
import express from 'express';
import { ExpressServer } from './transports/ExpressServer.js';
import { SourcesEndpoint } from './endpoints/SourcesEndpoint.js';
import { RequestHandlerFactory } from './handlers/RequestHandlerFactory.js';
import logger from '../../../utils/logger.js';
import type { Request, Response, NextFunction, RequestHandler } from 'express';

export class ServerService {
  private server: Server;
  private searchService: SearchService;
  private toolHandlers: BaseToolHandler[] = [];
  private resourceHandlers: BaseResourceHandler[] = [];
  private expressServer?: ExpressServer;

  constructor(searchService: SearchService) {
    if (!searchService) {
      throw new Error('SearchService is required');
    }

    this.searchService = searchService;

    try {
      this.server = this.initializeServer();
      this.initializeToolHandlers();
      this.initializeResourceHandlers();
      this.registerHandlers();
      logger.info('ServerService initialized successfully');
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unknown initialization error';
      logger.error(`Failed to initialize ServerService: ${message}`);
      throw error;
    }
  }

  private initializeServer(): Server {
    logger.info('Initializing ServerService', 'Server', {
      name: SERVER_NAME,
      version: SERVER_VERSION,
    });

    return new Server(
      { name: SERVER_NAME, version: SERVER_VERSION },
      { capabilities: { tools: {}, resources: {} } },
    );
  }

  private initializeToolHandlers(): void {
    this.toolHandlers = [
      new RecommendMcpServerToolHandler(this.searchService),
      new InstallMcpServerToolHandler(),
    ];
  }

  private initializeResourceHandlers(): void {
    this.resourceHandlers = [new LogResourceHandler()];
  }

  private registerHandlers(): void {
    try {
      // Register listTools handler
      this.server.setRequestHandler(
        ListToolsRequestSchema,
        RequestHandlerFactory.createListToolsHandler(this.toolHandlers),
      );

      // Register callTool handler
      this.server.setRequestHandler(
        CallToolRequestSchema,
        RequestHandlerFactory.createCallToolHandler(this.toolHandlers),
      );

      // Register listResources handler
      this.server.setRequestHandler(
        ListResourcesRequestSchema,
        RequestHandlerFactory.createListResourcesHandler(this.resourceHandlers),
      );

      // Register readResource handler
      this.server.setRequestHandler(
        ReadResourceRequestSchema,
        RequestHandlerFactory.createReadResourceHandler(this.resourceHandlers),
      );

      logger.debug('Successfully registered all request handlers');
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Unknown error during handler registration';
      logger.error(`Failed to register handlers: ${message}`);
      throw error; // Re-throw to prevent server from starting with invalid handlers
    }
  }

  private async setupExpressServer(
    config: TransportConfig,
  ): Promise<ExpressServer> {
    const { ssePath: path = '/sse', messagePath = '/messages' } = config;
    const expressServer = new ExpressServer();

    expressServer.setupSSEEndpoint(path, messagePath, async transport => {
      await this.server.connect(transport);
    });
    expressServer.setupMessageEndpoint(messagePath);
    expressServer.setupHealthCheck(SERVER_NAME, SERVER_VERSION);
    const app = expressServer.getApp();
    const sourcesHandler: RequestHandler = (
      req: Request,
      res: Response,
      next: NextFunction,
    ) => {
      SourcesEndpoint.handleRequest(req, res).catch(next);
    };
    app.post('/api/sources', express.json(), sourcesHandler);

    return expressServer;
  }

  async startWithStdio(): Promise<void> {
    logger.info('Starting server with stdio transport');
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    logger.info(`${SERVER_NAME} Server running on stdio`);
  }

  async startWithSSE(config: TransportConfig): Promise<void> {
    const { port, host = 'localhost' } = config;
    const baseUrl = `http://${host}:${port}`;
    const sseUrl = `${baseUrl}/sse`;
    const messagePath = config.messagePath || '/messages';
    const messagesUrl = `${baseUrl}${messagePath}`;

    logger.info('Starting server with SSE transport', { host, port });
    this.expressServer = await this.setupExpressServer(config);
    await this.expressServer.start(port, host);

    console.log(`\n${'='.repeat(70)}`);
    console.log(`🚀 Server is running on ${baseUrl}`);
    console.log(`🔌 SSE endpoint: ${sseUrl}`);
    console.log(`📨 Messages endpoint: ${messagesUrl}`);
    console.log(`${'='.repeat(70)}\n`);

    logger.info(`${SERVER_NAME} Server running on ${baseUrl}`);
  }

  /**
   * Start the server with REST transport
   */
  async startWithRest(config: TransportConfig): Promise<void> {
    logger.info('Starting server with REST transport');
    const transport = new RestServerTransport({
      port: config.port,
      endpoint: config.endpoint,
    });
    await this.server.connect(transport);
    await transport.startServer();
  }

  async start(
    transportType: TransportType = TransportType.STDIO,
    transportConfig?: TransportConfig,
  ): Promise<void> {
    try {
      switch (transportType) {
        case TransportType.SSE:
          if (!transportConfig) {
            throw new Error('SSE configuration required for SSE transport');
          }
          return this.startWithSSE(transportConfig);

        case TransportType.REST:
          if (!transportConfig) {
            throw new Error('Configuration required for REST transport');
          }
          return this.startWithRest(transportConfig);

        default:
          return this.startWithStdio();
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error(`Failed to start server: ${message}`);
      throw error;
    }
  }
}

export * from './types.js';
