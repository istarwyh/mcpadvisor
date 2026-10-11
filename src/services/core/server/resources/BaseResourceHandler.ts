import {
  Resource,
  ReadResourceResult,
} from '@modelcontextprotocol/sdk/types.js';

/**
 * Abstract base class for MCP resource handlers
 * Defines the interface that all resource handlers must implement
 */
export abstract class BaseResourceHandler {
  /**
   * List all available resources
   * @returns Promise<Resource[]> Array of available resources
   */
  abstract listResources(): Promise<Resource[]>;

  /**
   * Read the content of a specific resource by URI
   * @param uri The resource URI to read
   * @returns Promise<ReadResourceResult> The resource content in MCP format
   */
  abstract readResource(uri: string): Promise<ReadResourceResult>;

  /**
   * Validate if a URI is supported by this handler
   * @param uri The URI to validate
   * @returns boolean|Promise<boolean> True if the URI is supported
   */
  abstract supportsUri(uri: string): boolean | Promise<boolean>;
}
