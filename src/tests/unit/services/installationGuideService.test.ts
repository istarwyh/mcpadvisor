import { describe, test, expect, vi } from 'vitest';
import { InstallationGuideService } from '../../../services/core/installation/installationGuideService.js';

/**
 * 测试 InstallationGuideService 的安装指南生成功能
 * 使用多个真实 GitHub 仓库验证提取和格式化功能
 */
describe('InstallationGuideService', () => {
  // 创建服务实例
  const installationGuideService = new InstallationGuideService();

  // 测试仓库列表
  const testRepos = [
    {
      name: 'sqlite-explorer-fastmcp-mcp-server',
      url: 'https://github.com/hannesrudolph/sqlite-explorer-fastmcp-mcp-server',
      description: 'SQLite Explorer MCP Server',
    },
    {
      name: 'abs',
      url: 'https://github.com/seansoreilly/abs',
      description: 'ABS Project',
    },
    {
      name: 'maven-mcp-server',
      url: 'https://github.com/Bigsy/maven-mcp-server',
      description: 'Maven MCP Server',
    },
    {
      name: 'chromia-mcp',
      url: 'https://github.com/chromindscan/chromia-mcp',
      description: 'Chromia MCP',
    },
  ];

  // 为每个仓库创建测试用例
  testRepos.forEach(repo => {
    test(`should generate installation guide for ${repo.name}`, async () => {
      // 注意：全局超时时间已在 setup.ts 中设置为 30000ms

      console.log(`Testing installation guide generation for ${repo.name}...`);

      // 生成安装指南
      const guide = await installationGuideService.generateInstallationGuide(
        repo.url,
        repo.name,
      );

      // 输出生成的指南，方便手动检查
      console.log(`\n--- Installation Guide for ${repo.name} ---`);
      console.log(`${guide.substring(0, 500)}...\n`); // 只显示前 500 个字符

      // 基本验证
      expect(guide).toBeTruthy();
      expect(typeof guide).toBe('string');
      expect(guide.length).toBeGreaterThan(100); // 指南应该有一定长度

      // 验证指南包含必要的部分
      expect(guide).toContain(repo.name);
      expect(guide).toContain(repo.url);

      // 验证指南格式
      expect(guide).toContain('Installation');

      // 验证指南包含有用的安装信息（而不是具体的中文文本）
      // 应该包含以下任一类型的安装相关内容：
      const hasInstallationContent =
        guide.includes('克隆仓库') || // 中文fallback scenario
        guide.includes('git clone') || // 英文git命令
        guide.includes('npm install') || // npm安装命令
        guide.includes('Installation') || // 英文安装标题
        guide.includes('Setup') || // 设置标题
        guide.includes('Getting Started') || // 开始使用
        guide.includes('配置') || // 中文配置
        guide.includes('Config'); // 英文配置

      expect(hasInstallationContent).toBe(true);

      console.log(`Test for ${repo.name} completed successfully.\n`);
    }, 30000); // 设置 30 秒超时
  });
});
