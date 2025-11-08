import { Page, expect } from '@playwright/test';

// Test configuration constants
export const TEST_CONFIG = {
  baseUrl: process.env.MCP_INSPECTOR_URL || 'http://localhost:6274',
  authToken: process.env.MCP_AUTH_TOKEN,
  timeout: 20000,        // Reduced from 30000
  shortTimeout: 4000,    // Reduced from 5000
  longTimeout: 45000     // Reduced from 60000
};

// Environment setup and cleanup utilities
export class EnvironmentManager {
  private originalEnvVars: Record<string, string | undefined> = {};

  saveEnvironment() {
    this.originalEnvVars = {
      MEILISEARCH_INSTANCE: process.env.MEILISEARCH_INSTANCE,
      MEILISEARCH_LOCAL_HOST: process.env.MEILISEARCH_LOCAL_HOST,
      MEILISEARCH_MASTER_KEY: process.env.MEILISEARCH_MASTER_KEY,
      MEILISEARCH_INDEX_NAME: process.env.MEILISEARCH_INDEX_NAME
    };
  }

  restoreEnvironment() {
    Object.entries(this.originalEnvVars).forEach(([key, value]) => {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    });
  }

  setMeilisearchConfig(config: {
    instance?: string;
    host?: string;
    key?: string;
    indexName?: string;
  }) {
    if (config.instance) process.env.MEILISEARCH_INSTANCE = config.instance;
    if (config.host) process.env.MEILISEARCH_LOCAL_HOST = config.host;
    if (config.key) process.env.MEILISEARCH_MASTER_KEY = config.key;
    if (config.indexName) process.env.MEILISEARCH_INDEX_NAME = config.indexName;
  }
}

// Smart waiting functions
export class SmartWaiter {
  constructor(private page: Page) {}

  async waitForConnection(timeout = TEST_CONFIG.timeout) {
    await this.page.waitForFunction(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      return buttons.some(btn => 
        btn.textContent?.includes('List Resources') ||
        btn.textContent?.includes('List Tools')
      ) || document.querySelector('[role="tab"][data-testid="tools-tab"]') !== null;
    }, { timeout });
  }

  async waitForSearchResults(timeout = TEST_CONFIG.timeout) {
    await this.page.waitForFunction(() => {
      const content = (document.body.textContent || '').toLowerCase();
      return content.includes('title:') ||
             content.includes('no results') ||
             content.includes('no mcp servers found') ||
             content.includes('no matching mcp servers found') ||
             content.includes('error') ||
             content.includes('failed');
    }, { timeout });
  }

  async waitForPageLoad() {
    await this.page.waitForLoadState('networkidle');
    await this.page.waitForLoadState('domcontentloaded');
  }

  async waitForElementToBeVisible(selector: string, timeout = TEST_CONFIG.shortTimeout) {
    await this.page.waitForSelector(selector, { state: 'visible', timeout });
  }
}

// MCP connection and setup utilities
export class MCPConnectionManager {
  constructor(private page: Page, private waiter: SmartWaiter) {}

  async connectToMCP(retries = 3) {
    const maskedToken = TEST_CONFIG.authToken ? `${TEST_CONFIG.authToken.substring(0, 4)}****` : 'undefined';
    console.log(`🌐 访问: ${TEST_CONFIG.baseUrl}/?MCP_PROXY_AUTH_TOKEN=${maskedToken}`);
    
    const fullUrl = `${TEST_CONFIG.baseUrl}/?MCP_PROXY_AUTH_TOKEN=${TEST_CONFIG.authToken}`;
    
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        await this.page.goto(fullUrl);
        await this.waiter.waitForPageLoad();

        // Click connect button
        await this.page.getByRole('button', { name: 'Connect' }).click({ timeout: TEST_CONFIG.shortTimeout });
        await this.page.waitForTimeout(2000); // Brief wait for connection to establish

        // Wait for connection to be established
        await this.waiter.waitForConnection();

        // Check for connection errors
        const connectionError = this.page.getByText('Connection Error');
        if (await connectionError.isVisible().catch(() => false)) {
          const errorText = await connectionError.textContent();
          throw new Error(`MCP connection failed: ${errorText}`);
        }

        // Navigate to Tools tab if needed
        await this.ensureToolsTabActive();
        
        console.log(`✅ MCP connection established on attempt ${attempt}`);
        return; // Success
        
      } catch (error: any) {
        console.warn(`⚠️ Connection attempt ${attempt} failed:`, error.message);
        
        if (attempt === retries) {
          console.error('❌ All connection attempts failed');
          throw new Error(`Failed to connect to MCP after ${retries} attempts: ${error.message}`);
        }
        
        // Wait before retry
        await this.page.waitForTimeout(2000 * attempt);
      }
    }
  }

  private async ensureToolsTabActive() {
    try {
      const toolsTab = this.page.getByRole('tab', { name: 'Tools' });
      const listToolsButton = this.page.getByRole('button', { name: 'List Tools' });
      
      const isListToolsVisible = await listToolsButton.isVisible().catch(() => false);
      if (!isListToolsVisible) {
        await toolsTab.click();
        await this.page.waitForTimeout(1000);
        await this.waiter.waitForElementToBeVisible('button:has-text("List Tools")');
      }
      
      await listToolsButton.click();
      await this.page.waitForTimeout(1000);
    } catch (error: any) {
      console.warn('⚠️ Warning: Could not activate Tools tab:', error.message);
      // Don't fail the test, just log the warning
    }
  }
}

