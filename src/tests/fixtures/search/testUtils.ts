import { MCPServerResponse } from '../../../types/index.js';

// 类型守卫，确保对象具有正确格式的 tags 属性
function hasValidTags(result: any): result is { tags: string[] } {
  return (
    Array.isArray(result.tags) &&
    result.tags.every((tag: any) => typeof tag === 'string')
  );
}

// 类型守卫，检查对象是否具有 score 属性
function hasScore(result: any): result is { score: number } {
  return 'score' in result && typeof result.score === 'number';
}

/**
 * 检查结果中是否包含指定的服务器名称
 */
export function containsServerNames(
  results: MCPServerResponse[],
  serverNames: string[],
): { contains: boolean; missing: string[]; found: string[] } {
  if (!results || !Array.isArray(results) || results.length === 0) {
    return { contains: false, missing: [...serverNames], found: [] };
  }

  const foundServers: string[] = [];
  const missingServers: string[] = [];

  // 检查每个需要验证的服务器名称
  for (const serverName of serverNames) {
    const found = results.some(result => {
      // 使用类型断言来处理可能的属性
      const serverInfo = result as any;
      return (
        serverInfo.id === serverName ||
        serverInfo.name === serverName ||
        serverInfo.display_name === serverName
      );
    });

    if (found) {
      foundServers.push(serverName);
    } else {
      missingServers.push(serverName);
    }
  }

  return {
    contains: missingServers.length === 0,
    missing: missingServers,
    found: foundServers,
  };
}

/**
 * 检查结果中是否包含指定关键词
 */
export function containsKeywords(
  results: MCPServerResponse[],
  keywords: string[],
): { contains: boolean; matchedItems: MCPServerResponse[] } {
  if (!results || !Array.isArray(results)) {
    return { contains: false, matchedItems: [] };
  }

  const lowerKeywords = keywords.map(k => k.toLowerCase());

  const matchedItems = results.filter(result => {
    if (!result) return false;

    const title = result.title?.toLowerCase() || '';
    const description = result.description?.toLowerCase() || '';

    // 处理 tags 属性，确保是字符串数组
    let tags: string[] = [];
    if (hasValidTags(result)) {
      tags = result.tags.map(t => t.toLowerCase());
    } else if (result.tags) {
      // 如果 tags 存在但不是字符串数组，则尝试转换
      tags = [String(result.tags)].flat().map(t => t.toLowerCase());
    }

    return lowerKeywords.some(
      keyword =>
        title.includes(keyword) ||
        description.includes(keyword) ||
        tags.some(tag => tag.includes(keyword)),
    );
  });

  return {
    contains: matchedItems.length > 0,
    matchedItems,
  };
}

/**
 * 创建搜索测试函数
 */
export function createSearchTest(
  testCase: {
    name: string;
    query: string;
    options: any;
    textWeight?: number;
    expectedKeywords: string[];
    expectedServerNames?: string[];
    description: string;
    skip?: boolean;
  },
  searchFn: (
    query: string,
    options: any,
    fallbackPath: string,
    textWeight?: number,
  ) => Promise<MCPServerResponse[]>,
  fallbackPath: string,
) {
  const testFn = async () => {
    const {
      query,
      options,
      textWeight,
      expectedKeywords,
      expectedServerNames,
    } = testCase;

    try {
      // 执行搜索
      const results = await searchFn(query, options, fallbackPath, textWeight);

      // 基础断言
      expect(results).toBeDefined();
      expect(Array.isArray(results)).toBe(true);

      // 记录测试信息
      console.log(`[${testCase.name}] 搜索结果数量: ${results.length}`);

      // 如果有结果，进行验证
      if (results.length > 0) {
        // 输出服务器列表，便于调试
        console.log(
          `[${testCase.name}] 返回的服务器:`,
          results.map((item: any) => ({
            id: item.id,
            name: item.name || '',
            display_name: item.display_name || '',
          })),
        );

        // 验证关键词
        if (expectedKeywords && expectedKeywords.length > 0) {
          const { contains, matchedItems } = containsKeywords(
            results,
            expectedKeywords,
          );

          // 输出匹配到的项目信息，便于调试
          if (matchedItems.length > 0) {
            console.log(
              `[${testCase.name}] 匹配关键词的项目:`,
              matchedItems.map(item => {
                const itemInfo: any = {
                  title: item.title,
                  tags: item.tags,
                };

                // 安全地添加 score 属性（如果存在）
                if (hasScore(item)) {
                  itemInfo.score = item.score;
                }

                return itemInfo;
              }),
            );
          }

          // 断言关键词匹配
          const keywordMessage = `应该包含关键词 ${expectedKeywords.join(', ')}`;
          expect(contains).toBe(true);
        }

        // 验证特定服务器名称
        if (expectedServerNames && expectedServerNames.length > 0) {
          const { contains, missing, found } = containsServerNames(
            results,
            expectedServerNames,
          );

          // 输出验证结果，便于调试
          console.log(`[${testCase.name}] 验证服务器名称:`, {
            expected: expectedServerNames,
            found,
            missing,
          });

          // 断言服务器名称匹配
          const serverMessage = `应该包含服务器 ${expectedServerNames.join(', ')} 但缺失 ${missing.join(', ')}`;
          expect(contains).toBe(true);
        }
      } else {
        // 如果有预期的服务器名称，但结果为空，则测试失败
        if (expectedServerNames && expectedServerNames.length > 0) {
          const emptyMessage = `搜索结果不应为空，应该包含服务器 ${expectedServerNames.join(', ')}`;
          expect(results.length).toBeGreaterThan(0);
        } else {
          console.warn(`[${testCase.name}] 警告: 搜索结果为空`);
        }
      }
    } catch (error) {
      console.error(`[${testCase.name}] 测试执行出错:`, error);
      throw error; // 重新抛出错误，确保测试失败
    }
  };

  if (testCase.skip) {
    return test.skip(testCase.description, testFn);
  }
  return test(testCase.description, testFn);
}
