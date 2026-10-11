/**
 * Meilisearch 监控工具
 * 提供基础的健康检查和状态监控功能
 */

import { MeilisearchConfigManager, MeilisearchInstanceConfig } from '../config/meilisearch.js';
import logger from './logger.js';

export interface MeilisearchStats {
  numberOfDocuments: number;
  isIndexing: boolean;
  fieldDistribution: Record<string, number>;
}

export interface MeilisearchHealthInfo {
  isHealthy: boolean;
  config: MeilisearchInstanceConfig;
  stats?: MeilisearchStats;
  error?: string;
  responseTime?: number;
}

export class MeilisearchMonitor {
  private configManager: MeilisearchConfigManager;
  
  constructor() {
    this.configManager = MeilisearchConfigManager.getInstance();
  }
  
  /**
   * 获取 Meilisearch 健康状态
   */
  async getHealth(): Promise<MeilisearchHealthInfo> {
    const config = this.configManager.getActiveConfig();
    const startTime = Date.now();
    
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      
      const response = await fetch(`${config.host}/health`, {
        headers: this.getAuthHeaders(config),
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      const responseTime = Date.now() - startTime;
      
      if (response.ok) {
        // 尝试获取统计信息
        let stats: MeilisearchStats | undefined;
        try {
          stats = await this.getStats(config);
        } catch (error) {
          logger.warn('Failed to get stats, but health check passed');
        }
        
        return {
          isHealthy: true,
          config,
          stats,
          responseTime
        };
      } else {
        return {
          isHealthy: false,
          config,
          error: `HTTP ${response.status}: ${response.statusText}`,
          responseTime
        };
      }
    } catch (error) {
      const responseTime = Date.now() - startTime;
      return {
        isHealthy: false,
        config,
        error: error instanceof Error ? error.message : String(error),
        responseTime
      };
    }
  }
  
  /**
   * 获取 Meilisearch 统计信息
   */
  async getStats(config?: MeilisearchInstanceConfig): Promise<MeilisearchStats> {
    const activeConfig = config || this.configManager.getActiveConfig();
    
    try {
      const response = await fetch(`${activeConfig.host}/indexes/${activeConfig.indexName}/stats`, {
        headers: this.getAuthHeaders(activeConfig)
      });
      
      if (!response.ok) {
        throw new Error(`Failed to get stats: ${response.status}`);
      }
      
      const stats = await response.json();
      return {
        numberOfDocuments: stats.numberOfDocuments || 0,
        isIndexing: stats.isIndexing || false,
        fieldDistribution: stats.fieldDistribution || {}
      };
    } catch (error) {
      logger.error('Failed to get Meilisearch stats:', error);
      throw error;
    }
  }
  
  /**
   * 检查 fallback 配置的健康状态
   */
  async getFallbackHealth(): Promise<MeilisearchHealthInfo | null> {
    const fallbackConfig = this.configManager.getFallbackConfig();
    
    if (!fallbackConfig) {
      return null;
    }
    
    const startTime = Date.now();
    
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      
      const response = await fetch(`${fallbackConfig.host}/health`, {
        headers: this.getAuthHeaders(fallbackConfig),
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      const responseTime = Date.now() - startTime;
      
      return {
        isHealthy: response.ok,
        config: fallbackConfig,
        responseTime,
        error: response.ok ? undefined : `HTTP ${response.status}`
      };
    } catch (error) {
      const responseTime = Date.now() - startTime;
      return {
        isHealthy: false,
        config: fallbackConfig,
        error: error instanceof Error ? error.message : String(error),
        responseTime
      };
    }
  }
  
  /**
   * 获取完整的系统状态报告
   */
  async getSystemReport(): Promise<{
    primary: MeilisearchHealthInfo;
    fallback: MeilisearchHealthInfo | null;
    recommendation: string;
  }> {
    const [primary, fallback] = await Promise.all([
      this.getHealth(),
      this.getFallbackHealth()
    ]);
    
    let recommendation = '';
    
    if (primary.isHealthy) {
      recommendation = `✅ 主要实例 (${primary.config.type}) 运行正常`;
    } else if (fallback?.isHealthy) {
      recommendation = `⚠️ 主要实例不可用，但 fallback 实例正常运行`;
    } else {
      recommendation = `❌ 所有实例都不可用，请检查配置和网络连接`;
    }
    
    return {
      primary,
      fallback,
      recommendation
    };
  }
  
  /**
   * 生成认证头
   */
  private getAuthHeaders(config: MeilisearchInstanceConfig): Record<string, string> {
    const key = config.apiKey || config.masterKey;
    return key ? { 'Authorization': `Bearer ${key}` } : {};
  }
  
  /**
   * 监控循环
   */
  async startMonitoring(intervalMs: number = 30000): Promise<void> {
    logger.info(`Starting Meilisearch monitoring every ${intervalMs}ms`);
    
    const monitor = async () => {
      try {
        const report = await this.getSystemReport();
        
        if (!report.primary.isHealthy && !report.fallback?.isHealthy) {
          logger.error('Meilisearch monitoring alert: All instances are down', report);
        } else if (!report.primary.isHealthy) {
          logger.warn('Meilisearch monitoring: Primary instance is down, using fallback', report);
        } else {
          logger.debug('Meilisearch monitoring: All systems operational', {
            primaryResponseTime: report.primary.responseTime,
            fallbackResponseTime: report.fallback?.responseTime
          });
        }
      } catch (error) {
        logger.error('Meilisearch monitoring error:', error);
      }
    };
    
    // 立即执行一次
    await monitor();
    
    // 设置定期监控
    globalThis.setInterval(monitor, intervalMs);
  }
}