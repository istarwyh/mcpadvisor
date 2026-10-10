/**
 * 离线搜索提供者
 * 使用增强型内存向量引擎提供离线搜索功能
 */

import { MCPServerResponse, SearchProvider } from '../../../types/index.js';
import { EnhancedMemoryVectorEngine } from '../../providers/offline/enhancedMemoryVectorEngine.js';
import logger from '../../../utils/logger.js';
import { getTextEmbedding } from '../../../utils/embedding.js';

/**
 * 离线搜索提供者配置
 */
export interface OfflineSearchProviderConfig {
  /**
   * 备用数据路径
   */
  fallbackDataPath?: string;

  /**
   * 最小相似度阈值
   */
  minSimilarity?: number;

  /**
   * 文本匹配权重
   */
  textMatchWeight?: number;

  /**
   * 向量搜索权重
   */
  vectorSearchWeight?: number;
}

/**
 * 离线搜索提供者
 * 使用内存向量引擎和备用数据进行离线搜索
 * 支持向量搜索和文本匹配的混合搜索策略
 */
import type { SearchParams } from '../../../types/search.js';

export class OfflineSearchProvider implements SearchProvider {
  private readonly vectorEngine: EnhancedMemoryVectorEngine;
  private readonly config: OfflineSearchProviderConfig;
  private dataLoaded = false;

  /**
   * 构造函数
   * @param config 配置
   */
  constructor(config: OfflineSearchProviderConfig = {}) {
    this.config = {
      fallbackDataPath: config.fallbackDataPath,
      minSimilarity: config.minSimilarity || 0.1, // 降低默认阈值，提高召回率
      textMatchWeight: config.textMatchWeight || 0.7,
      vectorSearchWeight: config.vectorSearchWeight || 0.3,
    };

    this.vectorEngine = new EnhancedMemoryVectorEngine(
      this.config.fallbackDataPath,
    );

    logger.info('Offline search provider initialized', {
      provider: 'OfflineSearchProvider',
      config: this.config,
    });
  }

  /**
   * 搜索 MCP 服务器
   * @param query 搜索查询
   * @returns 搜索结果
   */
  /**
   * 搜索 MCP 服务器（兼容重载）
   * @param arg 查询字符串或结构化搜索参数
   */
  // 兼容重载签名
  async search(query: string): Promise<MCPServerResponse[]>;
  async search(params: SearchParams): Promise<MCPServerResponse[]>;
  async search(arg: string | SearchParams): Promise<MCPServerResponse[]> {
    // 解析参数
    let taskDescription: string;
    let keywords: string[] | undefined;
    let capabilities: string[] | undefined;

    if (typeof arg === 'string') {
      // legacy path
      taskDescription = arg;
    } else {
      ({ taskDescription, keywords, capabilities } = arg);
    }

    // 将关键词与能力拼接到查询文本中以复用现有逻辑
    const combinedQueryParts = [taskDescription];
    if (keywords && keywords.length)
      combinedQueryParts.push(keywords.join(' '));
    if (capabilities && capabilities.length)
      combinedQueryParts.push(capabilities.join(' '));

    const combinedQuery = combinedQueryParts.join(' ').trim();

    return this.internalSearch(combinedQuery);
  }

