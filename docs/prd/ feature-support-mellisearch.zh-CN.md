## 需求描述
我们已经在 database 中接入了内存和 oceanbase 的处理，现在需要接入 meilisearch。接入后需要在 search 目录下提供新的搜索provider。
meilisearch 的使用 SDK 在 https://github.com/meilisearch/meilisearch-js ，这里摘录部分使用方法：
```js
const { MeiliSearch } = require('meilisearch')
// Or if you are in a ES environment
import { MeiliSearch } from 'meilisearch'

;(async () => {
  const client = new MeiliSearch({
    host: 'https://edge.meilisearch.com',
    apiKey: 'e43e778dabc417c862cafbe4da7cdd6f7fcb80ba36b63adb1e470527e76061f0',
  })

  // An index is where the documents are stored.
  const index = client.index('mcp_server_info_from_getmcp_io')
    const documents = [
  ]

  // If the index 'movies' does not exist, Meilisearch creates it when you first add the documents.
  let response = await index.addDocuments(documents)
  
  const search = await index.search('philoudelphia')
  console.log(search) 
  // 数据结构：
  {"id":"firecrawl","name":"firecrawl","display_name":"Firecrawl","description":"Advanced web scraping with JavaScript rendering, PDF support, and smart rate limiting","repository":{"type":"git","url":"https://github.com/vrknetha/mcp-server-firecrawl"},"homepage":"https://github.com/vrknetha/mcp-server-firecrawl","author":{"name":"vrknetha"},"license":"MIT","categories":["Web Scraping","AI"],"tags":["firecrawl","scraping","web","api","automation"],"examples":[{"title":"Basic Scraping Example","description":"Scrape content from a single URL","prompt":"firecrawl_scrape with url 'https://example.com'"},{"title":"Batch Scraping","description":"Scrape multiple URLs","prompt":"firecrawl_batch_scrape with urls ['https://example1.com', 'https://example2.com']"}],"installations":{"npm":{"type":"npm","command":"npx","args":["-y","firecrawl-mcp"],"env":{"FIRECRAWL_API_KEY":"${FIRECRAWL_API_KEY}"}}},"arguments":{"FIRECRAWL_API_KEY":{"description":"Your FireCrawl API key. Required for using the cloud API (default) and optional for self-hosted instances.","required":true,"example":"fc-YOUR_API_KEY"}}}
```


 请你先仔细阅读项目代码，设计技术方案。
## 技术方案

基于对项目代码的分析，我设计了以下 Meilisearch 集成方案：

### 1. 架构设计

遵循项目现有的架构模式，我实现了以下组件：

1. **Meilisearch 客户端**：
   - 位置：`src/services/database/meilisearch/controller.ts`
   - 功能：封装 Meilisearch SDK，提供索引、添加文档、搜索和删除功能
   - 接口：`IMeilisearchClient`
   - 配置：直接使用文档中指定的配置
     ```typescript
     const MEILISEARCH_HOST = 'https://edge.meilisearch.com';
     const MEILISEARCH_API_KEY = 'e43e778dabc417c862cafbe4da7cdd6f7fcb80ba36b63adb1e470527e76061f0';
     const MEILISEARCH_INDEX = 'mcp_server_info_from_getmcp_io';
     ```

2. **Meilisearch 向量引擎**：
   - 位置：`src/services/database/meilisearch/vectorEngine.ts`
   - 功能：实现 `IVectorSearchEngine` 接口，提供向量搜索能力
   - 注意：Meilisearch 不直接支持向量搜索，这里使用文本搜索作为替代方案

3. **Meilisearch 搜索提供者**：
   - 位置：`src/services/search/MeilisearchSearchProvider.ts`
   - 功能：实现 `SearchProvider` 接口，提供基于 Meilisearch 的搜索功能
   - 特点：直接使用 Meilisearch 原生搜索能力，不依赖向量引擎

