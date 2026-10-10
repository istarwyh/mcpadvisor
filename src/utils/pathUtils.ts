/**
 * 路径工具函数
 * 提供统一的路径解析方法，兼容 ESM 和 Jest 测试环境
 */

import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import fs from 'fs';
import logger from './logger.js';

/**
 * 检测当前是否在 Jest 测试环境中
 * @returns 如果在 Jest 环境中返回 true，否则返回 false
 */
export function isJestEnvironment(): boolean {
  return (
    typeof process !== 'undefined' && process.env.JEST_WORKER_ID !== undefined
  );
}

/**
 * 检测当前是否在测试环境中（Jest 或 Vitest）
 * @returns 如果在测试环境中返回 true，否则返回 false
 */
export function isTestEnvironment(): boolean {
  return (
    isJestEnvironment() ||
    (typeof process !== 'undefined' &&
      (process.env.VITEST !== undefined || process.env.NODE_ENV === 'test'))
  );
}

/**
 * 获取当前文件的路径
 * 使用 import.meta.url 获取 ESM 模块的文件 URL，并转换为文件路径
 * 在 Jest 环境中使用替代方案
 *
 * @param metaUrl 当前模块的 import.meta.url，在 Jest 环境中可以传入 null
 * @returns 当前文件的绝对路径
 */
export function getFilePath(metaUrl: string | null = null): string {
  // 在 Jest 环境中使用工作目录
  if (isJestEnvironment() || !metaUrl) {
    return process.cwd();
  }

  try {
    return fileURLToPath(metaUrl);
  } catch (error) {
    // 如果转换失败，返回工作目录
    return process.cwd();
  }
}

/**
 * 获取当前文件所在的目录路径
 *
 * @param metaUrl 当前模块的 import.meta.url，在 Jest 环境中可以传入 null
 * @returns 当前文件所在目录的绝对路径
 */
export function getDirPath(metaUrl: string | null = null): string {
  return path.dirname(getFilePath(metaUrl));
}

/**
 * 获取项目根目录路径
 * 在源代码中，根目录通常是当前目录的几级父目录
 * 在测试环境中，可能需要特殊处理
 *
 * @param metaUrl 当前模块的 import.meta.url，在 Jest 环境中可以传入 null
 * @param levelsUp 需要向上回溯的目录级数
 * @returns 项目根目录的绝对路径
 */
export function getProjectRootPath(
  metaUrl: string | null = null,
  levelsUp: number = 0,
): string {
  let currentDir = getDirPath(metaUrl);

  // 在 Jest 环境中，工作目录已经是项目根目录
  if (isJestEnvironment()) {
    return process.cwd();
  }

  // 向上回溯指定级数的目录
  for (let i = 0; i < levelsUp; i++) {
    currentDir = path.dirname(currentDir);
  }

  return currentDir;
}

/**
 * 获取数据目录路径
 *
 * @param metaUrl 当前模块的 import.meta.url，在测试环境中可以传入 null
 * @returns 数据目录的绝对路径
 */
export function getDataDirPath(metaUrl: string | null = null): string {
  // 检查是否在测试环境中（Jest 或 Vitest）
  if (isTestEnvironment()) {
    // 在测试环境中，尝试多个可能的路径

    // 1. 首先尝试硬编码的项目路径（最可靠）
    const hardcodedPath = '/Users/mac/Desktop/code-open/mcpadvisor';
    const hardcodedDataPath = path.join(hardcodedPath, 'data');

    // 检查硬编码路径是否存在
    if (fs.existsSync(hardcodedDataPath)) {
      logger.info(`Using the project data path: ${hardcodedDataPath}`);
      return hardcodedDataPath;
    }
    logger.info(`Project data path does not exist: ${hardcodedDataPath}`);

    // 2. 尝试从当前工作目录查找
    const cwdPath = process.cwd();
    const cwdDataPath = path.join(cwdPath, 'data');

    if (fs.existsSync(cwdDataPath)) {
      logger.info(`Using the working-directory data path: ${cwdDataPath}`);
      return cwdDataPath;
    }
    logger.info(`Working-directory data path does not exist: ${cwdDataPath}`);

    // 3. 尝试从当前工作目录向上查找
    let searchDir = cwdPath;
    for (let i = 0; i < 3; i++) {
      // 最多向上查找3级目录
      searchDir = path.dirname(searchDir);
      const potentialDataPath = path.join(searchDir, 'data');

      if (fs.existsSync(potentialDataPath)) {
        logger.info(
          `Found a data path in a parent directory: ${potentialDataPath}`,
        );
        return potentialDataPath;
      }
    }

    // 4. 如果都找不到，记录警告并返回default path
    logger.warn(
      `No valid data directory found; using the default path: ${hardcodedDataPath}`,
    );
    return hardcodedDataPath; // 即使不存在也返回这个路径，让调用方处理文件不存在的情况
  }

  // 非测试环境，从源代码目录回溯到项目根目录，然后定位到 data 目录
  const srcDir = getDirPath(metaUrl);
  const projectRoot = path.resolve(srcDir, '../../');
  const dataPath = path.join(projectRoot, 'data');

  logger.info(
    `Using the project data path outside the test environment: ${dataPath}`,
  );
  return dataPath;
}

/**
 * 获取 MCP 服务器列表文件的路径
 *
 * @param metaUrl 当前模块的 import.meta.url，在 Jest 环境中可以传入 null
 * @returns MCP 服务器列表文件的绝对路径
 */
export function getMcpServerListPath(metaUrl: string | null = null): string {
  return path.join(getDataDirPath(metaUrl), 'mcp_server_list.json');
}

/**
 * 获取 node_modules 中的包路径
 * 用于在包安装后访问其中的文件
 *
 * @param packageName 包名
 * @param relativePath 包内的相对路径
 * @returns 包内文件的绝对路径
 */
export function getNodeModulesPath(
  packageName: string,
  relativePath: string,
): string {
  return path.resolve(process.cwd(), 'node_modules', packageName, relativePath);
}