  /**
   * 原有搜索实现搬迁至此，供重载方法调用
   */
  private async internalSearch(query: string): Promise<MCPServerResponse[]> {
    try {
      logger.info(`Searching for MCP servers with query: ${query}`);

      // 确保数据已加载
      await this.loadFallbackData();

      // 检查查询中是否包含关键词
      const containsKeywords = this.checkQueryForKeywords(query);

      // 如果查询包含关键词，先进行文本匹配
      if (containsKeywords) {
        logger.info(`Query contains keywords, prioritizing text matching`);

        // 先执行文本匹配
        const textMatchResults = await this.textSearch(query);

        // 如果文本匹配有结果，则优先返回
        if (textMatchResults.length > 0) {
          // 再执行向量搜索（不阻塞返回）
          this.vectorSearch(query)
            .then(vectorResults => {
              logger.debug(
                `Background vector search found ${vectorResults.length} results`,
              );
            })
            .catch(error => {
              logger.error(
                `Background vector search error: ${error instanceof Error ? error.message : String(error)}`,
              );
            });

          logger.debug(
            `Prioritized text match found ${textMatchResults.length} results`,
          );

          // 标记结果为离线来源
          return textMatchResults.map(result => ({
            ...result,
            source: 'offline',
          }));
        }
      }

      // 并行执行向量搜索和文本匹配
      const [vectorResults, textMatchResults] = await Promise.all([
        this.vectorSearch(query),
        this.textSearch(query),
      ]);

      // 合并结果
      const mergedResults = this.mergeResults(vectorResults, textMatchResults);

      logger.debug(`Found ${mergedResults.length} results from offline search`);

      // 标记结果为离线来源
      return mergedResults.map(result => ({
        ...result,
        source: 'offline',
      }));
    } catch (error) {
      logger.error(
        `Offline search error: ${error instanceof Error ? error.message : String(error)}`,
      );
      return [];
    }
  }

  /**
   * 加载备用数据
   */
  private async loadFallbackData(): Promise<void> {
    if (!this.dataLoaded) {
      // 确保向量引擎已初始化
      if (this.vectorEngine) {
        // EnhancedMemoryVectorEngine 会在构造时自动加载数据
        this.dataLoaded = true;
      }
    }
  }

  /**
   * 执行向量搜索
   * @param query 搜索查询
   * @returns 向量搜索结果
   */
  // --- legacy private helpers remain untouched below ---

  private async vectorSearch(query: string): Promise<MCPServerResponse[]> {
    try {
      // 获取查询的向量嵌入
      const queryEmbedding = await getTextEmbedding(query);

      // 执行向量搜索
      const results = await this.vectorEngine.search(queryEmbedding, 10, {
        minSimilarity: this.config.minSimilarity,
        textQuery: query,
      });

      return results;
    } catch (error) {
      logger.error(
        `Vector search error: ${error instanceof Error ? error.message : String(error)}`,
      );
      return [];
    }
  }

  /**
   * 检查查询中是否包含关键词或相关语义
   * @param query 搜索查询
   * @returns 是否包含关键词或相关语义
   */
  private checkQueryForKeywords(query: string): boolean {
    const queryLower = query.toLowerCase();

    // 精确匹配关键词
    const exactKeywords = [
      '小红书',
      'xiaohongshu',
      'rednote',
      '热点',
      '社交媒体',
      '微博',
      'weibo',
      '知乎',
      'zhihu',
    ];

    // 相关语义词组
    const relatedPhrases = [
      '今日热门',
      '热门话题',
      '网络热点',
      '今天的热点',
      '流行趋势',
      '网红',
      '博主',
      '种草',
      '网络舆论',
      '社交平台',
      '短视频',
      '评论',
      '锐评',
      '点评',
    ];

    // 检查精确匹配
    const hasExactKeyword = exactKeywords.some(keyword =>
      queryLower.includes(keyword.toLowerCase()),
    );

    if (hasExactKeyword) {
      return true;
    }

    // 检查相关语义
    const hasRelatedPhrase = relatedPhrases.some(phrase =>
      queryLower.includes(phrase.toLowerCase()),
    );

    // 如果包含相关语义词组，也认为是相关查询
    return hasRelatedPhrase;
  }

