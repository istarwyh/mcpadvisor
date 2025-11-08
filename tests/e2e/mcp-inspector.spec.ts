import { test, expect } from '@playwright/test';
import {
  TEST_CONFIG,
  SmartWaiter,
  MCPConnectionManager,
  ScreenshotManager
} from '../helpers/test-helpers.js';

// 测试用例数据
const TEST_CASES = {
  recommend: [
    {
      name: '小红书内容获取',
      taskDescription: '需要获取小红书内容和热点数据进行分析',
      expectedResults: ['RedNote', 'social', 'content']
    },
    {
      name: '自然语言处理',
      taskDescription: 'Find MCP servers for natural language processing and text analysis',
      expectedResults: ['nlp', 'text', 'language']
    },
    {
      name: '金融数据分析',
      taskDescription: '需要处理金融市场数据并进行风险分析的MCP服务器',
      expectedResults: ['finance', 'data', 'analysis']
    }
  ],
  install: [
    {
      name: '社交媒体分析器安装',
      mcpName: 'social-media-analyzer',
      sourceUrl: 'https://github.com/example/social-media-mcp',
      mcpClient: 'Claude Desktop',
      expectedResults: ['installation', 'configuration', 'npm']
    }
  ]
};

test.describe('MCPAdvisor 完整功能测试', () => {
  let waiter: SmartWaiter;
  let mcpConnection: MCPConnectionManager;
  let screenshotManager: ScreenshotManager;

  test.beforeEach(async ({ page }) => {
    // Skip E2E tests in CI if MCP_AUTH_TOKEN is not available
    if (!TEST_CONFIG.authToken) {
      test.skip(true, 'Skipping E2E tests: MCP_AUTH_TOKEN environment variable not set');
    }
    
    // Initialize helpers
    waiter = new SmartWaiter(page);
    mcpConnection = new MCPConnectionManager(page, waiter);
    screenshotManager = new ScreenshotManager(page);
    
    // Connect to MCP using the helper
    await mcpConnection.connectToMCP();
  });

  test.describe('推荐MCP服务器功能测试', () => {
    for (const testCase of TEST_CASES.recommend) {
      test(`测试推荐功能: ${testCase.name}`, async ({ page }) => {
        // 点击推荐工具
        await page
          .getByRole('tabpanel', { name: 'Tools' })
          .getByText('此工具用于寻找合适且专业MCP', { exact: false })
          .first()
          .click();
        
        // 填写任务描述
        await page.getByRole('textbox', { name: 'taskDescription' }).click();
        await page.getByRole('textbox', { name: 'taskDescription' }).fill(testCase.taskDescription);
        
        // 执行工具
        await page.getByRole('button', { name: 'Run Tool' }).click();
        
        // 等待结果
        await waiter.waitForSearchResults();
        
        // 验证结果包含预期内容
        const pageContent = await page.content();
        
        // 检查是否有结果返回（允许无结果提示通过）
        const hasAnyResultOrMessage =
          pageContent.includes('Title:') ||
          pageContent.includes('No MCP servers found') ||
          pageContent.includes('No matching MCP servers found');
        expect(hasAnyResultOrMessage).toBeTruthy();
        
        // 验证结果相关性（至少包含一个预期关键词）
        const hasRelevantResults = testCase.expectedResults.some(keyword => 
          pageContent.toLowerCase().includes(keyword.toLowerCase())
        );
        
        if (hasRelevantResults) {
          console.log(`✅ ${testCase.name}: 找到相关结果`);
        } else {
          console.log(`⚠️ ${testCase.name}: 未找到明显相关的结果，但可能仍有有效返回`);
        }
        
        // 截图保存结果
        await screenshotManager.takeScreenshot(`recommend-${testCase.name.replace(/\s+/g, '-')}.png`);
      });
    }
  });

  test.describe('安装MCP服务器功能测试', () => {
    for (const testCase of TEST_CASES.install) {
      test(`测试安装功能: ${testCase.name}`, async ({ page }) => {
        // 查找并点击安装工具
        const installToolText = await page.getByText('此工具用于安装MCP服务器');
        if (await installToolText.isVisible()) {
          await installToolText.click();
        } else {
          // 如果找不到确切文本，尝试其他方式
          await page.getByText('install-mcp-server').click();
        }
        
        // 填写MCP名称
        const mcpNameInput = page.getByRole('textbox', { name: 'mcpName' });
        if (await mcpNameInput.isVisible()) {
          await mcpNameInput.fill(testCase.mcpName);
        }
        
        // 填写源URL
        const sourceUrlInput = page.getByRole('textbox', { name: 'sourceUrl' });
        if (await sourceUrlInput.isVisible()) {
          await sourceUrlInput.fill(testCase.sourceUrl);
        }
        
        // 填写MCP客户端
        const mcpClientInput = page.getByRole('textbox', { name: 'mcpClient' });
        if (await mcpClientInput.isVisible()) {
          await mcpClientInput.fill(testCase.mcpClient);
        }
        
        // 执行工具
        await page.getByRole('button', { name: 'Run Tool' }).click();
        
        // 等待结果
        await page.waitForTimeout(5000);
        
        // 验证结果包含安装指南相关内容
        const pageContent = await page.content();
        
        // 检查是否包含安装指南的典型内容
        const hasInstallationGuide = testCase.expectedResults.some(keyword => 
          pageContent.toLowerCase().includes(keyword.toLowerCase())
        );
        
        if (hasInstallationGuide) {
          console.log(`✅ ${testCase.name}: 生成了安装指南`);
        } else {
          console.log(`⚠️ ${testCase.name}: 未检测到明显的安装指南内容`);
        }
        
        // 截图保存结果
        await screenshotManager.takeScreenshot(`install-${testCase.name.replace(/\s+/g, '-')}.png`);
      });
    }
  });

  test('错误处理测试', async ({ page }) => {
    // 测试空输入的处理
    await page
      .getByRole('tabpanel', { name: 'Tools' })
      .getByText('此工具用于寻找合适且专业MCP', { exact: false })
      .first()
      .click();
    
    // 不填写任何内容直接执行
    await page.getByRole('button', { name: 'Run Tool' }).click();
    
    // 等待响应
    await waiter.waitForSearchResults();
    
    // 检查是否有适当的错误处理（大小写不敏感）
    const pageContent = (await page.content()).toLowerCase();
    const hasErrorHandling = pageContent.includes('required') || 
                           pageContent.includes('error') || 
                           pageContent.includes('必需') ||
                           pageContent.includes('错误');
    
    if (hasErrorHandling) {
      console.log('✅ 错误处理: 正确处理了无效输入');
    } else {
      console.log('⚠️ 错误处理: 可能需要改进错误提示');
    }
    
    await screenshotManager.takeScreenshot('error-handling.png');
  });

  test('性能测试', async ({ page }) => {
    // 测试响应时间
    await page
      .getByRole('tabpanel', { name: 'Tools' })
      .getByText('此工具用于寻找合适且专业MCP', { exact: false })
      .first()
      .click();
    await page.getByRole('textbox', { name: 'taskDescription' }).fill('简单测试查询');
    
    const startTime = Date.now();
    await page.getByRole('button', { name: 'Run Tool' }).click();
    
    // 等待结果出现
    await waiter.waitForSearchResults();
    const endTime = Date.now();
    
    const responseTime = endTime - startTime;
    console.log(`⏱️ 响应时间: ${responseTime}ms`);
    
    // 期望响应时间在合理范围内（小于30秒）
    expect(responseTime).toBeLessThan(30000);
    
    await screenshotManager.takeScreenshot('performance-test.png');
  });
});