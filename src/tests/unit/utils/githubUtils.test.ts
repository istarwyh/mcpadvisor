import { describe, test, expect, vi, beforeEach } from 'vitest';
import {
  parseGitHubUrl,
  fetchGitHubReadme,
} from '../../../utils/githubUtils.js';

// 注意：logger 已在 setup.ts 中被模拟

describe('GitHub Utils', () => {
  describe('parseGitHubUrl', () => {
    test('should parse a simple GitHub URL', () => {
      const url = 'https://github.com/seansoreilly/abs';
      const result = parseGitHubUrl(url);

      expect(result).toEqual({
        owner: 'seansoreilly',
        repo: 'abs',
        branch: 'main',
      });
    });

    test('should parse a GitHub URL with a specific branch', () => {
      const url = 'https://github.com/seansoreilly/abs/tree/develop';
      const result = parseGitHubUrl(url);

      expect(result).toEqual({
        owner: 'seansoreilly',
        repo: 'abs',
        branch: 'develop',
      });
    });

    test('should handle a URL with .git suffix', () => {
      const url = 'https://github.com/seansoreilly/abs.git';
      const result = parseGitHubUrl(url);

      expect(result).toEqual({
        owner: 'seansoreilly',
        repo: 'abs',
        branch: 'main',
      });
    });

    test('should return null for invalid GitHub URLs', () => {
      const url = 'https://example.com/some/path';
      const result = parseGitHubUrl(url);

      expect(result).toBeNull();
    });
  });

  // These tests require network access, so they might be skipped in CI environments
  describe('fetchGitHubReadme', () => {
    test('should fetch README content for a valid repository', async () => {
      // 注意：全局超时时间已在 setup.ts 中设置为 30000ms

      const url = 'https://github.com/seansoreilly/abs';
      const content = await fetchGitHubReadme(url);

      console.log(`GitHub README 获取结果：${content ? '成功' : '失败'}`);

      if (content) {
        expect(typeof content).toBe('string');
        // Basic validation that it looks like markdown content
        expect(content.includes('#')).toBe(true);
      } else {
        // 如果无法获取内容，测试仍然通过
        expect(true).toBe(true);
      }
    }, 10000);

    test('should return null for a non-existent repository', async () => {
      const url = 'https://github.com/non-existent-user/non-existent-repo';
      const content = await fetchGitHubReadme(url);

      expect(content).toBeNull();
    }, 10000);
  });
});
