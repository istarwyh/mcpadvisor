#!/usr/bin/env node

/**
 * MCP Inspector 自动化测试脚本
 * 使用 Playwright 自动打开浏览器并测试 MCPAdvisor 功能
 */

import { chromium } from 'playwright';
import fs from 'fs';

// 测试配置
const CONFIG = {
  // Inspector URL (从命令行参数或环境变量获取)
  inspectorUrl: process.argv[2] || process.env.MCP_INSPECTOR_URL || 'http://localhost:6274',
  authToken: process.argv[3] || process.env.MCP_AUTH_TOKEN,
  
  // 测试用例
  testCases: {
    recommend: [
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
      },
      {
        name: "金融数据分析",
        params: {
          taskDescription: "需要处理金融市场数据并进行风险分析的MCP服务器",
          keywords: ["finance", "risk", "market"],
          capabilities: ["data processing", "risk assessment", "market analysis"]
        }
      }
    ],
    install: [
      {
        name: "社交媒体分析器",
        params: {
          mcpName: "social-media-analyzer",
          sourceUrl: "https://github.com/example/social-media-mcp",
          mcpClient: "Claude Desktop"
        }
      },
      {
        name: "NLP工具包",
        params: {
          mcpName: "nlp-toolkit",
          sourceUrl: "https://github.com/modelcontextprotocol/servers/tree/main/src/everything",
          mcpClient: "Cursor"
        }
      }
    ]
  },
  
  // 超时设置
  timeout: 30000,
  
  // 截图保存路径
  screenshotDir: './test-screenshots'
};

/**
 * 等待元素出现并返回
 */
async function waitForElement(page, selector, timeout = CONFIG.timeout) {
  try {
    return await page.waitForSelector(selector, { timeout });
  } catch (error) {
    console.error(`❌ 元素未找到: ${selector}`);
    throw error;
  }
}

/**
 * 填写JSON参数到输入框
 */
async function fillJsonInput(page, params) {
  const jsonString = JSON.stringify(params, null, 2);
  
  // 查找参数输入区域（可能是textarea或其他输入元素）
  const inputSelectors = [
    'textarea[placeholder*="parameters"]',
    'textarea[placeholder*="arguments"]', 
    'textarea[placeholder*="input"]',
    '.monaco-editor textarea', // Monaco编辑器
    'input[type="text"]',
    'textarea'
  ];
  
  let inputElement = null;
  for (const selector of inputSelectors) {
    try {
      inputElement = await page.$(selector);
      if (inputElement) {
        console.log(`📝 找到输入元素: ${selector}`);
        break;
      }
    } catch (e) {
      // 继续尝试下一个选择器
    }
  }
  
  if (!inputElement) {
    // 尝试通过标签文本查找
    const textareas = await page.$$('textarea');
    if (textareas.length > 0) {
      inputElement = textareas[textareas.length - 1]; // 使用最后一个textarea
      console.log(`📝 使用最后一个textarea元素`);
    }
  }
  
  if (inputElement) {
    await inputElement.fill(jsonString);
    console.log(`✅ 参数已填写: ${JSON.stringify(params)}`);
    return true;
  } else {
    console.error('❌ 未找到参数输入框');
    return false;
  }
}

/**
 * 执行工具调用
 */
async function executeTool(page, toolName, params, testName) {
  console.log(`\n🧪 开始测试: ${testName}`);
  console.log(`🔧 工具: ${toolName}`);
  
  try {
    // 查找并点击工具选择器
    const toolSelectors = [
      `button:has-text("${toolName}")`,
      `option:has-text("${toolName}")`,
      `[data-tool="${toolName}"]`,
      `select option[value="${toolName}"]`
    ];
    
    let toolSelected = false;
    for (const selector of toolSelectors) {
      try {
        const element = await page.$(selector);
        if (element) {
          await element.click();
          toolSelected = true;
          console.log(`✅ 工具已选择: ${toolName}`);
          break;
        }
      } catch (e) {
        // 继续尝试
      }
    }
    
    // 如果是下拉选择器
    if (!toolSelected) {
      try {
        await page.selectOption('select', toolName);
        toolSelected = true;
        console.log(`✅ 工具已选择 (下拉): ${toolName}`);
      } catch (e) {
        // 忽略
      }
    }
    
    if (!toolSelected) {
      console.warn(`⚠️ 无法自动选择工具，请手动选择: ${toolName}`);
    }
    
    // 等待一下让界面更新
    await page.waitForTimeout(1000);
    
    // 填写参数
    const paramsFilled = await fillJsonInput(page, params);
    if (!paramsFilled) {
      console.error(`❌ 参数填写失败: ${testName}`);
      return false;
    }
    
    // 查找并点击执行按钮
    const executeSelectors = [
      'button:has-text("Execute")',
      'button:has-text("Run")', 
      'button:has-text("Call")',
      'button:has-text("Submit")',
      'button[type="submit"]',
      'button.execute',
      'button.run'
    ];
    
    let executed = false;
    for (const selector of executeSelectors) {
      try {
        const button = await page.$(selector);
        if (button) {
          await button.click();
          executed = true;
          console.log(`✅ 执行按钮已点击`);
          break;
        }
      } catch (e) {
        // 继续尝试
      }
    }
    
    if (!executed) {
      console.warn(`⚠️ 无法找到执行按钮，请手动点击执行`);
    }
    
    // 等待结果
    console.log(`⏳ 等待执行结果...`);
    await page.waitForTimeout(5000);
    
    // 查找结果区域
    const resultSelectors = [
      '.result',
      '.output', 
      '.response',
      'pre',
      '[data-testid="result"]',
      '.json-output'
    ];
    
    let resultFound = false;
    for (const selector of resultSelectors) {
      try {
        const result = await page.$(selector);
        if (result) {
          const resultText = await result.textContent();
          if (resultText && resultText.trim().length > 0) {
            console.log(`✅ 结果已获取:`);
            console.log(`📋 ${resultText.substring(0, 200)}${resultText.length > 200 ? '...' : ''}`);
            resultFound = true;
            break;
          }
        }
      } catch (e) {
        // 继续尝试
      }
    }
    
    if (!resultFound) {
      console.warn(`⚠️ 未找到明显的结果显示区域`);
    }
    
    // 截图保存结果
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `${CONFIG.screenshotDir}/${toolName}-${testName.replace(/\s+/g, '-')}-${timestamp}.png`;
    await page.screenshot({ path: filename, fullPage: true });
    console.log(`📸 截图已保存: ${filename}`);
    
    return true;
    
  } catch (error) {
    console.error(`❌ 测试失败: ${testName}`);
    console.error(`错误: ${error.message}`);
    
    // 截图保存错误状态
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `${CONFIG.screenshotDir}/ERROR-${toolName}-${testName.replace(/\s+/g, '-')}-${timestamp}.png`;
    await page.screenshot({ path: filename, fullPage: true });
    console.log(`📸 错误截图已保存: ${filename}`);
    
    return false;
  }
}