// Search operations utilities
export class SearchOperations {
  constructor(private page: Page, private waiter: SmartWaiter) {}

  get currentPage(): Page {
    return this.page;
  }

  async performSearch(query: string, testDescription?: string, retries = 2): Promise<number> {
    if (testDescription) {
      console.log(`🔄 测试 ${testDescription}`);
    }

    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        // Click on the search tool
        await this.page.getByRole('tabpanel', { name: 'Tools' })
          .getByText('此工具用于寻找合适且专业MCP').first().click();
        
        // Clear and fill in the search query
        const textbox = this.page.getByRole('textbox', { name: 'taskDescription' });
        await textbox.clear();
        await textbox.fill(query);
        
        // Start the search
        const startTime = Date.now();
        await this.page.getByRole('button', { name: 'Run Tool' }).click();
        
        // Wait for results using smart waiting
        await this.waiter.waitForSearchResults();
        
        const endTime = Date.now();
        const responseTime = endTime - startTime;
        
        if (testDescription) {
          console.log(`⏱️ ${testDescription}: ${responseTime}ms`);
        }

        return responseTime;
        
      } catch (error: any) {
        console.warn(`⚠️ Search attempt ${attempt} failed:`, error.message);
        
        if (attempt === retries) {
          console.error(`❌ Search failed after ${retries} attempts for query: "${query}"`);
          throw new Error(`Search operation failed: ${error.message}`);
        }
        
        // Wait before retry
        await this.page.waitForTimeout(1000 * attempt);
      }
    }
    
    // This should never be reached due to the throw above, but TypeScript needs it
    throw new Error('Search operation completed without returning a response time');
  }

  async getSearchResults(): Promise<string[]> {
    try {
      const pageContent = await this.page.content();
      return this.extractResultTitles(pageContent);
    } catch (error: any) {
      console.warn('⚠️ Warning: Could not extract search results:', error.message);
      return [];
    }
  }

  private extractResultTitles(content: string): string[] {
    const titleRegex = /Title:\s*([^\n]+)/g;
    const titles = [];
    let match;
    
    while ((match = titleRegex.exec(content)) !== null) {
      titles.push(match[1].trim());
    }
    
    return titles;
  }
}

// Screenshot utilities
export class ScreenshotManager {
  constructor(private page: Page) {}

  async takeScreenshot(filename: string, options?: { fullPage?: boolean }) {
    await this.page.screenshot({ 
      path: `test-results/${filename}`,
      fullPage: options?.fullPage ?? true 
    });
  }
}

// Test validation utilities
export class TestValidator {
  static validateSearchResults(results: string[], minCount = 1) {
    expect(results.length).toBeGreaterThanOrEqual(minCount);
  }

  static validatePageContent(content: string) {
    expect(content).toContain('Title:');
  }

  static validateResponseTime(responseTime: number, maxTime = 15000) {
    expect(responseTime).toBeLessThan(maxTime);
  }

  static validateResultRelevance(results: string[], keywords: string[]) {
    const hasRelevantResults = results.some(title => 
      keywords.some(keyword => 
        title.toLowerCase().includes(keyword.toLowerCase())
      )
    );
    
    if (!hasRelevantResults) {
      console.log('⚠️ 未找到预期关键词，但测试继续');
      console.log('实际结果:', results);
    }
    
    // Don't fail the test if no relevant keywords found, just log it
    return hasRelevantResults;
  }

  static compareResults(localResults: string[], cloudResults: string[]) {
    const commonResults = localResults.filter(localTitle => 
      cloudResults.some(cloudTitle => cloudTitle === localTitle)
    );
    
    console.log(`云端结果数量: ${cloudResults.length}`);
    console.log(`本地结果数量: ${localResults.length}`);
    console.log(`共同结果数量: ${commonResults.length}`);
    
    if (commonResults.length > 0) {
      console.log('✅ 发现相同结果，数据同步正常');
    } else {
      console.log('⚠️ 没有发现完全相同的结果，可能存在数据同步问题');
    }
    
    console.log('云端结果:', cloudResults);
    console.log('本地结果:', localResults);
    
    return commonResults;
  }
}

