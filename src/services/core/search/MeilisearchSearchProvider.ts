/**
 * Meilisearch 搜索提供者实现
 * 使用 Meilisearch 搜索引擎和 GetMCP API 资源获取器，支持本地和云端实例
 */

import { createHash } from 'node:crypto';
import { MCPServerResponse, SearchProvider } from '../../../types/index.js';
import type { SearchParams } from '../../../types/search.js';
import { ICache } from '../../interfaces/cache.js';
import { MemoryCache } from '../../common/cache/memoryCache.js';
import { GETMCP_API_URL, CACHE_TTL_MS } from '../../../config/constants.js';
import {
  GetMcpApiResponse,
  GetMcpResourceFetcher,
  IGetMcpResourceFetcher,
} from '../../common/api/getMcpResourceFetcher.js';
import {
  meilisearchClient,
  FailoverMeilisearchClient,
  MeilisearchClient,
} from '../../providers/meilisearch/controller.js';
import logger from '../../../utils/logger.js';

/**
 * 将 GetMCP API 响应转换为 Meilisearch 文档
 */
const convertToMeilisearchDocuments = (
  data: GetMcpApiResponse,
): Record<string, any>[] =>
  Object.entries(data)
    .filter(
      ([, server]) =>
        server &&
        typeof server.display_name === 'string' &&
        typeof server.repository?.url === 'string',
    )
    .map(([id, server]) => ({
      id: /^[a-zA-Z0-9_-]+$/.test(id)
        ? id
        : createHash('sha256').update(id).digest('hex'),
      title: server.display_name,
      description:
        typeof server.description === 'string' ? server.description : '',
      github_url: server.repository.url,
      categories: Array.isArray(server.categories)
        ? server.categories.filter(value => typeof value === 'string')
        : [],
      tags: Array.isArray(server.tags)
        ? server.tags.filter(value => typeof value === 'string')
        : [],
      installations: server.installations || {},
    }));

/**
 * 将 Meilisearch 搜索结果转换为 MCPServerResponse
 */
const convertHitToServerResponse = (
  hit: Record<string, any>,
): MCPServerResponse => ({
  id: hit.id,
  title: hit.title,
  description: hit.description,
  sourceUrl: hit.github_url,
  similarity: Number.isFinite(hit._rankingScore) ? hit._rankingScore : 0.5,
  categories: hit.categories || [],
  tags: hit.tags || [],
  installations: hit.installations || {},
});

/**
 * Meilisearch 搜索提供者实现
 * 支持本地和云端实例，包含故障转移机制
 */
export class MeilisearchSearchProvider implements SearchProvider {
  private resourceFetcher: IGetMcpResourceFetcher;
  private cache: ICache<GetMcpApiResponse>;
  private client: MeilisearchClient;
  private loading?: Promise<void>;

  /**
   * 构造函数
   */
  constructor(
    resourceFetcher?: IGetMcpResourceFetcher,
    cache?: ICache<GetMcpApiResponse>,
    client?: MeilisearchClient,
  ) {
    this.resourceFetcher =
      resourceFetcher || new GetMcpResourceFetcher(GETMCP_API_URL);
    this.cache = cache || new MemoryCache<GetMcpApiResponse>(CACHE_TTL_MS);
    this.client = client || new FailoverMeilisearchClient();

    logger.info('MeilisearchSearchProvider initialized with failover support');
  }

  /**
   * 搜索 MCP 服务器
   */
  async search(params: SearchParams): Promise<MCPServerResponse[]> {
    const query = [
      params.taskDescription,
      ...(params.keywords || []),
      ...(params.capabilities || []),
    ]
      .join(' ')
      .trim();
    if (!query) return [];
    try {
      logger.info(`Searching for MCP servers with query: ${query}`);

      // 确保数据已加载
      await this.ensureDataLoaded();

      // 执行 Meilisearch 搜索
      const results = await this.client.search(query, {
        limit: 10,
        showRankingScore: true,
      });
      if (!Array.isArray(results?.hits)) {
        throw new Error('Meilisearch returned an invalid search response');
      }
      const serverResponses = results.hits.map(convertHitToServerResponse);

      logger.debug(`Found ${serverResponses.length} results from Meilisearch`);
      return serverResponses;
    } catch (error) {
      logger.error(
        `Error searching with Meilisearch: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw error;
    }
  }

  /**
   * 健康检查
   */
  async healthCheck(): Promise<boolean> {
    try {
      if (this.client.healthCheck) {
        return await this.client.healthCheck();
      }
      return true;
    } catch (error) {
      logger.error('Meilisearch health check failed:', error);
      return false;
    }
  }

  /**
   * 确保数据已从 API 加载
   */
  private async ensureDataLoaded(): Promise<void> {
    // 检查是否有有效的缓存数据
    const cachedData = this.cache.get();

    if (cachedData) {
      return;
    }

    if (!this.loading) {
      this.loading = this.loadData().finally(() => {
        this.loading = undefined;
      });
    }
    await this.loading;
  }

  private async loadData(): Promise<void> {
    try {
      // 从 API 获取数据
      const data = await this.resourceFetcher.fetchData();
      if (!data || typeof data !== 'object' || Array.isArray(data)) {
        throw new Error('GetMCP catalog must be an object keyed by server ID');
      }

      // 将数据转换为 Meilisearch 文档格式
      const documents = convertToMeilisearchDocuments(data);
      await this.client.indexDocuments?.(documents);
      // Cache only after ingestion succeeds so failed writes can be retried.
      this.cache.set(data);

      logger.info(`Loaded ${documents.length} MCP servers`);
    } catch (error) {
      logger.error(
        `Error loading data: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw error;
    }
  }
}
