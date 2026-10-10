import { CallToolRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { InstallationGuideService } from '../../installation/installationGuideService.js';
import { ConfigurationGuideService } from '../../installation/configurationGuideService.js';
import { BaseToolHandler } from './BaseToolHandler.js';
import { GeneralArgumentsSchema } from '../types.js';
import logger from '../../../../utils/logger.js';

export class InstallMcpServerToolHandler extends BaseToolHandler {
  private installationGuideService: InstallationGuideService;
  private configurationGuideService: ConfigurationGuideService;

  constructor() {
    super();
    this.installationGuideService = new InstallationGuideService();
    this.configurationGuideService = new ConfigurationGuideService();
  }

  getToolDefinition() {
    return {
      name: 'install-mcp-server',
      description: `
        Get installation and configuration guidance for an MCP server.
        Provide the MCP server name and source URL, such as its GitHub repository,
        and receive installation instructions for your selected MCP client.
      `,
      inputSchema: {
        type: 'object',
        properties: {
          mcpName: {
            type: 'string',
            description: `Name of the MCP server to install.`,
          },
          sourceUrl: {
            type: 'string',
            description: `Source URL of the MCP server, such as its GitHub repository.`,
          },
          mcpClient: {
            type: 'string',
            description: `Optional MCP client, such as Claude Desktop, Windsurf, Cursor or Cline. Configuration varies by client.`,
          },
        },
        required: ['mcpName', 'sourceUrl'],
      },
    };
  }

  canHandle(name: string): boolean {
    return name === 'install-mcp-server';
  }

  async handleRequest(request: typeof CallToolRequestSchema._type) {
    try {
      const { arguments: args } = request.params;
      const parsedArgs = GeneralArgumentsSchema.parse(args);
      const mcpName = parsedArgs.mcpName;
      const sourceUrl = parsedArgs.sourceUrl;
      const mcpClient = parsedArgs.mcpClient || '';

      if (!mcpName || !sourceUrl) {
        return this.createErrorResponse(
          'Both mcpName and Url parameters are required for install-mcp-server tool',
        );
      }

      logger.info('Processing install-mcp-server request', 'Installation', {
        mcpName,
        sourceUrl,
        mcpClient,
      });
      const installationGuide =
        await this.installationGuideService.generateInstallationGuide(
          sourceUrl,
          mcpName,
        );

      // Generate client-specific configuration guide
      const configGuide =
        this.configurationGuideService.generateConfigurationGuide(
          mcpName,
          mcpClient,
        );

      // Combine installation guide and configuration guide
      const completeGuide = `${installationGuide}\n\n${configGuide}`;

      return this.createSuccessResponse(completeGuide);
    } catch (error) {
      logger.error(
        `Error in InstallMcpServerToolHandler: ${error instanceof Error ? error.message : String(error)}`,
      );
      return this.createErrorResponse('Failed to process installation request');
    }
  }
}
