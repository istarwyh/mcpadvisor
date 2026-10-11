import { MCPServerResponse } from './index.js';

/**
 * Search parameter structure for advanced search.
 * Part of 202506 search interface refactor.
 */
export interface SearchParams {
  /** 任务描述 */
  taskDescription: string;
  /** 搜索关键词（可选） */
  keywords?: string[];
  /** 所需能力（可选） */
  capabilities?: string[];
}

export interface ProviderResult {
  providerName: string;
  results: MCPServerResponse[];
}

export interface RerankOptions {
  limit?: number;
  /**
   * @deprecated 最小相似度阈值
   */
  minSimilarity?: number;
  /**
   * 最小分数阈值
   */
  minScore?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface ProviderPriorities {
  [key: string]: number;
}
