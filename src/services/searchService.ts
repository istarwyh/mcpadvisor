import {
  SearchProvider,
  MCPServerResponse,
  SearchOptions,
} from '../types/index.js';
import { RerankMcpServer } from './core/search/RerankMcpService.js';
import type { SearchParams } from '../types/search.js';
import { OfflineSearchProvider } from './core/search/OfflineSearchProvider.js';
import logger from '../utils/logger.js';
import type { ProfessionalReranker } from './core/search/ProfessionalReranker.js';

/**
 * 提供者优先级配置
 */
const PROVIDER_PRIORITIES: Record<string, number> = {
  OfflineSearchProvider: 5,
  GetMcpSearchProvider: 10,
  CompassSearchProvider: 8,
  MeilisearchSearchProvider: 9,
};

/**
 * 默认搜索选项
 */
const DEFAULT_SEARCH_OPTIONS: SearchOptions = {
  limit: 5,
  minSimilarity: 0.4,
};

/**
 * 离线模式配置选项
 */
interface OfflineConfig {
  /**
   * 是否启用离线模式
   */
  enabled: boolean;

  /**
   * 自定义兜底数据路径
   */
  fallbackDataPath?: string;

  /**
   * 最小相似度阈值
   */
  minSimilarity?: number;
}

/**
 * 默认离线模式配置
 */
const DEFAULT_OFFLINE_CONFIG: OfflineConfig = {
  enabled: true,
  minSimilarity: 0.3,
};

/**
 * Search service that can use multiple search providers
 */
export class SearchService {
  private providers: SearchProvider[] = [];
  private offlineProvider?: SearchProvider;
  private offlineConfig: OfflineConfig;
  private reranker: RerankMcpServer;

  /**
   * Create a new search service with the specified providers
   * @param providers - Array of search providers to use
   * @param offlineConfig - 离线模式配置，默认启用
   */
  constructor(
    providers: SearchProvider[] = [],
    offlineConfig: Partial<OfflineConfig> = {},
    private readonly professionalReranker?: ProfessionalReranker,
  ) {
    this.providers = providers;
    this.reranker = new RerankMcpServer(PROVIDER_PRIORITIES);

    // 合并离线模式配置
    this.offlineConfig = {
      ...DEFAULT_OFFLINE_CONFIG,
      ...offlineConfig,
    };

    // 如果启用了离线模式，初始化离线搜索提供者
    if (this.offlineConfig.enabled) {
      this.initOfflineProvider();
    }

    logger.info(
      `SearchService initialized with ${providers.length} providers`,
      {
        providerCount: providers.length,
        offlineMode: this.offlineConfig.enabled,
      },
    );
  }

  /**
   * 初始化离线搜索提供者
   */
  private initOfflineProvider(): void {
    try {
      this.offlineProvider = new OfflineSearchProvider({
        fallbackDataPath: this.offlineConfig.fallbackDataPath,
        minSimilarity: this.offlineConfig.minSimilarity,
      });
      logger.info('Offline search provider initialized');
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error(`Failed to initialize offline search provider: ${message}`, {
        error,
      });
    }
  }

  /**
   * Add a new search provider
   * @param provider - The search provider to add
   */
  addProvider(provider: SearchProvider): void {
    this.providers.push(provider);
    logger.info(
      `New provider added, total providers: ${this.providers.length}`,
    );
  }

  /**
   * Remove a search provider
   * @param index - The index of the provider to remove
   */
  removeProvider(index: number): void {
    if (index >= 0 && index < this.providers.length) {
      this.providers.splice(index, 1);
      logger.info(
        `Provider removed, total providers: ${this.providers.length}`,
      );
    } else {
      logger.warn(`Invalid provider index: ${index}`);
    }
  }

  /**
   * Get all current providers
   * @returns Array of search providers
   */
  getProviders(): SearchProvider[] {
    return [...this.providers];
  }

