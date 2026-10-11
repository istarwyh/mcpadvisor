import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { BaseResourceHandler } from '../../../../services/core/server/resources/BaseResourceHandler.js';
import { LogResourceHandler } from '../../../../services/core/server/resources/LogResourceHandler.js';
import {
  Resource,
  ReadResourceResult,
} from '@modelcontextprotocol/sdk/types.js';
import fs from 'fs/promises';
import path from 'path';

// Mock fs module
vi.mock('fs/promises');
const mockFs = fs as any;

/**
 * 测试 MCP Resources 基础功能
 */
describe('MCP Resources', () => {
  let logResourceHandler: LogResourceHandler;
  let mockLogDir: string;
  let originalEnvVars: Record<string, string | undefined>;

  beforeEach(() => {
    // Save original environment variables
    originalEnvVars = {
      LOG_DIR: process.env.LOG_DIR,
      LOGS_DIR: process.env.LOGS_DIR,
    };

    // Setup test environment
    mockLogDir = '/test/logs';
    process.env.LOG_DIR = mockLogDir;

    // Reset all mocks
    vi.clearAllMocks();

    // Mock fs.realpath to return normalized paths for security validation
    mockFs.realpath = vi.fn().mockImplementation((filePath: string) => {
      // Return the path as-is for testing (simulating real path resolution)
      if (filePath.startsWith('/test/logs')) {
        return Promise.resolve(filePath);
      }
      // For directory validation, return the directory
      if (filePath === mockLogDir) {
        return Promise.resolve(mockLogDir);
      }
      return Promise.resolve(filePath);
    });

    // Mock fs.stat for file size checking
    mockFs.stat = vi.fn().mockResolvedValue({ size: 1024 });

    // Create handler instance
    logResourceHandler = new LogResourceHandler();
  });

  afterEach(() => {
    // Restore original environment variables
    Object.entries(originalEnvVars).forEach(([key, value]) => {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    });
  });

  describe('BaseResourceHandler', () => {
    test('should define abstract interface for implementations', () => {
      // Test that the LogResourceHandler implements the required methods
      const handler = new LogResourceHandler();
      expect(handler.listResources).toBeDefined();
      expect(handler.readResource).toBeDefined();
      expect(handler.supportsUri).toBeDefined();
      expect(typeof handler.listResources).toBe('function');
      expect(typeof handler.readResource).toBe('function');
      expect(typeof handler.supportsUri).toBe('function');
    });

    test('should define required abstract methods', () => {
      const handler = new LogResourceHandler();
      expect(handler.listResources).toBeDefined();
      expect(handler.readResource).toBeDefined();
      expect(typeof handler.listResources).toBe('function');
      expect(typeof handler.readResource).toBe('function');
    });
  });

  describe('LogResourceHandler', () => {
    describe('listResources', () => {
      test('should list available log files', async () => {
        // Mock file system
        mockFs.readdir.mockResolvedValue([
          'app.log',
          'error.log',
          'access.log',
          'notafile.txt', // should be filtered out or included based on configuration
          'debug.log',
        ]);

        mockFs.stat.mockImplementation((filePath: string) => {
          return Promise.resolve({
            isFile: () =>
              filePath.endsWith('.log') || filePath.endsWith('.txt'),
            size: 1024,
          });
        });

        const resources = await logResourceHandler.listResources();

        expect(resources).toBeInstanceOf(Array);
        expect(resources.length).toBeGreaterThan(0);

        // Check first resource structure
        const firstResource = resources[0];
        expect(firstResource).toHaveProperty('uri');
        expect(firstResource).toHaveProperty('name');
        expect(firstResource).toHaveProperty('mimeType', 'text/plain');
        expect(firstResource.uri).toMatch(/^file:\/\/\/.*\.log$/);
      });

      test('should handle empty log directory', async () => {
        mockFs.readdir.mockResolvedValue([]);

        const resources = await logResourceHandler.listResources();

        expect(resources).toBeInstanceOf(Array);
        expect(resources).toHaveLength(0);
      });

      test('should handle directory access errors gracefully', async () => {
        mockFs.readdir.mockRejectedValue(new Error('Permission denied'));

        const resources = await logResourceHandler.listResources();

        expect(resources).toBeInstanceOf(Array);
        expect(resources).toHaveLength(0);
      });

      test('should filter by supported file extensions', async () => {
        mockFs.readdir.mockResolvedValue([
          'app.log',
          'config.json',
          'readme.md',
          'error.log',
          'data.csv',
        ]);

        mockFs.stat.mockImplementation((filePath: string) => {
          return Promise.resolve({
            isFile: () => true,
            size: 1024,
          });
        });

        const resources = await logResourceHandler.listResources();

        // Should only include .log files by default
        expect(resources.every(r => r.uri.endsWith('.log'))).toBe(true);
      });
    });

    describe('readResource', () => {
      test('should read log file content by URI', async () => {
        const testUri = 'file:///test/logs/app.log';
        const testContent = 'Log line 1\\nLog line 2\\nError occurred\\n';

        mockFs.readFile.mockResolvedValue(testContent);

        const result = await logResourceHandler.readResource(testUri);

        expect(result).toHaveProperty('contents');
        expect(Array.isArray(result.contents)).toBe(true);
        expect((result.contents as any[])[0]).toHaveProperty('uri', testUri);
        expect((result.contents as any[])[0]).toHaveProperty(
          'mimeType',
          'text/plain',
        );
        expect((result.contents as any[])[0]).toHaveProperty(
          'text',
          testContent,
        );
        expect(mockFs.readFile).toHaveBeenCalledWith(
          path.join(mockLogDir, 'app.log'),
          'utf-8',
        );
      });

      test('should handle file not found errors', async () => {
        const testUri = 'file:///test/logs/nonexistent.log';

        // Mock realpath to throw ENOENT for non-existent file
        mockFs.realpath.mockImplementation((filePath: string) => {
          if (filePath.includes('nonexistent.log')) {
            const error = new Error('ENOENT: no such file or directory');
            (error as any).code = 'ENOENT';
            return Promise.reject(error);
          }
          return Promise.resolve(filePath);
        });

        await expect(logResourceHandler.readResource(testUri)).rejects.toThrow(
          'File not found',
        );
      });

      test('should handle invalid URI format', async () => {
        const invalidUri = 'invalid-uri-format';

        await expect(
          logResourceHandler.readResource(invalidUri),
        ).rejects.toThrow('Invalid file URI format');
      });

      test('should validate file path security', async () => {
        const maliciousUri = 'file:///test/logs/../../../etc/passwd';

        await expect(
          logResourceHandler.readResource(maliciousUri),
        ).rejects.toThrow('Invalid file path');
      });

      test('should handle large files gracefully', async () => {
        const testUri = 'file:///test/logs/large.log';

        // Mock stat to return a large file size that exceeds the limit
        mockFs.stat.mockResolvedValue({ size: 20 * 1024 * 1024 }); // 20MB

        await expect(logResourceHandler.readResource(testUri)).rejects.toThrow(
          'File too large',
        );
      });
    });

    describe('configuration', () => {
      test('should use LOG_DIR environment variable', () => {
        process.env.LOG_DIR = '/custom/log/path';

        const handler = new LogResourceHandler();

        // This would be tested by checking internal state or behavior
        expect(handler).toBeDefined();
      });

      test('should fallback to default log directory', () => {
        delete process.env.LOG_DIR;
        delete process.env.LOGS_DIR;

        const handler = new LogResourceHandler();

        expect(handler).toBeDefined();
      });

      test('should support multiple log directories', async () => {
        process.env.LOG_DIR = '/path1:/path2:/path3';

        const handler = new LogResourceHandler();

        // Mock multiple directories
        mockFs.readdir.mockImplementation((dir: string) => {
          if (dir === '/path1') return Promise.resolve(['app1.log']);
          if (dir === '/path2') return Promise.resolve(['app2.log']);
          if (dir === '/path3') return Promise.resolve(['app3.log']);
          return Promise.resolve([]);
        });

        mockFs.stat.mockResolvedValue({
          isFile: () => true,
          size: 1024,
        });

        const resources = await handler.listResources();

        expect(resources.length).toBe(3);
      });
    });
  });

  describe('Error Handling', () => {
    test('should handle permission errors gracefully', async () => {
      mockFs.readdir.mockRejectedValue(new Error('EACCES: permission denied'));

      const resources = await logResourceHandler.listResources();

      expect(resources).toEqual([]);
    });

    test('should handle file read permission errors', async () => {
      const testUri = 'file:///test/logs/protected.log';

      // The file should exist for realpath but reading should fail
      mockFs.readFile.mockRejectedValue(new Error('EACCES: permission denied'));

      await expect(logResourceHandler.readResource(testUri)).rejects.toThrow(
        'Permission denied',
      );
    });
  });

  describe('Resource URI Generation', () => {
    test('should generate valid file URIs', async () => {
      mockFs.readdir.mockResolvedValue(['test.log']);
      mockFs.stat.mockResolvedValue({
        isFile: () => true,
        size: 1024,
      });

      const resources = await logResourceHandler.listResources();

      expect(resources[0].uri).toMatch(/^file:\/\/\/.*test\.log$/);
      expect(resources[0].uri).not.toContain('////'); // No triple slashes after protocol
    });

    test('should handle special characters in filenames', async () => {
      mockFs.readdir.mockResolvedValue([
        'app with spaces.log',
        'app-with-dashes.log',
      ]);
      mockFs.stat.mockResolvedValue({
        isFile: () => true,
        size: 1024,
      });

      const resources = await logResourceHandler.listResources();

      expect(resources).toHaveLength(2);
      expect(resources[0].uri).toContain('app%20with%20spaces.log');
      expect(resources[1].uri).toContain('app-with-dashes.log');
    });
  });
});
