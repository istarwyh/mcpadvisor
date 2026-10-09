# MCP Advisor 技术参考手册

[English](./TECHNICAL_REFERENCE.en.md) | [简体中文](./TECHNICAL_REFERENCE.md)

本文档详细介绍了 MCP Advisor 的技术实现、搜索提供者、高级特性和配置选项，面向需要深度集成或自定义的开发者。

## 目录

- [搜索提供者详解](#搜索提供者详解)
  - [Meilisearch Provider](#meilisearch-provider)
  - [GetMCP Provider](#getmcp-provider)
  - [Compass Provider](#compass-provider)
  - [Nacos Provider](#nacos-provider)
  - [Offline Provider](#offline-provider)
  - [OceanBase Provider](#oceanbase-provider)
  - [自定义提供者开发](#自定义提供者开发)
- [混合搜索策略](#混合搜索策略)
- [高级技术特性](#高级技术特性)
  - [向量归一化](#向量归一化)
  - [并行搜索执行](#并行搜索执行)
  - [加权结果合并](#加权结果合并)
- [错误处理系统](#错误处理系统)
- [数据更新策略](#数据更新策略)
- [日志系统](#日志系统)
- [性能优化](#性能优化)
- [系统配置](#系统配置)

## 搜索提供者详解

MCP Advisor 使用多提供者搜索架构，允许不同的搜索引擎并行工作，合并结果以提供最佳推荐。每个提供者都有特定的优势和用例，系统设计为在任何提供者不可用时优雅降级。

### Meilisearch Provider

一个使用 Meilisearch 作为后端的向量搜索提供者。

**主要特性**：
- 快速向量相似度搜索
- 支持过滤和分面搜索
- 低延迟响应
- HNSW 索引用于高效的最近邻搜索

**配置选项**：
```bash
SEARCH_PROVIDER=meilisearch
MEILISEARCH_URL=http://localhost:7700
MEILISEARCH_API_KEY=your_api_key
```

**最适用于**：
- 拥有专用 Meilisearch 实例的生产环境
- 需要快速搜索响应的应用
- 对搜索质量要求较高的场景

**技术实现**：

```typescript
class MeilisearchProvider implements ISearchProvider {
  private client: MeiliSearch;
  private indexName = 'mcp_servers';

  async search(query: string, options?: SearchOptions): Promise<Server[]> {
    const index = this.client.index(this.indexName);
    
    // 生成查询向量
    const queryVector = await this.generateEmbedding(query);
    
    // 执行向量搜索
    const results = await index.search('', {
      vector: queryVector,
      limit: options?.limit || 10,
      filter: this.buildFilters(options)
    });
    
    return this.formatResults(results.hits);
  }
}
```

### GetMCP Provider

基于 API 的提供者，查询 GetMCP 注册表获取最新的服务器信息。

**主要特性**：
- 始终保持最新的 MCP 服务器信息
- 丰富的元数据和描述
- 社区维护的服务器信息
- 无需本地基础设施

**配置选项**：
```bash
SEARCH_PROVIDER=getmcp
GETMCP_API_URL=https://api.getmcp.org
```

**最适用于**：
- 确保访问最新 MCP 服务器
- 没有本地搜索基础设施的环境
- 用社区数据补充本地搜索结果

**技术实现**：

```typescript
class GetMcpProvider implements ISearchProvider {
  private apiUrl: string;
  private cache: Map<string, CachedResult> = new Map();

  async search(query: string, options?: SearchOptions): Promise<Server[]> {
    // 检查缓存
    const cacheKey = `${query}_${JSON.stringify(options)}`;
    const cached = this.cache.get(cacheKey);
    
    if (cached && !this.isCacheExpired(cached)) {
      return cached.results;
    }
    
    // API 调用
    const response = await fetch(`${this.apiUrl}/search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, ...options })
    });
    
    const results = await response.json();
    
    // 更新缓存
    this.cache.set(cacheKey, {
      results,
      timestamp: Date.now()
    });
    
    return results;
  }
}
```

### Compass Provider

基于 API 的提供者，查询 Compass 注册表获取 MCP 服务器信息。

**主要特性**：
- 精选的服务器列表
- 验证过的安装说明
- 基于分类的浏览
- 定期更新

**配置选项**：
```bash
SEARCH_PROVIDER=compass
COMPASS_API_URL=https://compass-api.example.org
```

**最适用于**：
- 需要验证过服务器的企业环境
- 需要精选服务器推荐的应用
- 补充其他搜索提供者

### Nacos Provider

与 Nacos（命名和配置服务）集成的提供者，用于发现在 Nacos 集群中注册的 MCP 服务器。

**主要特性**：
- 从 Nacos 动态发现 MCP 服务器
- 支持 Nacos 认证和命名空间
- 自动健康检查注册的服务
- 与现有 Nacos 服务基础设施集成

**配置选项**：
```bash
SEARCH_PROVIDER=nacos
NACOS_SERVER_ADDR=localhost:8848
NACOS_NAMESPACE=public
NACOS_GROUP=DEFAULT_GROUP
NACOS_USERNAME=nacos
NACOS_PASSWORD=nacos
MCP_SERVICE_NAME=mcp-servers
```

**环境变量**：
- `NACOS_SERVER_ADDR`: Nacos 服务器地址列表（必需）
- `NACOS_NAMESPACE`: Nacos 命名空间 ID（默认：public）
- `NACOS_GROUP`: Nacos 组名（默认：DEFAULT_GROUP）
- `NACOS_USERNAME`: Nacos 认证用户名（可选）
- `NACOS_PASSWORD`: Nacos 认证密码（可选）
- `MCP_SERVICE_NAME`: Nacos 中 MCP 服务的服务名（默认：mcp-servers）

**最适用于**：
- 使用 Nacos 进行服务发现的企业环境
- 动态 MCP 服务器注册和发现
- 需要服务健康监控的环境

**技术实现**：

```typescript
class NacosProvider implements ISearchProvider {
  private nacosClient: NacosClient;

  async search(query: string, options?: SearchOptions): Promise<Server[]> {
    // 从 Nacos 获取服务实例
    const instances = await this.nacosClient.getAllInstances(
      this.serviceName,
      this.group,
      this.namespace
    );
    
    // 过滤健康实例
    const healthyInstances = instances.filter(instance => instance.healthy);
    
    // 转换为服务器格式并应用搜索过滤
    const servers = healthyInstances.map(this.instanceToServer);
    
    return this.filterByQuery(servers, query);
  }
}
```

### Offline Provider

本地搜索提供者，无需外部依赖即可工作，结合向量搜索和文本匹配。

**主要特性**：
- 完全离线工作
- 结合向量和文本匹配的混合搜索
- 预打包的服务器数据
- 无外部 API 依赖

**配置选项**：
```bash
SEARCH_PROVIDER=offline
```

**最适用于**：
- 离线环境
- 其他提供者不可用时的备用方案
- 快速本地开发
- 隐私敏感的应用

**技术实现**：

```typescript
class OfflineProvider implements ISearchProvider {
  private vectorEngine: VectorSearchEngine;
  private textMatcher: TextMatcher;

  async search(query: string, options?: SearchOptions): Promise<Server[]> {
    // 并行执行向量和文本搜索
    const [vectorResults, textResults] = await Promise.all([
      this.vectorEngine.search(query, options),
      this.textMatcher.search(query, options)
    ]);
    
    // 合并结果
    return this.mergeResults(vectorResults, textResults, {
      vectorWeight: 0.7,
      textWeight: 0.3
    });
  }
}
```

### OceanBase Provider

使用 OceanBase 进行存储和检索的向量搜索提供者。

**主要特性**：
- 企业级数据库后端
- 高可用性和可扩展性
- 向量搜索的 HNSW 索引
- 支持复杂查询和过滤

**配置选项**：
```bash
SEARCH_PROVIDER=oceanbase
OCEANBASE_HOST=localhost
OCEANBASE_PORT=2881
OCEANBASE_USER=root
OCEANBASE_PASSWORD=password
OCEANBASE_DATABASE=mcpadvisor
```

**最适用于**：
- 已经使用 OceanBase 的企业环境
- 需要高可用性的应用
- 有大量服务器数据的场景

### 自定义提供者开发

MCP Advisor 支持通过简单接口实现自定义搜索提供者：

```typescript
interface ISearchProvider {
  search(query: string, options?: SearchOptions): Promise<Server[]>;
  getName(): string;
  getWeight(): number;
}
```

**实现自定义提供者**：

```typescript
import { ISearchProvider, SearchOptions, Server } from '../types';

export class CustomProvider implements ISearchProvider {
  private weight = 0.5;

  async search(query: string, options?: SearchOptions): Promise<Server[]> {
    // 实现您的搜索逻辑
    const results = await this.performCustomSearch(query, options);
    
    return results.map(result => ({
      name: result.name,
      description: result.description,
      githubUrl: result.repository_url,
      category: result.tags.join(', '),
      relevanceScore: result.score
    }));
  }

  getName(): string {
    return 'custom';
  }

  getWeight(): number {
    return this.weight;
  }

  private async performCustomSearch(query: string, options?: SearchOptions): Promise<any[]> {
    // 自定义搜索实现
    // 可以调用外部 API、查询数据库等
    return [];
  }
}

// 注册提供者
import { SearchService } from '../services';
const searchService = new SearchService();
searchService.registerProvider(new CustomProvider());
```

## 混合搜索策略

MCP Advisor 实现了复杂的混合搜索策略，结合多种搜索技术：

### 搜索组合策略

1. **向量搜索**: 将查询转换为向量嵌入进行语义相似度匹配
2. **文本匹配**: 使用关键词和元数据匹配获得精确结果
3. **加权合并**: 用可配置权重合并结果（默认：70% 向量，30% 文本）
4. **并行执行**: 并行运行搜索以获得最佳性能
5. **自适应过滤**: 根据结果质量动态调整相似度阈值

### 提供者选择逻辑

```typescript
class ProviderSelectionEngine {
  selectProviders(query: string, options: SearchOptions): ISearchProvider[] {
    // 分析查询特征
    const queryFeatures = this.analyzeQuery(query);
    
    // 根据查询特征选择提供者
    if (queryFeatures.isHighlySpecific) {
      return [this.getProvider('meilisearch'), this.getProvider('getmcp')];
    } else if (queryFeatures.isGeneral) {
      return this.getAllProviders();
    } else {
      return this.getDefaultProviders();
    }
  }
}
```

混合方法提供了几个优势：
- 更好地处理模糊查询
- 改善非英语查询的结果
- 对词汇不匹配的恢复能力
- 在语义理解和关键词精度之间取得平衡

## 高级技术特性

### 向量归一化

向量归一化是提高搜索质量的关键技术。

**实现原理**：
- 将所有向量转换为单位长度（大小 = 1）
- 使用欧几里得范数进行归一化
- 确保一致的余弦相似度计算

**技术优势**：
- 通过关注方向而非大小来提高搜索精度
- 减少向量维度变化的影响
- 改善跨语言查询的性能

```typescript
/**
 * 将向量归一化为单位长度
 * @param vector 输入向量
 * @returns 归一化后的向量
 */
function normalizeVector(vector: number[]): number[] {
  // 计算向量大小（欧几里得范数）
  const magnitude = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0));
  
  // 防止除以零
  if (magnitude === 0 || !isFinite(magnitude)) {
    return vector;
  }
  
  // 归一化向量
  return vector.map(val => val / magnitude);
}
```

### 并行搜索执行

MCP Advisor 使用并行搜索策略来优化性能。

**实现方式**：
- 使用 `Promise.all` 同时执行多个搜索
- 显著减少总搜索时间
- 提高系统响应性
- 允许不同搜索策略的结果合并

```typescript
/**
 * 并行执行多个搜索提供者
 * @param query 搜索查询
 * @param providers 搜索提供者列表
 * @returns 合并的搜索结果
 */
async function parallelSearch(
  query: string, 
  providers: SearchProvider[]
): Promise<SearchResult[]> {
  try {
    // 并行执行所有提供者的搜索
    const resultsPromises = providers.map(provider => 
      provider.search(query).catch(error => {
        logger.error(`Provider ${provider.name} failed:`, error);
        return []; // 失败时返回空结果
      })
    );
    
    // 等待所有搜索完成
    const results = await Promise.all(resultsPromises);
    
    // 合并并去重结果
    return deduplicateResults(results.flat());
  } catch (error) {
    logger.error('Parallel search failed:', error);
    throw error;
  }
}
```

### 加权结果合并

加权结果合并技术允许智能组合不同搜索策略的结果。

**实现原理**：
- 基于可配置权重合并向量和文本搜索结果
- 默认配置：向量相似度 (70%)，文本匹配 (30%)
- 根据查询特征动态调整权重

```typescript
/**
 * 合并向量和文本搜索结果
 * @param textResults 文本搜索结果
 * @param vectorResults 向量搜索结果
 * @param weights 合并权重配置
 * @returns 合并后的结果
 */
function mergeSearchResults(
  textResults: SearchResult[],
  vectorResults: SearchResult[],
  weights: { textMatchWeight: number; vectorMatchWeight: number }
): SearchResult[] {
  const { textMatchWeight, vectorMatchWeight } = weights;
  const mergedMap = new Map<string, SearchResult>();
  
  // 处理文本搜索结果
  for (const result of textResults) {
    const key = result.github_url || result.title;
    mergedMap.set(key, {
      ...result,
      similarity: result.similarity * textMatchWeight
    });
  }
  
  // 处理向量搜索结果，合并相同项
  for (const result of vectorResults) {
    const key = result.github_url || result.title;
    if (mergedMap.has(key)) {
      const existing = mergedMap.get(key)!;
      mergedMap.set(key, {
        ...existing,
        similarity: existing.similarity + (result.similarity * vectorMatchWeight)
      });
    } else {
      mergedMap.set(key, {
        ...result,
        similarity: result.similarity * vectorMatchWeight
      });
    }
  }
  
  // 转换回数组并排序
  return Array.from(mergedMap.values())
    .sort((a, b) => b.similarity - a.similarity);
}
```

## 错误处理系统

MCP Advisor 实现了强大的错误处理系统，确保可靠性并提供详细的诊断信息。

### 优雅降级策略

- **多提供者后备**：如果一个搜索提供者失败，系统会使用其他提供者
- **部分结果处理**：即使某些提供者失败，系统仍能返回部分结果
- **默认响应**：对于关键失败，系统提供默认响应
- **用户友好错误消息**：将技术错误转换为用户可理解的消息

```typescript
/**
 * 实现优雅降级的搜索函数
 * @param query 搜索查询
 * @param options 搜索选项
 * @returns 搜索结果
 */
async function resilientSearch(
  query: string, 
  options: SearchOptions
): Promise<SearchResult[]> {
  try {
    // 尝试使用所有提供者
    return await searchWithAllProviders(query, options);
  } catch (primaryError) {
    logger.warn('Primary search failed, falling back:', primaryError);
    
    try {
      // 尝试使用离线提供者
      return await searchWithOfflineProvider(query, options);
    } catch (fallbackError) {
      logger.error('Fallback search failed:', fallbackError);
      
      // 返回默认结果
      return getDefaultResults(query);
    }
  }
}
```

### 上下文错误格式化

```typescript
/**
 * 格式化错误对象，添加上下文信息
 * @param error 原始错误
 * @param context 错误上下文
 * @returns 格式化后的错误
 */
function formatError(error: any, context: ErrorContext): FormattedError {
  // 提取错误消息
  const message = error instanceof Error 
    ? error.message 
    : String(error);
  
  // 提取和格式化堆栈
  const stack = error instanceof Error && error.stack
    ? error.stack.split('\n').map(line => line.trim())
    : [];
  
  // 创建格式化的错误对象
  return {
    message,
    stack,
    type: error.constructor.name || 'Unknown',
    code: error.code || 'UNKNOWN_ERROR',
    context: {
      component: context.component,
      operation: context.operation,
      params: context.params,
      timestamp: new Date().toISOString(),
      ...context.additionalInfo
    }
  };
}
```

## 数据更新策略

MCP Advisor 实现了智能数据更新策略，平衡性能和数据新鲜度。

### 时间戳跟踪

- 每个数据源维护最后更新时间戳
- 系统跟踪更新频率和模式
- 可配置的新鲜度窗口（默认：1 小时）

```typescript
/**
 * 检查数据是否需要更新
 * @param dataSource 数据源
 * @returns 是否需要更新
 */
function shouldUpdateData(dataSource: DataSource): boolean {
  const lastUpdate = dataSource.getLastUpdateTimestamp();
  const now = Date.now();
  const freshnessWindow = config.getFreshnessWindow();
  
  // 如果没有上次更新时间或超过新鲜度窗口，则更新
  return !lastUpdate || (now - lastUpdate) > freshnessWindow;
}
```

### 条件索引

```typescript
/**
 * 条件更新向量索引
 * @param dataSource 数据源
 */
async function conditionalIndexUpdate(dataSource: DataSource): Promise<void> {
  // 检查是否需要更新
  if (!shouldUpdateData(dataSource)) {
    logger.debug('Index is fresh, skipping update');
    return;
  }
  
  try {
    // 获取新数据
    const newData = await dataSource.fetchLatestData();
    
    // 检查数据是否有变化
    if (dataSource.hasDataChanged(newData)) {
      logger.info('Data changed, rebuilding index');
      await vectorDatabase.rebuildIndex(newData);
      dataSource.updateLastUpdateTimestamp();
    } else {
      logger.info('No data changes detected');
      dataSource.updateLastUpdateTimestamp();
    }
  } catch (error) {
    logger.error('Index update failed:', error);
    // 失败不会阻止使用现有索引
  }
}
```

## 日志系统

MCP Advisor 实现了增强的日志系统，提供详细的系统操作可见性。

### 上下文感知日志

```typescript
/**
 * 创建上下文感知的日志条目
 * @param level 日志级别
 * @param message 日志消息
 * @param context 日志上下文
 */
function logWithContext(
  level: LogLevel,
  message: string,
  context: LogContext
): void {
  const logEntry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    component: context.component,
    operation: context.operation,
    ...context.metadata
  };
  
  // 输出到控制台
  if (config.consoleLogging) {
    console[level](JSON.stringify(logEntry));
  }
  
  // 输出到文件
  if (config.fileLogging) {
    fileLogger.write(logEntry);
  }
}
```

### 性能跟踪

```typescript
/**
 * 性能跟踪包装器
 * @param operation 操作名称
 * @param func 要执行的函数
 * @returns 函数结果
 */
async function trackPerformance<T>(
  operation: string,
  func: () => Promise<T>
): Promise<T> {
  const start = performance.now();
  try {
    const result = await func();
    const duration = performance.now() - start;
    
    logger.debug(`Operation ${operation} completed in ${duration.toFixed(2)}ms`);
    
    // 记录性能指标
    metrics.recordOperationDuration(operation, duration);
    
    return result;
  } catch (error) {
    const duration = performance.now() - start;
    logger.error(`Operation ${operation} failed after ${duration.toFixed(2)}ms:`, error);
    throw error;
  }
}
```

## 性能优化

MCP Advisor 采用了多种性能优化技术。

### 缓存策略

- **查询缓存**：缓存常见查询的结果
- **嵌入缓存**：重用计算成本高的嵌入向量
- **LRU 策略**：限制缓存大小，优先保留最近使用的项

```typescript
/**
 * 创建 LRU 缓存
 * @param maxSize 最大缓存项数
 * @returns 缓存对象
 */
function createLRUCache<K, V>(maxSize: number): Cache<K, V> {
  const cache = new Map<K, V>();
  const keys: K[] = [];
  
  return {
    get(key: K): V | undefined {
      const value = cache.get(key);
      if (value !== undefined) {
        // 将项移到最近使用的位置
        const index = keys.indexOf(key);
        if (index > -1) {
          keys.splice(index, 1);
          keys.push(key);
        }
      }
      return value;
    },
    
    set(key: K, value: V): void {
      // 如果达到最大大小，删除最旧的项
      if (keys.length >= maxSize && !cache.has(key)) {
        const oldestKey = keys.shift();
        if (oldestKey !== undefined) {
          cache.delete(oldestKey);
        }
      }
      
      // 添加或更新项
      if (!cache.has(key)) {
        keys.push(key);
      }
      cache.set(key, value);
    },
    
    clear(): void {
      cache.clear();
      keys.length = 0;
    }
  };
}
```

### 批处理

```typescript
/**
 * 批量生成嵌入向量
 * @param texts 要嵌入的文本列表
 * @returns 嵌入向量列表
 */
async function batchGenerateEmbeddings(
  texts: string[]
): Promise<number[][]> {
  // 如果只有一个文本，直接处理
  if (texts.length === 1) {
    return [await generateEmbedding(texts[0])];
  }
  
  // 批量处理多个文本
  logger.debug(`Generating embeddings for ${texts.length} texts in batch`);
  
  try {
    // 调用嵌入模型的批处理 API
    const embeddings = await embeddingModel.embedBatch(texts);
    
    // 归一化所有嵌入
    return embeddings.map(normalizeVector);
  } catch (error) {
    logger.error('Batch embedding generation failed:', error);
    
    // 回退到单个处理
    logger.info('Falling back to individual embedding generation');
    const results: number[][] = [];
    
    for (const text of texts) {
      try {
        results.push(await generateEmbedding(text));
      } catch (innerError) {
        logger.error(`Failed to generate embedding for text: ${text.substring(0, 50)}...`, innerError);
        // 对于失败的文本，添加零向量
        results.push(new Array(embeddingModel.dimensions).fill(0));
      }
    }
    
    return results;
  }
}
```

### 延迟加载

```typescript
/**
 * 延迟加载搜索提供者
 */
class LazyLoadedProvider implements SearchProvider {
  private provider: SearchProvider | null = null;
  private readonly factory: () => SearchProvider;
  
  constructor(factory: () => SearchProvider) {
    this.factory = factory;
  }
  
  async search(query: string): Promise<SearchResult[]> {
    // 按需初始化提供者
    if (!this.provider) {
      this.provider = this.factory();
    }
    
    return this.provider.search(query);
  }
}
```

## 端到端测试框架

### 端口管理

在端到端测试中增加了对 MCP Inspector 和代理端口的自动清理机制，确保端口冲突不会影响测试运行。

**端口清理机制**:
```bash
# 清理端口占用
cleanup_ports() {
    local ports=(6274 6277)
    for port in "${ports[@]}"; do
        local pids=$(lsof -ti :$port 2>/dev/null || true)
        if [[ -n "$pids" ]]; then
            kill -9 $pids 2>/dev/null || true
        else
            echo "No process found on port $port"
        fi
    done
    pkill -f "inspector" 2>/dev/null || true
}
```

### 测试辅助工具

新增了模块化的测试辅助工具类，提供了更好的测试环境管理：

**测试工具类**:
- `EnvironmentManager`: 环境变量保存和恢复
- `SmartWaiter`: 智能等待机制
- `MCPConnectionManager`: MCP 连接管理
- `SearchOperations`: 搜索操作封装
- `ScreenshotManager`: 截图管理
- `TestValidator`: 测试结果验证

```typescript
// 使用示例
const envManager = new EnvironmentManager();
envManager.saveEnvironment();
envManager.setMeilisearchConfig({
  instance: 'local',
  host: 'http://localhost:7700'
});
// ... 测试代码
envManager.restoreEnvironment();
```


## 系统配置

### 提供者配置

MCP Advisor 允许同时配置多个提供者，具有优先级和回退机制。

**环境变量配置**：
```bash
# 主要提供者
SEARCH_PROVIDER=hybrid

# 提供者权重（用于混合搜索）
VECTOR_SEARCH_WEIGHT=0.7
TEXT_SEARCH_WEIGHT=0.3

# 提供者特定选项
MEILISEARCH_URL=http://localhost:7700
GETMCP_API_URL=https://api.getmcp.org
```

**配置文件**：
```json
{
  "search": {
    "provider": "hybrid",
    "providers": {
      "meilisearch": {
        "enabled": true,
        "url": "http://localhost:7700",
        "apiKey": "your_api_key",
        "weight": 0.4
      },
      "getmcp": {
        "enabled": true,
        "url": "https://api.getmcp.org",
        "weight": 0.3
      },
      "offline": {
        "enabled": true,
        "weight": 0.3
      }
    },
    "fallbackOrder": ["meilisearch", "getmcp", "offline"]
  }
}
```

### 提供者选择逻辑

1. 如果 `SEARCH_PROVIDER` 设置为特定提供者，则只使用该提供者
2. 如果设置为 `hybrid`，则使用所有启用的提供者及其配置权重
3. 如果提供者失败，系统会回退到 `fallbackOrder` 中的下一个提供者
4. 如果所有提供者都失败，系统返回错误

### 性能调优配置

```json
{
  "performance": {
    "caching": {
      "enabled": true,
      "ttl": 3600,
      "maxSize": 1000
    },
    "batching": {
      "enabled": true,
      "batchSize": 10,
      "timeout": 5000
    },
    "parallelism": {
      "maxConcurrentProviders": 5,
      "timeout": 10000
    }
  }
}
```

---

本技术参考手册提供了 MCP Advisor 的深入技术细节。对于更多信息，请参阅：

- [快速开始指南](./GETTING_STARTED.md) - 安装和基本使用
- [架构文档](./ARCHITECTURE.md) - 系统架构详解
- [贡献指南](../CONTRIBUTING.md) - 开发者指南
- [故障排除](./TROUBLESHOOTING.md) - 常见问题解决