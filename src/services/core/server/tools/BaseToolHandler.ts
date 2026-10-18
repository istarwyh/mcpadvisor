import type {
  CallToolRequest,
  CallToolResult,
  ContentBlock,
} from '@modelcontextprotocol/server';
import { ToolDefinition } from '../types.js';

export abstract class BaseToolHandler {
  abstract getToolDefinition(): ToolDefinition;

  abstract canHandle(name: string): boolean;

  abstract handleRequest(request: CallToolRequest): Promise<CallToolResult>;

  protected createErrorResponse(message: string): CallToolResult {
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
    content: string | ContentBlock[],
  ): CallToolResult {
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
