import { CallToolRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { SearchService } from '../../../searchService.js';
import { formatServersToMCPContent } from '../../../../utils/formatter.js';
import { BaseToolHandler } from './BaseToolHandler.js';
import { GeneralArgumentsSchema } from '../types.js';
import logger from '../../../../utils/logger.js';

export class RecommendMcpServerToolHandler extends BaseToolHandler {
  constructor(private searchService: SearchService) {
    super();
  }

  getToolDefinition() {
    return {
      name: 'recommend-mcp-servers',
      description: `
        Find suitable MCP servers for a specific task.
        Search configured online catalogs and local server data for relevant solutions.
        Results include names, descriptions, source URLs and available category metadata.
      `,
      inputSchema: {
        type: 'object',
        properties: {
          taskDescription: {
            type: 'string',
            description: `
              Describe the exact task the MCP server should perform.
              
              Useful examples:
              - 'Deploy a risk-control strategy'
              - 'Calculate actuarial pricing for an insurance product'
              
              Overly broad examples:
              - 'Insurance MCP server'(too broad)
              - 'Risk-control system'(missing the specific use case)
              - 'Actuarial tool'(missing the required capability)
              
              Specify:
              1. The workflow, such as pricing, underwriting, claims or reserve calculation
              2. Required capabilities, such as risk analysis, strategy deployment or feature development
            `,
          },
          keywords: {
            type: 'array',
            items: { type: 'string' },
            description:
              'Optional search keywords used alongside the task description.',
            default: [],
          },
          capabilities: {
            type: 'array',
            items: { type: 'string' },
            description:
              'Optional required capabilities used alongside the task description.',
            default: [],
          },
        },
        required: ['taskDescription'],
      },
    };
  }

  canHandle(name: string): boolean {
    return name === 'recommend-mcp-servers';
  }

  async handleRequest(request: typeof CallToolRequestSchema._type) {
    try {
      const { arguments: args } = request.params;
      const parsedArgs = GeneralArgumentsSchema.parse(args);
      const { taskDescription, keywords = [], capabilities = [] } = parsedArgs;

      if (!taskDescription) {
        return this.createErrorResponse(
          'taskDescription parameter is required for recommend-mcp-servers tool',
        );
      }

      logger.info('Processing recommend-mcp-servers request', 'Search', {
        taskDescription,
        keywords,
        capabilities,
      });

      const searchParams = {
        taskDescription,
        keywords: Array.isArray(keywords)
          ? keywords
          : [keywords].filter(Boolean),
        capabilities: Array.isArray(capabilities)
          ? capabilities
          : [capabilities].filter(Boolean),
      };

      const servers = await this.searchService.search(searchParams);
      logger.debug('Found servers matching query', 'Search', {
        count: servers.length,
        taskDescription,
      });

      return this.createSuccessResponse(formatServersToMCPContent(servers));
    } catch (error) {
      logger.error(
        `Error in RecommendMcpServerToolHandler: ${error instanceof Error ? error.message : String(error)}`,
      );
      return this.createErrorResponse(
        'Failed to process recommendation request',
      );
    }
  }
}