4. **向量引擎工厂扩展**：
   - 位置：`src/services/database/vectorEngineFactory.ts`
   - 功能：扩展工厂类支持 Meilisearch 引擎类型

5. **SearchService 扩展**：
   - 位置：`src/services/searchService.ts`
   - 功能：添加 `searchMeilisearch` 静态方法，提供便捷的 Meilisearch 搜索入口

### 2. 配置管理

我们直接使用文档中指定的 Meilisearch 配置，而不是从环境变量中读取：

```typescript
// 使用文档中指定的配置
const MEILISEARCH_HOST = 'https://edge.meilisearch.com';
const MEILISEARCH_API_KEY = 'e43e778dabc417c862cafbe4da7cdd6f7fcb80ba36b63adb1e470527e76061f0';
const MEILISEARCH_INDEX = 'mcp_server_info_from_getmcp_io';
```

这样可以确保我们的实现与文档中的示例保持一致。

### 3. 数据流程

1. **数据索引流程**：
   - 从 GetMCP API 获取服务器数据
   - 转换为 Meilisearch 文档格式
   - 添加到 Meilisearch 索引

2. **搜索流程**：
   - 接收用户查询
   - 确保数据已加载到 Meilisearch
   - 执行 Meilisearch 搜索
   - 转换结果为 MCPServerResponse 格式
   - 返回搜索结果

### 4. 实现特点

- **直接集成**：直接使用 Meilisearch 的原生搜索能力，而不是通过向量搜索模拟
- **简化设计**：遵循 Meilisearch 的简单 API 设计，减少复杂性
- **兼容性**：保持与现有搜索提供者的接口兼容性
- **使用云服务**：使用 Meilisearch 提供的云服务，无需本地部署

## 测试

为验证 Meilisearch 集成的有效性，我创建了两个测试脚本，并将它们集成到 Jest 测试框架中：

### 1. 测试环境

由于我们使用的是 Meilisearch 云服务（edge.meilisearch.com），因此不需要本地安装和启动 Meilisearch 服务。测试将直接连接到云服务。

### 2. 运行测试

我们提供了两种测试脚本：

#### 向量引擎测试

文件：`src/tests/meilisearch-test.ts`

测试内容：
- Meilisearch 向量引擎的基本功能
- 添加测试数据到 Meilisearch
- 执行搜索并验证结果

#### 搜索提供者测试

文件：`src/tests/test-meilisearch-provider.ts`

测试内容：
- Meilisearch 搜索提供者的功能
- 使用不同查询测试搜索效果
- 验证结果格式和相关性

#### 运行测试命令

```bash
# 启用 Meilisearch 测试
ENABLE_MEILISEARCH_TESTS=true npm test
```

如果不想运行 Meilisearch 测试，可以不设置环境变量：

```bash
npm test
```

### 3. 测试注意事项

1. **环境变量配置**：
   ```
   # 启用 Meilisearch 测试
   ENABLE_MEILISEARCH_TESTS=true
   ```

2. **常见问题排查**：
   - 如果测试失败并显示连接错误，请检查网络连接
   - 如果索引操作失败，请检查 API 密钥是否有效
   - 如果搜索结果为空，请确保数据已正确索引

3. **验证要点**：
   - 数据是否成功索引到 Meilisearch
   - 搜索结果是否符合预期
   - 相似度分数是否合理

4. **手动验证**：
   您可以使用 Meilisearch 提供的 API 验证索引和搜索功能：
   ```javascript
   const { MeiliSearch } = require('meilisearch');
   
   const client = new MeiliSearch({
     host: 'https://edge.meilisearch.com',
     apiKey: 'e43e778dabc417c862cafbe4da7cdd6f7fcb80ba36b63adb1e470527e76061f0',
   });
   
   const index = client.index('mcp_server_info_from_getmcp_io');
   const search = await index.search('your query');
   console.log(search);
   ```
