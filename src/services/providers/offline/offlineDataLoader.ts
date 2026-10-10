/**
 * 离线数据加载器
 * 负责从本地文件加载兜底数据，确保在网络不可用时仍能提供推荐
 */

import fs from 'fs';
import path from 'path';
import logger from '../../../utils/logger.js';
import { getTextEmbedding } from '../../../utils/embedding.js';
import { MCPServerResponse } from '../../../types/index.js';
import { normalizeVector } from '../../../utils/vectorUtils.js';
import {
  getMcpServerListPath,
  getNodeModulesPath,
} from '../../../utils/pathUtils.js';

/**
 * 默认兜底数据路径
 * 使用路径工具获取路径，确保在打包后和测试环境中都能正确解析
 * 在 Jest 环境中传入 null，路径工具会自动处理
 */
const DEFAULT_FALLBACK_DATA_PATH = getMcpServerListPath(null);

// 备用路径，用于在default path无法访问时尝试
const ALTERNATIVE_FALLBACK_DATA_PATH = getNodeModulesPath(
  '@xiaohui-wang/mcpadvisor',
  'data/mcp_server_list.json',
);

/**
 * 离线数据加载器类
 */
export class OfflineDataLoader {
  private fallbackDataPath: string;
  private disableFallbackPaths: boolean;

  /**
   * 构造函数
   * @param fallbackDataPath 可选的自定义兜底数据路径
   * @param options 选项对象，包含 disableFallbackPaths 属性
   */
  constructor(
    fallbackDataPath?: string,
    options: { disableFallbackPaths?: boolean } = {},
  ) {
    this.fallbackDataPath =
      fallbackDataPath || getMcpServerListPath() || DEFAULT_FALLBACK_DATA_PATH;
    this.disableFallbackPaths = options.disableFallbackPaths || false;
    logger.info(
      `Offline data loader initialized with path: ${this.fallbackDataPath}`,
    );
  }

  /**
   * 加载兜底数据
   * @returns 兜底数据数组
   */
  async loadFallbackData(): Promise<MCPServerResponse[]> {
    try {
      logger.info(
        `Attempting to load fallback data from: ${this.fallbackDataPath}`,
      );

      // 检查主要文件路径是否存在
      if (!fs.existsSync(this.fallbackDataPath)) {
        logger.warn(
          `Fallback data file not found at primary path: ${this.fallbackDataPath}`,
        );

        // 如果禁用了路径兵底逻辑，直接返回空数组
        if (this.disableFallbackPaths) {
          logger.info('Fallback paths are disabled, returning empty array');
          return [];
        }

        // 尝试备用路径
        if (
          this.fallbackDataPath === DEFAULT_FALLBACK_DATA_PATH &&
          fs.existsSync(ALTERNATIVE_FALLBACK_DATA_PATH)
        ) {
          logger.info(
            `Trying alternative fallback data path: ${ALTERNATIVE_FALLBACK_DATA_PATH}`,
          );
          this.fallbackDataPath = ALTERNATIVE_FALLBACK_DATA_PATH;
        } else {
          // 尝试直接查找硬编码路径
          const hardcodedPath =
            '/Users/mac/Desktop/code-open/mcpadvisor/data/mcp_server_list.json';
          if (fs.existsSync(hardcodedPath)) {
            logger.info(`Found data file at hardcoded path: ${hardcodedPath}`);
            this.fallbackDataPath = hardcodedPath;
          } else {
            // 尝试在当前目录及其父目录中查找
            let currentDir = process.cwd();
            let found = false;

            // 最多向上查找3级目录
            for (let i = 0; i < 4 && !found; i++) {
              const potentialPath = path.join(
                currentDir,
                'data',
                'mcp_server_list.json',
              );
              logger.debug(`Checking for data file at: ${potentialPath}`);

              if (fs.existsSync(potentialPath)) {
                logger.info(`Found data file at: ${potentialPath}`);
                this.fallbackDataPath = potentialPath;
                found = true;
                break;
              }

              // 向上一级目录
              currentDir = path.dirname(currentDir);
            }

            if (!found) {
              logger.error('No fallback data file found at any path');
              return [];
            }
          }
        }
      }

      // 读取并解析JSON文件
      const rawData = fs.readFileSync(this.fallbackDataPath, 'utf8');
      const parsedData = JSON.parse(rawData);

      // 增加调试信息：检查原始数据中是否包含小红书相关服务器
      const redNoteServers = parsedData.filter(
        (item: any) =>
          item.id === 'rednote-mcp' || item.id === 'mcp-hotnews-server',
      );

      logger.info(
        `Found ${redNoteServers.length} RedNote related servers in raw data:`,
        {
          redNoteServers: redNoteServers.map((s: any) => ({
            id: s.id,
            name: s.name,
          })),
        },
      );

      // 转换为MCPServerResponse格式
      const serverResponses = parsedData.map((item: any) => ({
        id: item.id, // 保留服务器的 id 字段
        title: item.display_name || item.name,
        name: item.name, // 添加name字段，这可能是搜索时用到的
        display_name: item.display_name, // 添加display_name字段
        description: item.description || '',
        sourceUrl: item.repository?.url || item.homepage || '',
        categories: item.categories || [],
        tags: item.tags || [],
      }));

      logger.info(
        `Successfully loaded ${serverResponses.length} fallback MCP servers from ${this.fallbackDataPath}`,
      );
      return serverResponses;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error(`Error loading fallback data: ${message}`, {
        error,
        path: this.fallbackDataPath,
      });

      // 如果主路径失败，尝试备用路径
      if (
        this.fallbackDataPath !== ALTERNATIVE_FALLBACK_DATA_PATH &&
        this.fallbackDataPath === DEFAULT_FALLBACK_DATA_PATH
      ) {
        try {
          logger.info(
            `Trying alternative fallback data path after error: ${ALTERNATIVE_FALLBACK_DATA_PATH}`,
          );
          this.fallbackDataPath = ALTERNATIVE_FALLBACK_DATA_PATH;
          return await this.loadFallbackData(); // 递归调用自身尝试备用路径
        } catch (alternativeError) {
          logger.error(
            `Error loading from alternative path: ${String(alternativeError)}`,
          );
        }
      }

      return [];
    }
  }