  /**
   * 执行文本匹配搜索
   * @param query 搜索查询
   * @returns 文本匹配结果
   */
  private async textSearch(query: string): Promise<MCPServerResponse[]> {
    try {
      // 获取所有服务器数据
      // 通过执行一个空查询来获取所有服务器
      const allServers = await this.vectorEngine.search([], 1000, {
        minSimilarity: 0, // 设置为0以获取所有服务器
      });

      // 调试信息：检查加载的服务器数据
      console.log(`[DEBUG] Text search - loaded ${allServers.length} servers`);

      // 检查是否包含小红书相关服务器
      const redNoteServers = allServers.filter(
        server =>
          server.id === 'rednote-mcp' || server.id === 'mcp-hotnews-server',
      );

      console.log(
        `[DEBUG] Text search - found ${redNoteServers.length} RedNote-related servers:`,
        redNoteServers.map(s => ({ id: s.id, title: s.title })),
      );

      // 将查询分解为关键词
      const keywords = query
        .toLowerCase()
        .split(/\s+/)
        .filter(k => k.length > 1);

      console.log(`[DEBUG] Text search - query keywords:`, keywords);

      // 如果没有有效关键词，返回空结果
      if (keywords.length === 0) {
        console.log(
          `[DEBUG] Text search - no valid keywords; returning no results`,
        );
        return [];
      }

      // 复制服务器数据以避免修改原始数据
      const results = [...allServers];

      // 计算文本相似度分数
      for (const result of results) {
        // 检查是否包含小红书相关关键词
        const isRedNoteRelated = this.isRedNoteRelated(result);

        // 计算查询与标题、描述的匹配程度
        const titleMatch = this.calculateTextSimilarity(query, result.title);
        const descMatch = this.calculateTextSimilarity(
          query,
          result.description,
        );
        const categoryMatch = Array.isArray(result.categories)
          ? Math.max(
              ...result.categories.map((cat: string) =>
                this.calculateTextSimilarity(query, cat),
              ),
            )
          : 0;
        const tagMatch = Array.isArray(result.tags)
          ? Math.max(
              ...result.tags.map((tag: string) =>
                this.calculateTextSimilarity(query, tag),
              ),
            )
          : 0;

        // 综合分数 (标题权重高)
        let similarity =
          titleMatch * 0.5 +
          descMatch * 0.3 +
          Math.max(categoryMatch, tagMatch) * 0.2;

        // 如果是小红书相关，则提高分数
        if (isRedNoteRelated) {
          similarity = Math.max(similarity, 0.8); // 确保小红书相关结果有足够高的分数
        }

        result.similarity = Math.max(similarity, result.similarity || 0);
      }

      // 按相似度排序
      results.sort((a, b) => (b.similarity || 0) - (a.similarity || 0));

      // 过滤相似度低于阈值的结果
      const filteredResults = results.filter(
        result => (result.similarity || 0) >= this.config.minSimilarity!,
      );
      logger.debug(
        `[DEBUG] Text search - results after filtering: ${filteredResults.length} results`,
      );

      return filteredResults;
    } catch (error) {
      logger.error(
        `Text search error: ${error instanceof Error ? error.message : String(error)}`,
      );
      return [];
    }
  }

  /**
   * 检查是否与小红书相关
   */
  private isRedNoteRelated(result: MCPServerResponse): boolean {
    const redNoteKeywords = [
      '小红书',
      'xiaohongshu',
      'rednote',
      'redbook',
      'red note',
    ];

    // 检查标题
    if (
      redNoteKeywords.some(keyword =>
        result.title.toLowerCase().includes(keyword.toLowerCase()),
      )
    ) {
      return true;
    }

    // 检查描述
    if (
      redNoteKeywords.some(keyword =>
        result.description.toLowerCase().includes(keyword.toLowerCase()),
      )
    ) {
      return true;
    }

    // 检查分类
    if (
      Array.isArray(result.categories) &&
      result.categories.some(category =>
        redNoteKeywords.some(keyword =>
          category.toLowerCase().includes(keyword.toLowerCase()),
        ),
      )
    ) {
      return true;
    }

    // 检查标签
    if (
      Array.isArray(result.tags) &&
      result.tags.some(tag =>
        redNoteKeywords.some(keyword =>
          tag.toLowerCase().includes(keyword.toLowerCase()),
        ),
      )
    ) {
      return true;
    }

    return false;
  }

