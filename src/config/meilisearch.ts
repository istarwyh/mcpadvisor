/**
 * Meilisearch 配置
 * 集中管理 Meilisearch 相关配置，支持本地和云端实例
 */

/**
 * Meilisearch 实例配置接口
 */
export interface MeilisearchInstanceConfig {
  type: 'cloud' | 'local';
  host: string;
  apiKey?: string;
  masterKey?: string;
  indexName: string;
  /** Explicitly allow catalog upserts and settings updates on the local index. */
  autoIndex?: boolean;
}

/**
 * Meilisearch 配置管理器
 */
export class MeilisearchConfigManager {
  private static instance: MeilisearchConfigManager;

  static getInstance(): MeilisearchConfigManager {
    if (!MeilisearchConfigManager.instance) {
      MeilisearchConfigManager.instance = new MeilisearchConfigManager();
    }
    return MeilisearchConfigManager.instance;
  }

  /**
   * 获取当前激活的配置
   */
  getActiveConfig(): MeilisearchInstanceConfig {
    const instanceType = process.env.MEILISEARCH_INSTANCE || 'cloud';

    if (instanceType === 'local') {
      return {
        type: 'local',
        host: process.env.MEILISEARCH_LOCAL_HOST || 'http://localhost:7700',
        masterKey: process.env.MEILISEARCH_MASTER_KEY || 'developmentKey',
        autoIndex: process.env.MEILISEARCH_AUTO_INDEX === 'true',
        indexName: process.env.MEILISEARCH_INDEX_NAME || 'mcp_servers',
      };
    }

    // 保持现有云端配置
    return {
      type: 'cloud',
      host: 'https://edge.meilisearch.com',
      apiKey:
        process.env.MEILISEARCH_CLOUD_API_KEY || 'your-cloud-api-key-here',
      indexName: 'mcp_server_info_from_getmcp_io',
    };
  }

  /**
   * 获取 fallback 配置（用于故障转移）
   */
  getFallbackConfig(): MeilisearchInstanceConfig | null {
    const instanceType = process.env.MEILISEARCH_INSTANCE || 'cloud';

    // 只有本地实例才需要 fallback 到云端
    if (instanceType === 'local') {
      return {
        type: 'cloud',
        host: 'https://edge.meilisearch.com',
        apiKey:
          process.env.MEILISEARCH_CLOUD_API_KEY || 'your-cloud-api-key-here',
        indexName: 'mcp_server_info_from_getmcp_io',
      };
    }

    return null;
  }
}

/**
 * 向后兼容的配置对象
 * @deprecated 请使用 MeilisearchConfigManager.getInstance().getActiveConfig()
 */
export const MEILISEARCH_CONFIG = {
  host: 'https://edge.meilisearch.com',
  apiKey: 'your-cloud-api-key-here',
  indexName: 'mcp_server_info_from_getmcp_io',
};
