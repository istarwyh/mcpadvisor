import {
  McpServer,
  fromJsonSchema,
  ResourceNotFoundError,
  type McpServerFactory,
} from '@modelcontextprotocol/server';
import { SERVER_NAME, SERVER_VERSION } from '../../../../config/constants.js';
import type { SearchService } from '../../../searchService.js';
import { RecommendMcpServerToolHandler } from '../tools/RecommendMcpServerToolHandler.js';
import { InstallMcpServerToolHandler } from '../tools/InstallMcpServerToolHandler.js';
import { LogResourceHandler } from '../resources/LogResourceHandler.js';
import type { BaseResourceHandler } from '../resources/BaseResourceHandler.js';

export const MCP_PROTOCOL_VERSION = '2026-07-28';

/** Share business services and caches, never a connected protocol server. */
export function createMcpServerFactory(
  searchService: SearchService,
  resourceHandlers: BaseResourceHandler[] = [new LogResourceHandler()],
): McpServerFactory {
  const tools = [
    new RecommendMcpServerToolHandler(searchService),
    new InstallMcpServerToolHandler(),
  ];

  return () => {
    const server = new McpServer(
      { name: SERVER_NAME, version: SERVER_VERSION },
      {
        supportedProtocolVersions: [MCP_PROTOCOL_VERSION],
        capabilities: { tools: {}, resources: {} },
        // Keep the SDK's conservative ttlMs: 0 / cacheScope: private defaults.
        // In particular, logs must never enter a shared cache.
      },
    );
    for (const handler of tools) {
      const definition = handler.getToolDefinition();
      server.registerTool(
        definition.name,
        {
          description: definition.description,
          inputSchema: fromJsonSchema<Record<string, unknown>>(
            definition.inputSchema,
          ),
        },
        async args =>
          handler.handleRequest({
            method: 'tools/call',
            params: { name: definition.name, arguments: args },
          }),
      );
    }
    server.server.setRequestHandler('resources/list', async () => ({
      resources: (
        await Promise.all(
          resourceHandlers.map(handler => handler.listResources()),
        )
      ).flat(),
    }));
    server.server.setRequestHandler('resources/templates/list', async () => ({
      resourceTemplates: [],
    }));
    server.server.setRequestHandler('resources/read', async request => {
      for (const handler of resourceHandlers) {
        if (await handler.supportsUri(request.params.uri)) {
          return handler.readResource(request.params.uri);
        }
      }
      throw new ResourceNotFoundError(request.params.uri);
    });
    // Catalog and file changes are currently read on demand; do not advertise
    // change notifications or cross-instance subscriptions we do not publish.
    server.server.registerCapabilities({
      tools: { listChanged: false },
      resources: { listChanged: false },
    });
    return server;
  };
}
