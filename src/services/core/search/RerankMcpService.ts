import { MCPServerResponse } from '../../../types/index.js';
import {
  ProviderPriorities,
  ProviderResult,
  RerankOptions,
} from '../../../types/search.js';
import logger from '../../../utils/logger.js';
import {
  IRerankProcessor,
  LimitProcessor,
  ProfessionalRerankProcessor,
  ScoreCalculationProcessor,
  ScoreFilterProcessor,
  ScoreSortProcessor,
} from './RerankMcpProcessorFactory.js';

/**
 * Service responsible for re-ranking and merging search results from multiple providers.
 * Uses Chain of Responsibility pattern for extensible reranking strategies.
 */
export class RerankMcpServer {
  private providerPriorities: ProviderPriorities;
  private rerankChain!: IRerankProcessor;

  constructor(providerPriorities: ProviderPriorities = {}) {
    this.providerPriorities = { ...providerPriorities };
    this.initializeRerankChain();
  }

  /**
   * 初始化排序责任链
   */
  private initializeRerankChain(): void {
    const scoreCalculation = new ScoreCalculationProcessor(
      this.providerPriorities,
    );
    const scoreFilter = new ScoreFilterProcessor();
    const scoreSort = new ScoreSortProcessor();
    const limit = new LimitProcessor();
    const professionalRerank = new ProfessionalRerankProcessor(false); // 默认关闭

    // 构建责任链：计算分数 -> 过滤 -> 专业排序 -> 通用排序 -> 限制数量
    scoreCalculation
      .setNext(scoreFilter)
      .setNext(professionalRerank)
      .setNext(scoreSort)
      .setNext(limit);

    this.rerankChain = scoreCalculation;
  }

  /**
   * Re-ranks and merges search results from multiple providers.
   * @param namedProviderResults Array of provider results to be merged and re-ranked
   * @param options Re-ranking and merging options
   * @returns Re-ranked and deduplicated array of MCP server responses
   */
  public reRank(
    namedProviderResults: ProviderResult[],
    options: RerankOptions = {},
  ): MCPServerResponse[] {
    // 1. 合并和去重
    const mergedResults = this.mergeAndDeduplicate(
      namedProviderResults,
      options,
    );

    // 2. 通过责任链处理
    const processedResults = this.rerankChain.process(mergedResults, options);

    logger.info(
      `Reranked ${processedResults.length} results using chain of responsibility pattern`,
      {
        totalResults: processedResults.length,
        hasCustomScore: processedResults.some(r => r.score !== undefined),
        avgScore:
          processedResults.length > 0
            ? processedResults.reduce(
                (sum, r) => sum + (r.score ?? r.similarity),
                0,
              ) / processedResults.length
            : 0,
      },
    );

    return processedResults;
  }

  /**
   * 合并和去重搜索结果
   */
  private mergeAndDeduplicate(
    namedProviderResults: ProviderResult[],
    options: RerankOptions,
  ): MCPServerResponse[] {
    const resultsMap = new Map<
      string,
      MCPServerResponse & { providerPriority?: number }
    >();
    const duplicates: string[] = [];
    for (const { providerName, results } of namedProviderResults) {
      const priority = this.getProviderPriority(providerName);
      for (const result of results) {
        // Skip results below minimum similarity threshold if specified (backward compatibility)
        if (
          options.minSimilarity !== undefined &&
          result.similarity < options.minSimilarity
        ) {
          continue;
        }

        const resultWithPriority = { ...result, providerPriority: priority };
        const key = result.sourceUrl || `title:${result.title}`;

        if (!resultsMap.has(key)) {
          resultsMap.set(key, resultWithPriority);
        } else {
          const existingResult = resultsMap.get(key)!;

          // Replace if new result has higher similarity, or same similarity but higher priority
          if (
            existingResult.similarity < result.similarity ||
            (existingResult.similarity === result.similarity &&
              (existingResult.providerPriority || 0) < priority)
          ) {
            resultsMap.set(key, resultWithPriority);
          }

          duplicates.push(key);
        }
      }
    }

    logger.info(`Merged ${resultsMap.size} unique results from all providers`, {
      totalResults: resultsMap.size,
      duplicatesRemoved: duplicates.length,
    });

    return Array.from(resultsMap.values());
  }

  /**
   * Gets the priority for a provider
   * @param providerName Name of the provider
   * @returns Priority value (higher is more important)
   */
  private getProviderPriority(providerName: string): number {
    return this.providerPriorities[providerName] || 0;
  }
}