/**
 * 主测试函数
 */
async function runTests() {
  console.log('🚀 启动 MCP Inspector 自动化测试\n');
  
  // 构建完整的URL
  let fullUrl = CONFIG.inspectorUrl;
  if (CONFIG.authToken) {
    const separator = fullUrl.includes('?') ? '&' : '?';
    fullUrl = `${fullUrl}${separator}MCP_PROXY_AUTH_TOKEN=${CONFIG.authToken}`;
  }
  
  console.log(`🌐 访问URL: ${fullUrl}`);
  
  const browser = await chromium.launch({ 
    headless: false,  // 显示浏览器界面
    slowMo: 1000,     // 慢速操作以便观察
    devtools: true    // 打开开发者工具
  });
  
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 }
  });
  
  const page = await context.newPage();
  
  try {
    // 创建截图目录
    if (!fs.existsSync(CONFIG.screenshotDir)) {
      fs.mkdirSync(CONFIG.screenshotDir, { recursive: true });
    }
    
    // 访问Inspector页面
    await page.goto(fullUrl);
    console.log('✅ 页面已加载');
    
    // 等待页面加载完成
    await page.waitForTimeout(3000);
    
    // 截图记录初始状态
    await page.screenshot({ path: `${CONFIG.screenshotDir}/initial-state.png`, fullPage: true });
    
    // 测试 recommend-mcp-servers 工具
    console.log('\n📊 测试推荐服务器功能...');
    for (const testCase of CONFIG.testCases.recommend) {
      await executeTool(page, 'recommend-mcp-servers', testCase.params, testCase.name);
      await page.waitForTimeout(2000); // 测试间隔
    }
    
    // 测试 install-mcp-server 工具  
    console.log('\n🔧 测试安装指南功能...');
    for (const testCase of CONFIG.testCases.install) {
      await executeTool(page, 'install-mcp-server', testCase.params, testCase.name);
      await page.waitForTimeout(2000); // 测试间隔
    }
    
    console.log('\n✅ 所有测试完成！');
    console.log(`📸 截图保存在: ${CONFIG.screenshotDir}`);
    
    // 保持浏览器打开以便手动检查
    console.log('\n⏳ 浏览器将保持打开状态，按 Ctrl+C 退出...');
    
    // 等待用户手动关闭
    await new Promise(() => {}); // 永久等待
    
  } catch (error) {
    console.error('❌ 测试过程中发生错误:', error);
  } finally {
    // 注释掉自动关闭，让用户手动关闭
    // await browser.close();
  }
}

/**
 * 显示使用说明
 */
function showUsage() {
  console.log(`
📖 MCP Inspector 自动化测试脚本使用说明:

使用方法:
  node test-mcp-inspector.js [INSPECTOR_URL] [AUTH_TOKEN]

参数:
  INSPECTOR_URL  Inspector的URL (默认: http://localhost:6274)
  AUTH_TOKEN     认证令牌 (可选)

示例:
  node test-mcp-inspector.js
  node test-mcp-inspector.js http://localhost:6274 your-token-here

环境变量:
  MCP_INSPECTOR_URL  设置Inspector URL
  MCP_AUTH_TOKEN     设置认证令牌

注意:
  - 需要先安装Playwright: npm install playwright
  - 需要先启动MCP Inspector和MCPAdvisor
  - 脚本会保持浏览器打开以便手动检查结果
  - 截图将保存在 ./test-screenshots 目录中
`);
}

// 检查是否请求帮助
if (process.argv.includes('--help') || process.argv.includes('-h')) {
  showUsage();
  process.exit(0);
}

// 运行测试
runTests().catch(console.error);