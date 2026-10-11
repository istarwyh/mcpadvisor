/**
 * 本地 Meilisearch 控制器
 * 提供本地 Meilisearch 实例的完整功能
 */

import { MeiliSearch, MeiliSearchApiError } from 'meilisearch';
import { MeilisearchInstanceConfig } from '../../../config/meilisearch.js';
import logger from '../../../utils/logger.js';

class MeilisearchIndexingTaskError extends Error {
  constructor(
    taskUid: number,
    readonly code: string,
  ) {
    super(`Meilisearch indexing task ${taskUid} failed: ${code}`);
  }
}

/**
 * 本地 Meilisearch 控制器接口
 */
export interface ILocalMeilisearchController {
  search(query: string, options?: Record<string, any>): Promise<any>;
  healthCheck(): Promise<boolean>;
  addDocuments(documents: any[]): Promise<any>;
  createIndex(): Promise<any>;
  configureSearchAttributes(): Promise<void>;
}

/**
 * 本地 Meilisearch 控制器实现
 */
export class LocalMeilisearchController implements ILocalMeilisearchController {
  private client: MeiliSearch;
  private config: MeilisearchInstanceConfig;

  constructor(config: MeilisearchInstanceConfig) {
    this.config = config;
    this.client = new MeiliSearch({
      host: config.host,
      apiKey: config.masterKey || config.apiKey,
    });
  }

  /** Populate the local full-text catalog only after an explicit opt-in. */
  async indexDocuments(documents: Record<string, unknown>[]): Promise<void> {
    if (!this.config.autoIndex || documents.length === 0) return;
    const index = this.client.index(this.config.indexName);
    try {
      await index.getRawInfo();
    } catch (error) {
      if (
        !(error instanceof MeiliSearchApiError) ||
        error.cause?.code !== 'index_not_found'
      ) {
        throw error;
      }
      try {
        const task = await this.client.createIndex(this.config.indexName, {
          primaryKey: 'id',
        });
        await this.waitForIndexTask(task.taskUid);
      } catch (creationError) {
        const alreadyExists =
          (creationError instanceof MeilisearchIndexingTaskError &&
            creationError.code === 'index_already_exists') ||
          (creationError instanceof MeiliSearchApiError &&
            creationError.cause?.code === 'index_already_exists');
        if (!alreadyExists) throw creationError;
        // Another process created the index after our initial absence check.
        // Recheck it; do not suppress any other task or authorization failure.
        await index.getRawInfo();
      }
    }
    const settingsTask = await index.updateSettings({
      searchableAttributes: ['title', 'description', 'categories', 'tags'],
      displayedAttributes: [
        'id',
        'catalog_id',
        'title',
        'description',
        'github_url',
        'categories',
        'tags',
        'installations',
      ],
      filterableAttributes: ['categories', 'tags'],
      sortableAttributes: ['title'],
    });
    await this.waitForIndexTask(settingsTask.taskUid);
    const documentsTask = await index.addDocuments(documents);
    await this.waitForIndexTask(documentsTask.taskUid);
  }

  private async waitForIndexTask(taskUid: number): Promise<void> {
    const task = await this.client.tasks.waitForTask(taskUid, {
      timeout: 10_000,
      interval: 50,
    });
    if (task.status !== 'succeeded') {
      throw new MeilisearchIndexingTaskError(
        taskUid,
        task.error?.code ?? task.status,
      );
    }
  }

  /**
   * 搜索文档
   */
  async search(query: string, options: Record<string, any> = {}): Promise<any> {
    try {
      const index = this.client.index(this.config.indexName);
      const results = await index.search(query, {
        limit: 10,
        ...options,
      });

      logger.debug(
        `Local Meilisearch search for "${query}" returned ${results.hits.length} results`,
      );
      return results;
    } catch (error) {
      logger.error('Local Meilisearch search failed:', error);
      throw error;
    }
  }

  /**
   * 健康检查
   */
  async healthCheck(): Promise<boolean> {
    try {
      const result = await this.client.health();
      logger.debug('Local Meilisearch health check successful:', result);
      return true;
    } catch (error) {
      logger.warn('Local Meilisearch health check failed:', error);
      return false;
    }
  }

  /**
   * 添加文档
   */
  async addDocuments(documents: any[]): Promise<any> {
    try {
      const index = this.client.index(this.config.indexName);
      const task = await index.addDocuments(documents);
      logger.info(
        `Added ${documents.length} documents to local Meilisearch, task: ${task.taskUid}`,
      );
      return task;
    } catch (error) {
      logger.error('Failed to add documents to local Meilisearch:', error);
      throw error;
    }
  }

  /**
   * 获取索引信息
   */
  async getIndexInfo(): Promise<any> {
    try {
      const index = this.client.index(this.config.indexName);
      const info = await index.getRawInfo();
      return info;
    } catch (error) {
      logger.error('Failed to get index info from local Meilisearch:', error);
      throw error;
    }
  }

  /**
   * 创建索引
   */
  async createIndex(): Promise<any> {
    try {
      const task = await this.client.createIndex(this.config.indexName, {
        primaryKey: 'id',
      });
      logger.info(
        `Created index ${this.config.indexName}, task: ${task.taskUid}`,
      );
      return task;
    } catch (error) {
      logger.error('Failed to create index in local Meilisearch:', error);
      throw error;
    }
  }

  /**
   * 配置搜索属性
   */
  async configureSearchAttributes(): Promise<void> {
    try {
      const index = this.client.index(this.config.indexName);

      await Promise.all([
        index.updateSearchableAttributes([
          'title',
          'description',
          'categories',
          'tags',
          'github_url',
        ]),
        index.updateDisplayedAttributes([
          'id',
          'title',
          'description',
          'github_url',
          'categories',
          'tags',
          'installations',
        ]),
        index.updateSortableAttributes(['title']),
        index.updateFilterableAttributes(['categories', 'tags']),
      ]);

      logger.info(
        'Local Meilisearch search attributes configured successfully',
      );
    } catch (error) {
      logger.error(
        'Failed to configure search attributes in local Meilisearch:',
        error,
      );
      throw error;
    }
  }
}
