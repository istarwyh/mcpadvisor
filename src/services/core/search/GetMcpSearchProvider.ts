import { MCPServerResponse, SearchProvider } from '../../../types/index.js';
import type { SearchParams } from '../../../types/search.js';
import { ICache } from '../../interfaces/cache.js';
import { MemoryCache } from '../../common/cache/memoryCache.js';
import { IVectorSearchEngine } from '../../interfaces/vectorSearchEngines.js';
import { VectorEngineFactory } from '../../vectorEngineFactory.js';
import { GETMCP_API_URL, CACHE_TTL_MS } from '../../../config/constants.js';
import {
  GetMcpApiResponse,
  GetMcpResourceFetcher,
  IGetMcpResourceFetcher,
} from '../../common/api/getMcpResourceFetcher.js';
import {
  processAndIndexData,
  performVectorSearch,
} from './VectorSearchManager.js';
import logger from '../../../utils/logger.js';

/**
 * GetMCP 搜索提供者实现
 * 使用向量搜索引擎和 GetMCP API 资源获取器
 */
export class GetMcpSearchProvider implements SearchProvider {
  private resourceFetcher: IGetMcpResourceFetcher;
  private cache: ICache<GetMcpApiResponse>;
  private vectorEngine: IVectorSearchEngine;

  /**
   * 构造函数
   */
  constructor(
    resourceFetcher?: IGetMcpResourceFetcher,
    cache?: ICache<GetMcpApiResponse>,
    vectorEngine?: IVectorSearchEngine,
  ) {
    this.resourceFetcher =
      resourceFetcher || new GetMcpResourceFetcher(GETMCP_API_URL);
    this.cache = cache || new MemoryCache<GetMcpApiResponse>(CACHE_TTL_MS);
    this.vectorEngine = vectorEngine || VectorEngineFactory.createEngine();

    logger.info('GetMcpSearchProvider initialized');
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
    try {
      logger.info(`Searching for MCP servers with query: ${query}`);

      // 确保数据已加载和索引
      await this.ensureDataLoaded();

      // 执行向量搜索
      const results = await performVectorSearch(query, this.vectorEngine);

      logger.debug(`Found ${results.length} results from GetMCP API`);
      return results;
    } catch (error) {
      // 使用增强的日志记录方式，传递完整错误对象
      const message = error instanceof Error ? error.message : String(error);
      logger.error(`Error searching GetMCP API: ${message}`, {
        error,
        data: {
          query,
          provider: 'GetMcpSearchProvider',
          errorType:
            error instanceof Error ? error.constructor.name : typeof error,
        },
      });
      throw error;
    }
  }

  /**
   * 确保数据已从 API 加载并索引
   */
  private async ensureDataLoaded(): Promise<void> {
    // 检查是否有有效的缓存数据
    const cachedData = this.cache.get();

    if (cachedData) {
      return;
    }

    try {
      // 从 API 获取数据
      const data = await this.resourceFetcher.fetchData();

      // 缓存数据
      this.cache.set(data);

      // 处理并索引数据
      await processAndIndexData(
        data,
        this.vectorEngine,
        GetMcpResourceFetcher.createSearchableText,
      );
    } catch (error) {
      // 使用增强的日志记录方式，传递完整错误对象
      const message = error instanceof Error ? error.message : String(error);
      logger.error(`Error loading GetMCP data: ${message}`, {
        error,
        data: {
          provider: 'GetMcpSearchProvider',
          errorType:
            error instanceof Error ? error.constructor.name : typeof error,
          apiUrl:
            this.resourceFetcher instanceof GetMcpResourceFetcher
              ? this.resourceFetcher['apiUrl']
              : 'unknown',
        },
      });
      throw error;
    }
  }
}
