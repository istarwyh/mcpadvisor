import type { SearchParams } from './search.js';

export interface MCPServerResponse {
  id?: string;
  title: string;
  description: string;
  sourceUrl: string;
  /**
   * @deprecated 搜索相似度，已废弃
   */
  similarity: number;
  /**
   * 用于排序的分数，提供了一个统一的度量标准，方便按统一标准进行加权、合并和重新排序
   */
  score?: number;
  installations?: Record<string, any>;
  /**
   * 服务器分类
   * 可以是字符串数组或逗号分隔的字符串
   */
  categories?: string[] | string;
  /**
   * 服务器标签
   * 可以是字符串数组或逗号分隔的字符串
   */
  tags?: string[] | string;
}

export interface SearchProvider {
  search(params: SearchParams): Promise<MCPServerResponse[]>;
}

/**
 * Search options for configuring search behavior
 */
export interface SearchOptions {
  limit?: number;
  minSimilarity?: number;
  /**
   * 排序字段
   */
  sortBy?: string;
  /**
   * 排序方向，默认为降序 (desc)
   */
  sortOrder?: 'asc' | 'desc';
}
