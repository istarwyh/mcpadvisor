/**
 * 验证离线数据加载功能
 * 这个脚本用于测试离线数据加载是否正常工作
 */

import { OfflineDataLoader } from '../../services/providers/offline/offlineDataLoader.js';
import { EnhancedMemoryVectorEngine } from '../../services/providers/offline/enhancedMemoryVectorEngine.js';
import { OfflineSearchProvider } from '../../services/core/search/OfflineSearchProvider.js';
import logger from '../../utils/logger.js';

// 设置日志级别为 debug
logger.level = 'debug';

async function testOfflineDataLoading() {
  console.log('=== 测试离线数据加载 ===');

  // 1. 测试 OfflineDataLoader
  console.log('\n1. 测试 OfflineDataLoader:');
  const dataLoader = new OfflineDataLoader();
  const data = await dataLoader.loadFallbackData();
  console.log(`加载到 ${data.length} 条服务器数据`);

  if (data.length > 0) {
    console.log('数据示例:');
    console.log(data.slice(0, 2));

    // 检查是否包含小红书相关服务器
    const redNoteServers = data.filter(
      server =>
        server.title?.toLowerCase().includes('rednote') ||
        server.description?.toLowerCase().includes('rednote') ||
        server.title?.toLowerCase().includes('小红书') ||
        server.description?.toLowerCase().includes('小红书'),
    );

    console.log(`\n找到 ${redNoteServers.length} 个小红书相关服务器:`);
    if (redNoteServers.length > 0) {
      console.log(
        redNoteServers.map(s => ({
          title: s.title,
          description: s.description,
        })),
      );
    }
  }

  // 2. 测试 EnhancedMemoryVectorEngine
  console.log('\n2. 测试 EnhancedMemoryVectorEngine:');
  const vectorEngine = new EnhancedMemoryVectorEngine();
  // EnhancedMemoryVectorEngine 会在首次搜索时自动初始化和加载数据
  // 使用模拟的向量数据（实际应用中应使用嵌入模型生成向量）
  const mockVector = Array(384)
    .fill(0)
    .map(() => Math.random() - 0.5); // 创建一个384维的随机向量
  const engineResults = await vectorEngine.search(mockVector, 10, {
    minSimilarity: 0.1,
    textQuery: '小红书 热点',
  });
  console.log(`向量引擎搜索结果: ${engineResults.length} 条`);
  if (engineResults.length > 0) {
    console.log('向量搜索结果示例:');
    console.log(
      engineResults.slice(0, 2).map(r => ({
        title: r.title,
        similarity: r.similarity,
        description: `${r.description?.substring(0, 50)}...`,
      })),
    );
  }

  // 3. 测试 OfflineSearchProvider
  console.log('\n3. 测试 OfflineSearchProvider:');
  const offlineProvider = new OfflineSearchProvider();
  const searchResults = await offlineProvider.search({
    taskDescription: '我想要看看小红书今天的热点问题，你再锐评一下',
  });

  console.log(`离线搜索结果: ${searchResults.length} 条`);
  if (searchResults.length > 0) {
    console.log('搜索结果示例:');
    console.log(
      searchResults.slice(0, 3).map(r => ({
        title: r.title,
        similarity: r.similarity,
        description: `${r.description?.substring(0, 50)}...`,
      })),
    );
  }
}

// 执行测试
testOfflineDataLoading()
  .then(() => console.log('\n测试完成'))
  .catch(err => console.error('测试出错:', err));
