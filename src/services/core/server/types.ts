import { z } from 'zod';

export const GeneralArgumentsSchema = z
  .object({
    taskDescription: z.string().min(1).optional(),
    keywords: z.union([z.string().array(), z.string()]).optional().default([]),
    capabilities: z
      .union([z.string().array(), z.string()])
      .optional()
      .default([]),
    query: z.string().min(1).optional(),
    mcpName: z.string().min(1).optional(),
    sourceUrl: z.string().url().optional(),
    mcpClient: z.string().optional(),
  })
  .refine(
    data =>
      !!(
        data.taskDescription ||
        data.query ||
        (data.mcpName && data.sourceUrl)
      ),
    {
      message:
        'At least taskDescription/query or both mcpName and sourceUrl must be provided',
    },
  )
  .transform(data => {
    const transformed = { ...data };

    if (data.query && !data.taskDescription) {
      transformed.taskDescription = data.query;
    }

    if (transformed.keywords && !Array.isArray(transformed.keywords)) {
      transformed.keywords = [transformed.keywords].filter(Boolean);
    }

    if (transformed.capabilities && !Array.isArray(transformed.capabilities)) {
      transformed.capabilities = [transformed.capabilities].filter(Boolean);
    }

    return transformed;
  });

export const SourcesSchema = z.object({
  remote_urls: z.array(z.string()).optional(),
  local_files: z.array(z.string()).optional(),
  field_map: z.record(z.string(), z.array(z.string())).optional(),
});

export enum TransportType {
  STDIO = 'stdio',
  SSE = 'sse',
  REST = 'rest',
}

export interface TransportConfig {
  port: number;
  host?: string;
  ssePath?: string;
  messagePath?: string;
  endpoint?: string;
}

export interface ToolDefinition {
  name: string;
  inputSchema: {
    type: string;
    properties?: Record<string, unknown>;
    required?: string[];
  };
  description?: string;
  annotations?: {
    title?: string;
    readOnlyHint?: boolean;
    destructiveHint?: boolean;
    idempotentHint?: boolean;
    openWorldHint?: boolean;
    [key: string]: unknown;
  };
}