  /**
   * 加载兜底数据并生成嵌入向量
   * @returns 带有嵌入向量的兜底数据
   */
  async loadFallbackDataWithEmbeddings(): Promise<
    {
      id: string;
      vector: number[];
      data: MCPServerResponse;
    }[]
  > {
    try {
      logger.info(`Loading fallback data and generating embeddings`);
      const serverResponses = await this.loadFallbackData();
      logger.info(`Loaded ${serverResponses.length} raw server records`);

      // 检查是否包含小红书相关服务器
      const redNoteServers = serverResponses.filter(
        server =>
          server.id === 'rednote-mcp' || server.id === 'mcp-hotnews-server',
      );

      logger.info(
        `Raw data includes ${redNoteServers.length} RedNote-related servers:`,
        redNoteServers.map(s => ({ id: s.id, title: s.title })),
      );

      const result = [];

      // 如果没有服务器数据，直接返回空结果
      if (serverResponses.length === 0) {
        logger.info(`No server data is available; returning no results`);
        return [];
      }

      logger.info(
        `Generating embeddings for ${serverResponses.length} servers`,
      );
      for (const server of serverResponses) {
        try {
          // 生成文本用于嵌入
          const textForEmbedding = `${server.title}. ${server.description}. ${
            Array.isArray(server.categories) ? server.categories.join(', ') : ''
          }. ${Array.isArray(server.tags) ? server.tags.join(', ') : ''}`;

          // 获取嵌入向量
          logger.debug(
            `Server ${server.id || server.title} embedding generation`,
          );
          const vector = await getTextEmbedding(textForEmbedding);

          // 归一化向量
          const normalizedVector = normalizeVector(vector);

          // 使用github_url作为唯一ID
          const id = server.sourceUrl || `fallback-${server.title}`;

          result.push({
            id,
            vector: normalizedVector,
            data: server,
          });
        } catch (embeddingError) {
          logger.error(
            `Server ${server.id || server.title} embedding generation failed:`,
            embeddingError,
          );
          logger.error(
            `Error generating embedding for server ${server.title}`,
            {
              error: embeddingError,
              server,
            },
          );
          // 继续处理下一个服务器
        }
      }

      logger.info(`Generated embeddings for ${result.length} fallback servers`);
      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error(`Error loading fallback data with embeddings: ${message}`, {
        error,
      });
      return [];
    }
  }

  /**
   * 设置自定义兜底数据路径
   * @param newPath 新的兜底数据路径
   */
  setFallbackDataPath(newPath: string): void {
    this.fallbackDataPath = newPath;
    logger.info(`Updated fallback data path to: ${newPath}`);
  }
}