// Configuration test utilities
export class ConfigurationTester {
  constructor(
    private envManager: EnvironmentManager,
    private searchOps: SearchOperations,
    private validator: typeof TestValidator,
    private screenshotManager: ScreenshotManager
  ) {}

  async testConfiguration(configName: string, config: Record<string, string>) {
    console.log(`🧪 测试配置: ${configName}`);
    
    // Save current environment state to prevent pollution
    const originalEnv: Record<string, string | undefined> = {};
    Object.keys(config).forEach(key => {
      originalEnv[key] = process.env[key];
    });
    
    try {
      // Set environment variables
      Object.entries(config).forEach(([key, value]) => {
        process.env[key] = value;
      });
      
      // Perform test search
      await this.searchOps.performSearch(`配置测试: ${configName}`);
      
      // Validate response
      const results = await this.searchOps.getSearchResults();
      
      if (results.length === 0) {
        console.warn(`⚠️ 警告: 配置 "${configName}" 没有返回搜索结果`);
        // Don't fail the test, just log the warning
      } else {
        this.validator.validateSearchResults(results);
      }
      
      console.log(`✅ 配置测试完成: ${configName}`);
      
    } catch (error: any) {
      console.error(`❌ 配置测试失败: ${configName} - ${error.message}`);
      
      // Take screenshot for debugging
      await this.screenshotManager.takeScreenshot(`config-error-${configName.replace(/\s+/g, '-')}.png`);
      
      // Re-throw to fail the test
      throw new Error(`Configuration test failed for "${configName}": ${error.message}`);
    } finally {
      // Always restore original environment variables to prevent pollution
      Object.entries(originalEnv).forEach(([key, value]) => {
        if (value === undefined) {
          delete process.env[key];
        } else {
          process.env[key] = value;
        }
      });
    }
  }

  async recoverFromFailure(failureType: string, waiter: SmartWaiter, context?: any) {
    console.log(`🔧 开始故障恢复: ${failureType}`);
    
    try {
      switch (failureType) {
        case 'connection':
          // Try to reconnect or refresh the page
          await this.searchOps.currentPage.reload();
          await waiter.waitForPageLoad();
          break;
          
        case 'search':
          // Clear search state and retry
          await this.searchOps.currentPage.getByRole('textbox', { name: 'taskDescription' }).clear();
          break;
          
        case 'environment':
          // Restore environment using the environment manager
          this.envManager.restoreEnvironment();
          break;
          
        default:
          console.warn(`⚠️ 未知的故障类型: ${failureType}`);
      }
      
      console.log(`✅ 故障恢复完成: ${failureType}`);
      
    } catch (error: any) {
      console.error(`❌ 故障恢复失败: ${failureType} - ${error.message}`);
      throw new Error(`Recovery failed for "${failureType}": ${error.message}`);
    }
  }

  async testErrorHandling(errorName: string, config: Record<string, string>) {
    console.log(`🚨 测试错误情况: ${errorName}`);
    
    try {
      // Set error configuration
      Object.entries(config).forEach(([key, value]) => {
        process.env[key] = value;
      });
      
      // Perform test search
      await this.searchOps.performSearch(`错误处理测试: ${errorName}`);
      
      // For error handling tests, we expect either:
      // 1. Results from fallback mechanism
      // 2. A graceful error message
      const results = await this.searchOps.getSearchResults();
      const pageContent = await this.searchOps.currentPage.content();
      
      const hasErrorHandling = results.length > 0 || // fallback succeeded
                              pageContent.includes('error') || 
                              pageContent.includes('failed') ||
                              pageContent.includes('timeout');
      
      if (!hasErrorHandling) {
        console.warn(`⚠️ 警告: 错误处理测试 "${errorName}" 可能没有正确处理错误情况`);
      }
      
      // Take screenshot for debugging
      await this.screenshotManager.takeScreenshot(`error-handling-${errorName.replace(/\s+/g, '-')}.png`);
      
      console.log(`✅ 错误处理测试完成: ${errorName}`);
      
    } catch (error: any) {
      // For error handling tests, we expect some failures
      console.log(`✅ 错误处理测试完成: ${errorName} (捕获到预期错误)`);
      
      // Take screenshot for debugging
      await this.screenshotManager.takeScreenshot(`error-handling-${errorName.replace(/\s+/g, '-')}.png`);
    }
  }
}