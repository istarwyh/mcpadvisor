#!/usr/bin/env node

/**
 * 简化的 MCP Inspector 测试脚本
 * 自动打开浏览器并在控制台显示测试参数供手动复制粘贴
 */

import { chromium } from 'playwright';

// 测试参数
const TEST_CASES = {
  "recommend-mcp-servers": [
    {
      name: "小红书热点分析",
      params: {
        taskDescription: "我想要看看小红书今天的热点问题，你再锐评一下",
        keywords: ["小红书", "热点", "social media"],
        capabilities: ["data analysis", "content processing"]
      }
    },
    {
      name: "自然语言处理", 
      params: {
        taskDescription: "Find MCP servers for natural language processing and text analysis",
        keywords: ["nlp", "text", "sentiment"],
        capabilities: ["sentiment analysis", "entity recognition", "text summarization"]
      }
    }
  ],
  "install-mcp-server": [
    {
      name: "社交媒体分析器",
      params: {
        mcpName: "social-media-analyzer",
        sourceUrl: "https://github.com/example/social-media-mcp",
        mcpClient: "Claude Desktop"
      }
    }
  ]
};

async function openBrowserAndShowTests() {
  const inspectorUrl = process.argv[2] || 'http://localhost:6274';
  const authToken = process.argv[3];
  
  let fullUrl = inspectorUrl;
  if (authToken) {
    const separator = fullUrl.includes('?') ? '&' : '?';
    fullUrl = `${fullUrl}${separator}MCP_PROXY_AUTH_TOKEN=${authToken}`;
  }

  console.log('🚀 启动 MCP Inspector 手动测试');
  console.log(`🌐 打开浏览器: ${fullUrl}\n`);

  const browser = await chromium.launch({ 
    headless: false,
    devtools: true
  });

  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 }
  });

  const page = await context.newPage();
  await page.goto(fullUrl);

  console.log('✅ 浏览器已打开，请手动进行以下测试：\n');

  // 显示测试用例
  for (const [toolName, testCases] of Object.entries(TEST_CASES)) {
    console.log(`🔧 工具: ${toolName}`);
    console.log('=' * 50);
    
    for (const testCase of testCases) {
      console.log(`\n📋 测试用例: ${testCase.name}`);
      console.log('参数 (请复制粘贴):');
      console.log(JSON.stringify(testCase.params, null, 2));
      console.log();
    }
  }

  console.log('\n🎯 测试步骤:');
  console.log('1. 在浏览器中选择工具 (recommend-mcp-servers 或 install-mcp-server)');
  console.log('2. 复制上面的参数JSON到参数输入框');
  console.log('3. 点击执行按钮');
  console.log('4. 观察返回结果');
  console.log('\n⏳ 浏览器将保持打开，按 Ctrl+C 退出...');

  // 保持浏览器打开
  process.on('SIGINT', async () => {
    console.log('\n👋 关闭浏览器...');
    await browser.close();
    process.exit(0);
  });

  // 防止脚本退出
  await new Promise(() => {});
}

openBrowserAndShowTests().catch(console.error);