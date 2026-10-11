import { MCPServerResponse } from '../../../types/index.js';
import { ProviderPriorities, RerankOptions } from '../../../types/search.js';
import logger from '../../../utils/logger.js';
/**
 * 排序处理器接口 - 责任链模式
 */
export interface IRerankProcessor {
  setNext(processor: IRerankProcessor): IRerankProcessor;
  process(
    results: MCPServerResponse[],
    options: RerankOptions,
  ): MCPServerResponse[];
}

/**
 * 抽象排序处理器基类
 */
abstract class AbstractRerankProcessor implements IRerankProcessor {
  private nextProcessor?: IRerankProcessor;

  public setNext(processor: IRerankProcessor): IRerankProcessor {
    this.nextProcessor = processor;
    return processor;
  }

  public process(
    results: MCPServerResponse[],
    options: RerankOptions,
  ): MCPServerResponse[] {
    const processedResults = this.handle(results, options);

    if (this.nextProcessor) {
      return this.nextProcessor.process(processedResults, options);
    }

    return processedResults;
  }

  protected abstract handle(
    results: MCPServerResponse[],
    options: RerankOptions,
  ): MCPServerResponse[];
}

/**
 * 分数计算处理器 - 计算或使用现有的score字段
 */
export class ScoreCalculationProcessor extends AbstractRerankProcessor {
  constructor(private providerPriorities: ProviderPriorities) {
    super();
  }

  protected handle(
    results: MCPServerResponse[],
    options: RerankOptions,
  ): MCPServerResponse[] {
    return results.map(result => {
      // 如果已有score，优先使用现有的score
      if (result.score !== undefined) {
        return result;
      }

      // 否则根据 providerPriority * similarity 计算score
      const providerPriority = (result as any).providerPriority || 1;
      const calculatedScore = providerPriority * result.similarity;

      return {
        ...result,
        score: calculatedScore,
      };
    });
  }
}

/**
 * 分数过滤处理器 - 根据最小分数阈值过滤
 */
export class ScoreFilterProcessor extends AbstractRerankProcessor {
  protected handle(
    results: MCPServerResponse[],
    options: RerankOptions,
  ): MCPServerResponse[] {
    // 支持向后兼容的minSimilarity
    const minThreshold = options.minScore ?? options.minSimilarity;

    if (minThreshold === undefined) {
      return results;
    }

    return results.filter(result => {
      const scoreToCheck = result.score ?? result.similarity;
      return scoreToCheck >= minThreshold;
    });
  }
}

/**
 * 分数排序处理器 - 根据score字段排序
 */
export class ScoreSortProcessor extends AbstractRerankProcessor {
  protected handle(
    results: MCPServerResponse[],
    options: RerankOptions,
  ): MCPServerResponse[] {
    const sortBy = options.sortBy || 'score';
    const sortOrder = options.sortOrder || 'desc';

    return [...results].sort((a, b) => {
      let aValue: number;
      let bValue: number;

      // 根据排序字段获取值
      if (sortBy === 'score') {
        aValue = a.score ?? a.similarity;
        bValue = b.score ?? b.similarity;
      } else {
        aValue = (a as any)[sortBy] ?? 0;
        bValue = (b as any)[sortBy] ?? 0;
      }

      // 处理字符串数字
      if (typeof aValue === 'string' && !isNaN(Number(aValue))) {
        aValue = Number(aValue);
      }
      if (typeof bValue === 'string' && !isNaN(Number(bValue))) {
        bValue = Number(bValue);
      }

      // 排序比较
      const comparison = aValue - bValue;
      return sortOrder === 'asc' ? comparison : -comparison;
    });
  }
}

/**
 * 结果限制处理器 - 限制返回结果数量
 */
export class LimitProcessor extends AbstractRerankProcessor {
  protected handle(
    results: MCPServerResponse[],
    options: RerankOptions,
  ): MCPServerResponse[] {
    if (options.limit && options.limit > 0) {
      return results.slice(0, options.limit);
    }
    return results;
  }
}

/**
 * 专业Rerank模型处理器 - 为未来扩展预留
 * 可以集成如 Cohere Rerank、OpenAI 等专业排序模型
 */
export class ProfessionalRerankProcessor extends AbstractRerankProcessor {
  constructor(private enabled: boolean = false) {
    super();
  }

  protected handle(
    results: MCPServerResponse[],
    options: RerankOptions,
  ): MCPServerResponse[] {
    if (!this.enabled) {
      return results;
    }

    // TODO: 集成专业Rerank模型
    // 例如：Cohere Rerank API, OpenAI embeddings rerank, etc.
    logger.info(
      'Professional rerank model processing (placeholder for future implementation)',
    );

    return results;
  }
}
