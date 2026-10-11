import {
  Resource,
  ReadResourceResult,
} from '@modelcontextprotocol/sdk/types.js';
import { BaseResourceHandler } from './BaseResourceHandler.js';
import fs from 'fs/promises';
import path from 'path';
import { pathToFileURL, fileURLToPath } from 'url';
import logger from '../../../../utils/logger.js';

/**
 * MCP Resource handler for reading log files
 * Implements the BaseResourceHandler interface to provide log file access
 */
export class LogResourceHandler extends BaseResourceHandler {
  private logDirectories: string[];
  private supportedExtensions: string[] = ['.log', '.txt'];
  private resourceCache: { resources: Resource[]; lastUpdate: number } | null =
    null;
  private readonly CACHE_TTL_MS = parseInt(
    process.env.RESOURCE_CACHE_TTL || '30000',
  ); // 30 seconds default

  constructor() {
    super();
    this.logDirectories = this.getLogDirectories();
    logger.info('LogResourceHandler initialized', 'LogResourceHandler', {
      directories: this.logDirectories,
      extensions: this.supportedExtensions,
      cacheTtl: this.CACHE_TTL_MS,
    });
  }

  /**
   * Get configured log directories from environment variables
   */
  private getLogDirectories(): string[] {
    const logDir = process.env.LOG_DIR || process.env.LOGS_DIR;

    if (!logDir) {
      // Default log directories
      const defaultDirs = [
        path.join(process.cwd(), 'logs'),
        '/var/log',
        '/tmp',
      ];
      logger.info(
        'No LOG_DIR configured, using defaults',
        'LogResourceHandler',
        { defaultDirs },
      );
      return defaultDirs;
    }

    // Support multiple directories separated by colon
    const directories = logDir.split(':').filter(Boolean);
    logger.info('Using configured log directories', 'LogResourceHandler', {
      directories,
    });
    return directories;
  }

  /**
   * List all available log files as resources with caching
   */
  async listResources(): Promise<Resource[]> {
    // Check if we have a valid cache
    if (
      this.resourceCache &&
      Date.now() - this.resourceCache.lastUpdate < this.CACHE_TTL_MS
    ) {
      logger.debug('Returning cached resources', 'LogResourceHandler', {
        count: this.resourceCache.resources.length,
      });
      return this.resourceCache.resources;
    }

    // Cache is invalid or doesn't exist, scan directories
    logger.debug(
      'Cache expired or invalid, scanning directories',
      'LogResourceHandler',
    );
    const resources: Resource[] = [];

    for (const directory of this.logDirectories) {
      try {
        await this.addResourcesFromDirectory(directory, resources);
      } catch (error) {
        logger.warn(
          `Failed to read log directory: ${directory}`,
          'LogResourceHandler',
          { error },
        );
        // Continue with other directories
      }
    }

    // Update cache
    this.resourceCache = {
      resources,
      lastUpdate: Date.now(),
    };

    logger.info(
      `Found ${resources.length} log resources`,
      'LogResourceHandler',
    );
    return resources;
  }

  /**
   * Add resources from a specific directory
   */
  private async addResourcesFromDirectory(
    directory: string,
    resources: Resource[],
  ): Promise<void> {
    try {
      const files = await fs.readdir(directory);

      for (const file of files) {
        const filePath = path.join(directory, file);

        try {
          const stat = await fs.stat(filePath);

          if (stat.isFile() && this.isSupportedFile(file)) {
            const resource = this.createResourceFromFile(directory, file);
            resources.push(resource);
          }
        } catch (error) {
          logger.debug(
            `Failed to stat file: ${filePath}`,
            'LogResourceHandler',
            { error },
          );
          // Continue with other files
        }
      }
    } catch (error) {
      logger.warn(
        `Cannot access directory: ${directory}`,
        'LogResourceHandler',
        { error },
      );
      throw error; // Re-throw to be caught by caller
    }
  }

  /**
   * Check if a file is supported based on its extension
   */
  private isSupportedFile(filename: string): boolean {
    const ext = path.extname(filename).toLowerCase();
    return this.supportedExtensions.includes(ext);
  }

  /**
   * Create a Resource object from a file
   */
  private createResourceFromFile(
    directory: string,
    filename: string,
  ): Resource {
    const filePath = path.join(directory, filename);
    const uri = this.createFileUri(filePath);

    return {
      uri,
      name: `Log: ${filename}`,
      description: `Log file from ${directory}`,
      mimeType: 'text/plain',
    };
  }

