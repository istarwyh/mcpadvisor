/**
 * 增强型内存向量引擎
 * 提供自动加载兜底数据的功能，确保离线模式下仍能提供推荐
 */

import { MCPServerResponse } from '../../../types/index.js';
import { IWritableVectorSearchEngine } from '../../interfaces/vectorSearchEngines.js';
import { OfflineDataLoader } from './offlineDataLoader.js';
import { WritableInMemoryVectorEngine } from './writableVectorEngine.js';
import logger from '../../../utils/logger.js';
import { normalizeVector } from '../../../utils/vectorUtils.js';

/**
 * 搜索选项接口
 */
interface SearchOptions {
  minSimilarity?: number;
  categories?: string[];
  tags?: string[];
  textQuery?: string;
}

/**
 * 增强型内存向量引擎实现
 * 自动加载兜底数据，支持混合搜索和过滤
 */
export class EnhancedMemoryVectorEngine implements IWritableVectorSearchEngine {
  private memoryEngine: WritableInMemoryVectorEngine;
  private offlineLoader: OfflineDataLoader;
  private fallbackDataLoaded: boolean = false;
  private lastFallbackLoadTime: number = 0;
  private fallbackLoadIntervalMs: number = 3600000; // 1小时
  private customFallbackPath?: string;

  /**
   * 构造函数
   * @param customFallbackPath 可选的自定义兜底数据路径
   */
  constructor(customFallbackPath?: string) {
    this.memoryEngine = new WritableInMemoryVectorEngine();
    this.offlineLoader = new OfflineDataLoader(customFallbackPath);
    this.customFallbackPath = customFallbackPath;
    logger.info('Enhanced memory vector engine initialized');
  }

  /**
   * 添加向量条目
   */
  async addEntry(
    id: string,
    vector: number[],
    data: MCPServerResponse,
  ): Promise<void> {
    try {
      // 确保向量已归一化
      const normalizedVector = normalizeVector(vector);
      await this.memoryEngine.addEntry(id, normalizedVector, data);
    } catch (error) {
      this.handleError(error, 'adding vector entry');
    }
  }

  /**
   * 向量相似度搜索，支持混合搜索和过滤
   */
  async search(
    queryVector: number[],
    limit: number = 10,
    options: SearchOptions = {},
  ): Promise<MCPServerResponse[]> {
    try {
      // 确保兜底数据已加载
      await this.ensureFallbackDataLoaded();

      // 确保查询向量已归一化
      const normalizedQueryVector = normalizeVector(queryVector);

      // 执行向量搜索
      const vectorResults = await this.memoryEngine.search(
        normalizedQueryVector,
        limit * 2,
      );

      // 应用过滤条件
      const filteredResults = this.applyFilters(vectorResults, options);

      // 如果有文本查询，执行文本搜索并合并结果
      if (options.textQuery) {
        const textResults = await this.textSearch(options.textQuery, limit * 2);
        return this.mergeResults(filteredResults, textResults, limit);
      }

      // 返回前N个结果
      return filteredResults.slice(0, limit);
    } catch (error) {
      this.handleError(error, 'searching vectors');
      return [];
    }
  }

  /**
   * 清除所有向量数据（保留兜底数据）
   */
  async clear(): Promise<void> {
    try {
      await this.memoryEngine.clear();
      this.fallbackDataLoaded = false;
      await this.ensureFallbackDataLoaded();
      logger.info('Cleared all vector entries (except fallback data)');
    } catch (error) {
      this.handleError(error, 'clearing vector entries');
    }
  }

  /**
   * 设置自定义兜底数据路径
   */
  setFallbackDataPath(path: string): void {
    this.customFallbackPath = path;
    this.offlineLoader.setFallbackDataPath(path);
    this.fallbackDataLoaded = false;
    logger.info(`Updated fallback data path to: ${path}`);
  }

  /**
   * 确保兜底数据已加载
   */
  private async ensureFallbackDataLoaded(): Promise<void> {
    const currentTime = Date.now();

    // 如果数据尚未加载或者已经过期，则重新加载
    if (
      !this.fallbackDataLoaded ||
      currentTime - this.lastFallbackLoadTime > this.fallbackLoadIntervalMs
    ) {
      try {
        console.log(
          `[DEBUG] Loading fallback data from: ${this.customFallbackPath || 'default path'}`,
        );
        logger.info('Loading fallback data into memory engine');
        const fallbackEntries =
          await this.offlineLoader.loadFallbackDataWithEmbeddings();

        console.log(
          `[DEBUG] Loaded ${fallbackEntries.length} fallback entries with vectors`,
        );

        // 检查是否包含小红书相关服务器
        const redNoteEntries = fallbackEntries.filter(
          entry =>
            entry.data.id === 'rednote-mcp' ||
            entry.data.id === 'mcp-hotnews-server',
        );

        console.log(
          `[DEBUG] Including ${redNoteEntries.length} RedNote-related servers:`,
          redNoteEntries.map(e => ({ id: e.data.id, title: e.data.title })),
        );

        // 只有在首次加载时才添加兜底数据
        // 这样可以避免重复添加相同的数据
        if (!this.fallbackDataLoaded) {
          for (const entry of fallbackEntries) {
            // 给兜底数据一个较低的基础相似度，确保它们不会覆盖在线数据
            // 但在离线时仍能提供有用的结果
            const fallbackData = {
              ...entry.data,
              fallback: true, // 标记为兜底数据
            };
            await this.memoryEngine.addEntry(
              entry.id,
              entry.vector,
              fallbackData,
            );
          }
          this.fallbackDataLoaded = true;
          console.log(
            `[DEBUG] Successfully added ${fallbackEntries.length} fallback entries to the memory engine`,
          );
          logger.info(
            `Added ${fallbackEntries.length} fallback entries to memory engine`,
          );
        }

        this.lastFallbackLoadTime = currentTime;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        logger.error(`Error loading fallback data: ${message}`, { error });
        // 即使加载失败，也标记为已尝试加载，避免频繁重试
        this.fallbackDataLoaded = true;
        this.lastFallbackLoadTime = currentTime;
      }
    }
  }

