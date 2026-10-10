/**
 * Meilisearch 客户端控制器
 * 提供与 Meilisearch 交互的功能，支持本地和云端实例
 */

import { MeiliSearch } from 'meilisearch';
import {
  MEILISEARCH_CONFIG,
  MeilisearchConfigManager,
  MeilisearchInstanceConfig,
} from '../../../config/meilisearch.js';
import { LocalMeilisearchController } from './localController.js';
import logger from '../../../utils/logger.js';

/**
 * Meilisearch 客户端接口
 */
export interface MeilisearchClient {
  search(query: string, options?: Record<string, any>): Promise<any>;
  healthCheck?(): Promise<boolean>;
  indexDocuments?(documents: Record<string, unknown>[]): Promise<void>;
}

/**
 * 创建云端 Meilisearch 客户端
 */
const createCloudMeilisearchClient = (
  config: MeilisearchInstanceConfig,
): MeilisearchClient => {
  try {
    const client = new MeiliSearch({
      host: config.host,
      apiKey: config.apiKey,
    });

    const index = client.index(config.indexName);

    logger.info(
      `Cloud Meilisearch client initialized with host: ${config.host}`,
    );
    logger.info(`Using index: ${config.indexName}`);

    return {
      search: async (
        query: string,
        options: Record<string, any> = {},
      ): Promise<any> => {
        try {
          const results = await index.search(query, options);
          logger.debug(
            `Cloud Meilisearch search for "${query}" returned ${results.hits.length} results`,
          );
          return results;
        } catch (error) {
          const message =
            error instanceof Error ? error.message : String(error);
          logger.error(`Cloud Meilisearch search error: ${message}`);
          throw error;
        }
      },
      healthCheck: async (): Promise<boolean> => {
        try {
          await client.health();
          return true;
        } catch (error) {
          logger.warn('Cloud Meilisearch health check failed:', error);
          return false;
        }
      },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error(`Failed to initialize cloud Meilisearch client: ${message}`);
    throw error;
  }
};

/**
 * Meilisearch 客户端工厂
 */
export class MeilisearchClientFactory {
  private static configManager = MeilisearchConfigManager.getInstance();

  /**
   * 创建主要客户端
   */
  static createPrimaryClient(): MeilisearchClient {
    const config = this.configManager.getActiveConfig();

    if (config.type === 'local') {
      logger.info('Creating local Meilisearch client');
      return new LocalMeilisearchController(config);
    } else {
      logger.info('Creating cloud Meilisearch client');
      return createCloudMeilisearchClient(config);
    }
  }

  /**
   * 创建 fallback 客户端
   */
  static createFallbackClient(): MeilisearchClient | null {
    const fallbackConfig = this.configManager.getFallbackConfig();

    if (fallbackConfig) {
      logger.info('Creating fallback Meilisearch client');
      return createCloudMeilisearchClient(fallbackConfig);
    }

    return null;
  }
}

/**
 * 带故障转移的 Meilisearch 客户端
 */
export class FailoverMeilisearchClient implements MeilisearchClient {
  private primaryClient: MeilisearchClient;
  private fallbackClient: MeilisearchClient | null;

  constructor() {
    this.primaryClient = MeilisearchClientFactory.createPrimaryClient();
    this.fallbackClient = MeilisearchClientFactory.createFallbackClient();
  }

  /** Catalog writes never fail over to the read-only cloud search index. */
  async indexDocuments(documents: Record<string, unknown>[]): Promise<void> {
    await this.primaryClient.indexDocuments?.(documents);
  }

  async search(query: string, options?: Record<string, any>): Promise<any> {
    try {
      return await this.primaryClient.search(query, options);
    } catch (error) {
      if (this.fallbackClient) {
        logger.warn('Primary Meilisearch failed, using fallback client');
        try {
          return await this.fallbackClient.search(query, options);
        } catch (fallbackError) {
          logger.error('Both primary and fallback Meilisearch clients failed');
          throw fallbackError;
        }
      }
      throw error;
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      if (this.primaryClient.healthCheck) {
        return await this.primaryClient.healthCheck();
      }
      return true;
    } catch (error) {
      if (this.fallbackClient?.healthCheck) {
        return await this.fallbackClient.healthCheck();
      }
      return false;
    }
  }
}

/**
 * 创建传统 Meilisearch 客户端（向后兼容）
 */
const createMeilisearchClient = (): MeilisearchClient => {
  try {
    // 使用配置文件中的配置创建客户端
    const client = new MeiliSearch({
      host: MEILISEARCH_CONFIG.host,
      apiKey: MEILISEARCH_CONFIG.apiKey,
    });

    // 获取索引
    const index = client.index(MEILISEARCH_CONFIG.indexName);

    logger.info(
      `Legacy Meilisearch client initialized with host: ${MEILISEARCH_CONFIG.host}`,
    );
    logger.info(`Using index: ${MEILISEARCH_CONFIG.indexName}`);

    // 返回客户端接口实现
    return {
      /**
       * 搜索文档
       */
      search: async (
        query: string,
        options: Record<string, any> = {},
      ): Promise<any> => {
        try {
          const results = await index.search(query, options);
          logger.debug(
            `Legacy Meilisearch search for "${query}" returned ${results.hits.length} results`,
          );
          return results;
        } catch (error) {
          const message =
            error instanceof Error ? error.message : String(error);
          logger.error(`Legacy Meilisearch search error: ${message}`);
          throw error;
        }
      },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error(`Failed to initialize legacy Meilisearch client: ${message}`);

    // 返回一个空的客户端实现，避免应用崩溃
    return {
      search: async (): Promise<any> => {
        logger.warn('Using fallback Meilisearch client implementation');
        return { hits: [] };
      },
    };
  }
};

/**
 * Meilisearch 客户端实例（向后兼容）
 * @deprecated 请使用 FailoverMeilisearchClient 或 MeilisearchClientFactory
 */
export const meilisearchClient = createMeilisearchClient();