  /**
   * Create a file URI from a file path using Node.js URL utilities
   */
  private createFileUri(filePath: string): string {
    // Use Node.js built-in pathToFileURL for proper cross-platform URI generation
    const absolutePath = path.resolve(filePath);
    return pathToFileURL(absolutePath).href;
  }

  /**
   * Read the content of a resource by URI
   */
  async readResource(uri: string): Promise<ReadResourceResult> {
    logger.info(`Reading resource: ${uri}`, 'LogResourceHandler');

    // Validate and parse URI
    const filePath = this.parseFileUri(uri);

    // Security check - ensure file is within allowed directories
    await this.validateFilePath(filePath);

    try {
      // Check file size before reading
      const stat = await fs.stat(filePath);
      const maxSize = parseInt(process.env.MAX_LOG_SIZE || '10485760'); // 10MB default

      if (stat.size > maxSize) {
        throw new Error(
          `File too large: ${stat.size} bytes exceeds limit of ${maxSize} bytes`,
        );
      }

      const content = await fs.readFile(filePath, 'utf-8');

      logger.info(`Successfully read resource: ${uri}`, 'LogResourceHandler', {
        size: content.length,
      });

      return {
        contents: [
          {
            uri,
            mimeType: 'text/plain',
            text: content,
          },
        ],
      };
    } catch (error) {
      const errorCode = (error as any).code;
      const errorMessage = (error as Error).message;

      if (
        errorCode === 'ENOENT' ||
        errorMessage.includes('ENOENT') ||
        errorMessage.includes('no such file')
      ) {
        const notFoundError = new Error('File not found');
        logger.error('File not found', 'LogResourceHandler', {
          error: notFoundError,
          uri,
        });
        throw notFoundError;
      } else if (
        errorCode === 'EACCES' ||
        errorMessage.includes('EACCES') ||
        errorMessage.includes('permission denied')
      ) {
        const permissionError = new Error('Permission denied');
        logger.error('Permission denied', 'LogResourceHandler', {
          error: permissionError,
          uri,
        });
        throw permissionError;
      } else {
        logger.error('Failed to read file', 'LogResourceHandler', {
          error,
          uri,
        });
        throw error;
      }
    }
  }

  /**
   * Parse a file URI to get the local file path using Node.js URL utilities
   */
  private parseFileUri(uri: string): string {
    try {
      // Use Node.js built-in fileURLToPath for proper cross-platform URI parsing
      return fileURLToPath(uri);
    } catch (error) {
      throw new Error(`Invalid file URI format: ${uri}`);
    }
  }

  /**
   * Validate that the file path is within allowed directories
   * Uses fs.realpath to resolve symlinks and prevent directory traversal attacks
   */
  private async validateFilePath(filePath: string): Promise<void> {
    try {
      // Resolve the real path to handle symlinks and normalize the path
      const realPath = await fs.realpath(filePath);

      // Check if the real path is within any of the allowed log directories
      const isInAllowedDirectory = await Promise.all(
        this.logDirectories.map(async dir => {
          try {
            const realDir = await fs.realpath(dir);
            return (
              realPath.startsWith(realDir + path.sep) || realPath === realDir
            );
          } catch {
            // If directory doesn't exist or can't be resolved, it's not allowed
            return false;
          }
        }),
      ).then(results => results.some(Boolean));

      if (!isInAllowedDirectory) {
        throw new Error(
          `Invalid file path: ${filePath} is not within allowed log directories`,
        );
      }
    } catch (error) {
      if ((error as any).code === 'ENOENT') {
        throw new Error(`File not found: ${filePath}`);
      }
      throw error;
    }
  }

  /**
   * Check if this handler supports a given URI
   */
  async supportsUri(uri: string): Promise<boolean> {
    try {
      const filePath = this.parseFileUri(uri);
      await this.validateFilePath(filePath);

      const filename = path.basename(filePath);
      return this.isSupportedFile(filename);
    } catch {
      return false;
    }
  }

  /**
   * Invalidate the resource cache to force a fresh scan on next request
   */
  public invalidateCache(): void {
    this.resourceCache = null;
    logger.debug('Resource cache invalidated', 'LogResourceHandler');
  }
}
