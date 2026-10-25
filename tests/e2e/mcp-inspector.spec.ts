import { test, expect } from '@playwright/test';
import { ModernInspector } from '../helpers/modern-inspector.js';

// These exercise the actual configured server, not mocked tool responses.
// Passing does not establish online-provider coverage or recommendation relevance.
test.describe('MCPAdvisor modern Inspector UI', () => {
  let inspector: ModernInspector;
  test.beforeEach(async ({ page }) => {
    inspector = new ModernInspector(page);
    await inspector.connect();
  });

  for (const [name, taskDescription] of [
    ['小红书内容获取', '需要获取小红书内容和热点数据进行分析'],
    [
      '自然语言处理',
      'Find MCP servers for natural language processing and text analysis',
    ],
    ['金融数据分析', '需要处理金融市场数据并进行风险分析的MCP服务器'],
  ]) {
    test(`推荐功能: ${name}`, async () => {
      const { message, text } = await inspector.call('recommend-mcp-servers', {
        taskDescription,
      });
      expect(message.error).toBeUndefined();
      expect(message.result?.resultType).toBe('complete');
      expect(message.result?.isError).toBe(false);
      expect(text).toMatch(
        /Title:|No MCP servers found|No matching MCP servers found/,
      );
    });
  }

  test('安装指南，不执行安装', async () => {
    const { message, text } = await inspector.call('install-mcp-server', {
      mcpName: 'social-media-analyzer',
      sourceUrl: 'https://github.com/example/social-media-mcp',
      mcpClient: 'Claude Desktop',
    });
    expect(message.error).toBeUndefined();
    expect(message.result?.resultType).toBe('complete');
    expect(message.result?.isError).toBe(false);
    expect(text).toContain('social-media-analyzer');
    expect(text).toContain('https://github.com/example/social-media-mcp');
    expect(text.toLowerCase()).toMatch(/installation|configuration|npm/);
  });

  test('空输入被UI阻止提交', async ({ page }) => {
    await page
      .getByRole('button', { name: 'recommend-mcp-servers', exact: true })
      .click();
    await expect(
      page.getByRole('textbox', { name: 'taskDescription', exact: true }),
    ).toHaveValue('');
    await expect(
      page.getByRole('button', { name: 'Execute Tool', exact: true }),
    ).toBeDisabled();
    await expect(page.getByText('Results', { exact: true })).toHaveCount(0);
    // The official UI does not send a request. This is not a server-error test.
  });

  test('响应时间小于30秒', async () => {
    const { message, text, elapsed } = await inspector.call(
      'recommend-mcp-servers',
      { taskDescription: '简单测试查询' },
    );
    expect(message.error).toBeUndefined();
    expect(message.result?.isError).toBe(false);
    expect(text).toMatch(
      /Title:|No MCP servers found|No matching MCP servers found/,
    );
    expect(elapsed).toBeLessThan(30000);
  });
});
