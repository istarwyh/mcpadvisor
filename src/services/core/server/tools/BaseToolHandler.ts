import { CallToolRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { ToolDefinition } from '../types.js';

export abstract class BaseToolHandler {
  abstract getToolDefinition(): ToolDefinition;

  abstract canHandle(name: string): boolean;

  abstract handleRequest(request: typeof CallToolRequestSchema._type): Promise<{
    content: Array<{ type: string; [key: string]: unknown }>;
    isError: boolean;
  }>;

  protected createErrorResponse(message: string) {
    return {
      content: [
        {
          type: 'text',
          text: `Error: ${message}`,
        },
      ],
      isError: true,
    };
  }

  protected createSuccessResponse(
    content: string | Array<{ type: string; [key: string]: unknown }>,
  ) {
    return {
      content: Array.isArray(content)
        ? content
        : [
            {
              type: 'text',
              text: content,
            },
          ],
      isError: false,
    };
  }
}