  /**
   * Search for MCP servers using all providers
   * @param params - Structured search parameters
   * @param options - Optional search configuration
   */
  async search(
    params: SearchParams,
    options?: SearchOptions,
  ): Promise<MCPServerResponse[]>;
  async search(
    arg: string | SearchParams,
    options?: SearchOptions,
  ): Promise<MCPServerResponse[]> {
    // 解析参数
    const params: SearchParams =
      typeof arg === 'string' ? { taskDescription: arg } : arg;

    if (this.providers.length === 0 && !this.offlineProvider) {
      logger.warn('No search providers available');
      return [];
    }

    try {
      // 合并默认选项
      const mergedOptions = { ...DEFAULT_SEARCH_OPTIONS, ...options };

      logger.info(
        `Searching with ${this.providers.length} providers for task: ${params.taskDescription}`,
        'SearchService',
        { providerCount: this.providers.length },
      );
      const allProviders = [...this.providers];
      let offlineProviderIndex = -1;

      // 如果启用了离线模式，添加离线提供者
      if (this.offlineConfig.enabled && this.offlineProvider) {
        offlineProviderIndex = allProviders.length;
        allProviders.push(this.offlineProvider);
      }

      // Collect results from all providers in parallel
      const providerPromises = this.searchAllProviders(allProviders, params);

      const namedProviderResults = await Promise.all(providerPromises);
      this.logProviderResults(namedProviderResults);
      const fallback = this.reranker.reRank(
        namedProviderResults,
        mergedOptions,
      );
      if (
        !this.professionalReranker ||
        (mergedOptions.limit !== undefined &&
          (mergedOptions.limit <= 0 || mergedOptions.limit > 50)) ||
        (mergedOptions.sortBy && mergedOptions.sortBy !== 'score')
      )
        return fallback;
      const candidates = this.reranker.reRank(namedProviderResults, {
        ...mergedOptions,
        limit: 50,
      });
      if (candidates.length < 2) return fallback;
      try {
        const query = [
          params.taskDescription,
          ...(params.keywords || []),
          ...(params.capabilities || []),
        ]
          .join(' ')
          .trim();
        if (!query) return fallback;
        const ranked = await this.professionalReranker.rerank(
          query,
          candidates,
        );
        const ordered =
          mergedOptions.sortOrder === 'asc' ? [...ranked].reverse() : ranked;
        return mergedOptions.limit && mergedOptions.limit > 0
          ? ordered.slice(0, mergedOptions.limit)
          : ordered;
      } catch {
        logger.warn(
          'Professional reranking failed; using existing search ranking',
        );
        return fallback;
      }
    } catch (error) {
      logger.error(
        `Error in search service: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw error;
    }
  }

  /**
   * Search all providers in parallel
   * @param allProviders - Array of all providers to search
   * @param params - Search parameters
   */
  private searchAllProviders(
    allProviders: SearchProvider[],
    params: SearchParams,
  ) {
    return allProviders.map((provider, index) => {
      const providerName = provider.constructor.name;
      logger.info(
        `Starting search with provider ${index + 1}/${this.providers.length}: ${providerName}`,
        'Provider',
        {
          providerName,
          providerIndex: index,
          params,
        },
      );

      return provider
        .search(params)
        .then(results => {
          logger.info(
            `Provider ${providerName} returned ${results.length} results`,
            'Provider',
            {
              providerName,
              resultCount: results.length,
              topResults: results.slice(0, 3).map(r => ({
                title: r.title,
                similarity: r.similarity,
                github_url: r.sourceUrl,
              })),
            },
          );

          // Log full results at debug level
          if (results.length > 0) {
            logger.debug(
              `Full results from provider ${providerName}:`,
              'Provider',
              {
                providerName,
                results,
              },
            );
          }

          return {
            providerName,
            results,
          };
        })
        .catch(error => {
          const errorMessage =
            error instanceof Error ? error.message : String(error);
          logger.error(
            `Provider ${providerName} search failed: ${errorMessage}`,
            'Provider',
            {
              providerName,
              error: errorMessage,
            },
          );
          return {
            providerName,
            results: [] as MCPServerResponse[],
          };
        });
    });
  }

  private logProviderResults(
    namedProviderResults: (
      | { providerName: string; results: MCPServerResponse[] }
      | { providerName: string; results: MCPServerResponse[] }
    )[],
  ) {
    namedProviderResults.forEach(({ providerName, results }) => {
      logger.info(
        `Provider ${providerName} found ${results.length} results`,
        'SearchSummary',
        {
          providerName,
          resultCount: results.length,
        },
      );
    });
  }
}