  /**
   * 基于文本执行搜索
   */
  private async textSearch(
    query: string,
    limit: number,
  ): Promise<MCPServerResponse[]> {
    try {
      // 获取所有结果（通过内存引擎搜索，使用空向量）
      const allResults = await this.memoryEngine.search(
        new Array(384).fill(0),
        1000,
      );

      // 在内存中执行文本匹配
      const matchedResults = allResults.map(server => {
        const searchText = `${server.title} ${server.description} ${
          Array.isArray(server.categories) ? server.categories.join(' ') : ''
        } ${Array.isArray(server.tags) ? server.tags.join(' ') : ''}`.toLowerCase();

        const queryTerms = query.toLowerCase().split(/\s+/);

        // 计算匹配分数（简单的词频计数）
        let matchScore = 0;
        for (const term of queryTerms) {
          if (term.length > 2) {
            // 忽略太短的词
            const regex = new RegExp(term, 'gi');
            const matches = searchText.match(regex);
            if (matches) {
              matchScore += matches.length;
            }
          }
        }

        // 标准化分数到0-1范围
        const normalizedScore = Math.min(matchScore / 10, 1);

        return {
          ...server,
          similarity: normalizedScore,
        };
      });

      // 按匹配分数排序
      return matchedResults
        .sort((a, b) => (b.similarity || 0) - (a.similarity || 0))
        .slice(0, limit);
    } catch (error) {
      logger.error(
        `Error in text search: ${error instanceof Error ? error.message : String(error)}`,
      );
      return [];
    }
  }

  /**
   * 合并向量搜索和文本搜索结果
   */
  private mergeResults(
    vectorResults: MCPServerResponse[],
    textResults: MCPServerResponse[],
    limit: number,
  ): MCPServerResponse[] {
    // 创建结果映射，避免重复
    const resultMap = new Map<string, MCPServerResponse>();

    // 处理向量结果（70%权重）
    vectorResults.forEach(result => {
      const key = result.sourceUrl || result.title;
      resultMap.set(key, {
        ...result,
        similarity: (result.similarity || 0) * 0.7,
      });
    });

    // 合并文本结果（30%权重）
    textResults.forEach(result => {
      const key = result.sourceUrl || result.title;
      if (resultMap.has(key)) {
        // 如果已存在，合并相似度分数
        const existing = resultMap.get(key)!;
        resultMap.set(key, {
          ...existing,
          similarity:
            (existing.similarity || 0) + (result.similarity || 0) * 0.3,
        });
      } else {
        // 如果不存在，添加新条目
        resultMap.set(key, {
          ...result,
          similarity: (result.similarity || 0) * 0.3,
        });
      }
    });

    // 转换回数组并排序
    return Array.from(resultMap.values())
      .sort((a, b) => (b.similarity || 0) - (a.similarity || 0))
      .slice(0, limit);
  }

  /**
   * 应用过滤条件
   */
  private applyFilters(
    results: MCPServerResponse[],
    options: SearchOptions,
  ): MCPServerResponse[] {
    let filtered = [...results];

    // 应用最小相似度过滤
    if (options.minSimilarity !== undefined) {
      filtered = filtered.filter(
        result => (result.similarity || 0) >= (options.minSimilarity || 0),
      );
    }

    // 应用类别过滤
    if (options.categories && options.categories.length > 0) {
      filtered = filtered.filter(result => {
        if (!result.categories || result.categories.length === 0) {
          return false;
        }
        return options.categories!.some(
          category =>
            Array.isArray(result.categories) &&
            result.categories.some((c: string) =>
              c.toLowerCase().includes(category.toLowerCase()),
            ),
        );
      });
    }

    // 应用标签过滤
    if (options.tags && options.tags.length > 0) {
      filtered = filtered.filter(result => {
        if (!result.tags || result.tags.length === 0) {
          return false;
        }
        return options.tags!.some(
          tag =>
            Array.isArray(result.tags) &&
            result.tags.some((t: string) =>
              t.toLowerCase().includes(tag.toLowerCase()),
            ),
        );
      });
    }

    return filtered;
  }

  /**
   * 统一错误处理
   */
  private handleError(error: unknown, operation: string): never {
    const message = error instanceof Error ? error.message : String(error);
    logger.error(`Error in enhanced memory engine ${operation}: ${message}`, {
      error,
      operation,
      engineType: 'EnhancedMemoryVectorEngine',
    });
    throw error;
  }
}