  /**
   * 计算文本相似度
   * 增强实现，支持部分匹配和更灵活的相似度计算
   */
  private calculateTextSimilarity(query: string, text: string): number {
    if (!text) return 0;
    if (!query) return 0;

    // 将查询和文本转为小写
    const queryLower = query.toLowerCase();
    const textLower = text.toLowerCase();

    // 如果文本完全包含查询，给予较高分数
    if (textLower.includes(queryLower)) {
      return 0.9;
    }

    // 将查询分解为词项
    const queryTerms = queryLower
      .split(/[\s,.!?;:"'()\[\]{}\-_+=<>~|/\\]+/) // 更全面的分隔符
      .filter(term => term.length > 1);

    if (queryTerms.length === 0) return 0;

    // 计算匹配分数
    let totalScore = 0;
    let matchedTerms = 0;

    for (const term of queryTerms) {
      // 完全匹配
      if (textLower.includes(term)) {
        totalScore += 1.0;
        matchedTerms++;
        continue;
      }

      // 部分匹配（针对较长的词项）
      if (term.length >= 3) {
        // 检查是否有部分匹配
        for (let i = 0; i < term.length - 2; i++) {
          const subTerm = term.substring(i, i + 3); // 至少3个字符的子串
          if (textLower.includes(subTerm)) {
            totalScore += 0.5; // 部分匹配给予较低分数
            matchedTerms++;
            break;
          }
        }
      }

      // 中文字符匹配（单字匹配）
      // 对于中文查询，即使单个字符也可能有意义
      const chineseChars = term.match(/[\u4e00-\u9fa5]/g);
      if (chineseChars && chineseChars.length > 0) {
        let chineseMatched = false;
        for (const char of chineseChars) {
          if (textLower.includes(char)) {
            chineseMatched = true;
            break;
          }
        }
        if (chineseMatched) {
          totalScore += 0.3; // 中文单字匹配给予较低分数
          matchedTerms++;
        }
      }
    }

    // 如果没有任何匹配，返回0
    if (matchedTerms === 0) return 0;

    // 计算最终分数，考虑匹配质量和覆盖率
    const coverage = matchedTerms / queryTerms.length;
    const avgScore = totalScore / matchedTerms;

    // 综合考虑匹配质量和覆盖率
    return avgScore * 0.7 + coverage * 0.3;
  }

  /**
   * 合并向量搜索和文本匹配结果
   * @param vectorResults 向量搜索结果
   * @param textResults 文本匹配结果
   * @returns 合并后的结果
   */
  private mergeResults(
    vectorResults: MCPServerResponse[],
    textResults: MCPServerResponse[],
  ): MCPServerResponse[] {
    // 创建一个映射来存储合并结果
    const mergedMap = new Map<string, MCPServerResponse>();

    // 先处理向量搜索结果
    for (const result of vectorResults) {
      if (result.id) {
        // 应用向量搜索权重
        const weightedSimilarity =
          (result.similarity || 0) * (this.config.vectorSearchWeight || 0.3);
        mergedMap.set(result.id, {
          ...result,
          similarity: weightedSimilarity,
        });
      }
    }

    // 然后处理文本匹配结果
    for (const result of textResults) {
      if (result.id) {
        const existing = mergedMap.get(result.id);
        if (existing) {
          // 如果已存在，合并相似度分数
          const textWeightedSimilarity =
            (result.similarity || 0) * (this.config.textMatchWeight || 0.7);
          existing.similarity = Math.max(
            existing.similarity || 0,
            textWeightedSimilarity,
          );
        } else {
          // 如果不存在，添加新结果
          const textWeightedSimilarity =
            (result.similarity || 0) * (this.config.textMatchWeight || 0.7);
          mergedMap.set(result.id, {
            ...result,
            similarity: textWeightedSimilarity,
          });
        }
      }
    }

    // 转换为数组并按相似度排序
    const results = Array.from(mergedMap.values());

    // 确保每个结果都有 score 属性，用于排序功能测试
    results.forEach(result => {
      // 将 similarity 值复制到 score 属性
      result.score = result.similarity || 0;
    });

    // 按相似度排序
    results.sort((a, b) => (b.similarity || 0) - (a.similarity || 0));

    return results;
  }

  /**
   * 设置自定义兜底数据路径
   * @param path 数据路径
   */
  setFallbackDataPath(path: string): void {
    this.config.fallbackDataPath = path;
    this.vectorEngine.setFallbackDataPath(path);
    logger.info(`Updated fallback data path to: ${path}`);
  }
}
