# MCP Advisor 技术参考

[English](./TECHNICAL_REFERENCE.md) | [简体中文](./TECHNICAL_REFERENCE.zh-CN.md)

本文对应 2026-10-25 的仓库源码 `94829fd`，不代表 npm `1.0.5` 发布产物或托管服务已经具备同样能力。安装和客户端配置见[快速开始](./GETTING_STARTED.zh-CN.md)。

## 协议与传输

当前源码要求 **MCP 2026-07-28**。默认 `stdio`；`http` 是固定 `/mcp` 的无状态 Streamable HTTP，不是历史 `/sse` + `/messages` 传输。`--mode` 优先于 `TRANSPORT_TYPE`。旧 `sse`/`rest` 模式与自定义端点配置会报迁移错误，历史 HTTP 端点返回 410。参见[传输配置](../src/config/mcpTransport.ts)。

HTTP 支持 POST `/mcp`；GET、DELETE `/mcp` 返回 405。`/health` 只能证明服务健康，不能证明外部推荐源可用；`POST /api/sources` 是添加目录来源的独立应用 API。`MCP_HTTP_RESPONSE_MODE=auto|json|sse` 控制响应编码，此处 `sse` **不会**恢复旧 SSE 传输。每个 HTTP 请求使用独立的服务器与传输，不维护可恢复会话。

默认监听 `127.0.0.1:3000`。`MCP_ALLOWED_HOSTS`、`MCP_ALLOWED_ORIGINS` 是逗号分隔的请求校验配置，不是身份认证或 CORS 配置。应用没有鉴权层；请保持私有监听，或在前面配置具备适当安全控制的代理。

## 工具契约

### `recommend-mcp-servers`

```json
{
  "taskDescription": "Find a read-only PostgreSQL query tool",
  "keywords": ["PostgreSQL"],
  "capabilities": ["database", "read-only"]
}
```

优先用 `taskDescription`；`query` 是兼容别名。工具入口的 `keywords`、`capabilities` 接受字符串或字符串数组，再归一化成数组；下述服务 API 仅接受数组。结果为 MCP 文本内容，不是结构化 JSON 响应契约。分数用于排序，不是校准概率、安全认证或能力符合性证明。离线候选也不能证明在线源可用；安装前自行核查项目。

### `install-mcp-server`

必填 `mcpName`、`sourceUrl`，可选 `mcpClient`。该工具生成安装**指导**，不会安装软件包或修改客户端文件。

参见[工具注册](../src/services/core/server/stateless/McpServerFactory.ts)与[推荐处理器](../src/services/core/server/tools/RecommendMcpServerToolHandler.ts)。

## 搜索提供者详解

[CLI 入口](../src/index.ts)同时构造下列提供者；不存在通过 `SEARCH_PROVIDER` 环境变量只选择其中一个的入口：

| 提供者 | 当前行为与配置 |
| --- | --- |
| Meilisearch | 使用 `MeilisearchConfigManager` 执行文本搜索，默认实例为 cloud。本地配置为 `MEILISEARCH_LOCAL_HOST`、`MEILISEARCH_MASTER_KEY`、`MEILISEARCH_INDEX_NAME`、`MEILISEARCH_AUTO_INDEX`；云端密钥为 `MEILISEARCH_CLOUD_API_KEY`。本地失败可回退云端，不要公开开发主密钥。 |
| Compass | 向 `COMPASS_API_BASE`（默认 `https://registry.mcphub.io`）发送 GET 推荐请求，把任务、关键词和能力组合为描述。 |
| GetMCP | 从 `GETMCP_API_URL`（默认 `https://getmcp.io/api/servers.json`）获取 JSON 目录，索引后搜索；不是远程 POST 搜索接口。 |
| Cline | 仅在 `CLINE_MARKETPLACE_ENABLED=true` 时显式启用；可选源不可用不等于没有推荐结果。 |
| Nacos | 仅当 `NACOS_SERVER_ADDR`、`NACOS_USERNAME`、**`NACOS_PASSWORD` 三者齐全**且初始化成功时加入。 |

CLI 还向 Nacos 配置传入 `MCP_HOST`（默认 `localhost`）、`MCP_PORT`（默认 `3000`）、`AUTH_TOKEN`（默认空）和 `NACOS_DEBUG`（仅精确为 `true` 才开启 debug，否则关闭）。它并未把 `NACOS_NAMESPACE`、`NACOS_GROUP`、`NACOS_SERVICE_NAME` 读入配置。构造函数选项与 CLI 环境变量不能混为一谈。

## 混合搜索策略

[SearchService](../src/services/searchService.ts)并行搜索提供者和内置离线数据，容忍单个提供者失败，按产品证据过滤候选、去重并确定性排序。默认返回上限为 5，默认最小相似度为 0.4。离线搜索默认开启，其独立最小相似度为 0.3；这些离线值是构造函数选项，**不是** CLI 读取的环境变量。空结果与仅离线结果需要分别诊断。

可选专业重排由 `RERANK_PROVIDER=flashrank` 启用（不设置或 `none` 表示关闭），另有 `RERANK_URL`（默认 `http://127.0.0.1:8001/rerank`）与 `RERANK_TIMEOUT_MS`（默认 `5000`）。服务限制候选数量，并只在返回上限、排序设置受支持且候选足够时调用；失败回退确定性排序。该配置依赖额外服务，不会自动启动模型服务器。参见[重排实现](../src/services/core/search/ProfessionalReranker.ts)。

## 开发自定义提供者

以下是**源码级** TypeScript 接口，不是已发布包的根导出。`@xiaohui-wang/mcpadvisor` 指向会调用 `main` 的 CLI 入口；不要从包根导入 `SearchService`。

```typescript
// 假设示例文件位于 src/，导入路径相对于该位置。
import { SearchService } from './services/searchService.js';
import type { MCPServerResponse, SearchProvider } from './types/index.js';
import type { SearchParams } from './types/search.js';

class ExampleProvider implements SearchProvider {
  async search(params: SearchParams): Promise<MCPServerResponse[]> {
    if (!params.taskDescription.toLowerCase().includes('example')) return [];
    return [{
      title: 'Example MCP server',
      description: 'Synthetic MCP server record for a provider example',
      sourceUrl: 'https://example.com/mcp-server',
      similarity: 1,
      score: 1,
    }];
  }
}

const service = new SearchService([], { enabled: false });
service.addProvider(new ExampleProvider());
const results = await service.search(
  { taskDescription: 'Find the example MCP server', keywords: ['example'] },
  { limit: 5, minSimilarity: 0.4 },
);
console.log(results);
```

示例数据不是经过核实的推荐；实际输出还取决于过滤和排序。当前公共类型契约：

- `SearchParams`：必填 `taskDescription: string`；可选 `keywords: string[]`、`capabilities: string[]`。
- `SearchProvider.search(params: SearchParams): Promise<MCPServerResponse[]>`。
- `SearchService(providers = [], offlineConfig = {}, professionalReranker?)`。
- `addProvider(provider)`、`removeProvider(index)`、`getProviders()`（返回浅拷贝）。
- `search(params, options?)`：`SearchOptions` 包含 `limit`、`minSimilarity`、`sortBy`、`sortOrder`。请使用结构化参数；实现内部的旧字符串兼容路径不是公共 TypeScript 重载。
- 响应必填 `title`、`description`、`sourceUrl` 及已标为弃用的 `similarity`；`score`、`id`、`installations`、`categories`、`tags` 可选。

扩展前核查[类型](../src/types/index.ts)、[搜索参数](../src/types/search.ts)与[服务实现](../src/services/searchService.ts)。外部适配器与编排、排序职责保持分离；使用确定性数据与显式隔离的网络访问测试新提供者。

## 系统配置

CLI 读取 `process.env`，不会自动加载 `.env` 或 `.mcpadvisorrc`。启动前导出变量，或显式预加载 `dotenv`。数据配置加载器不是通用 CLI 配置加载器。`SEARCH_PROVIDER`、`SEARCH_TIMEOUT`、`SEARCH_LIMIT`、`OFFLINE_ENABLED`、`OFFLINE_MIN_SIMILARITY` 均不是当前 CLI 控制项。

`VECTOR_ENGINE_TYPE`、`OCEANBASE_URL` 作用于使用它们的向量基础设施，不选择顶层 CLI 提供者。目录缓存 TTL 是源码常量，不是文档承诺的 `CACHE_TTL` 环境变量。参见[常量](../src/config/constants.ts)与[快速开始](./GETTING_STARTED.zh-CN.md)。

文件日志需 `ENABLE_FILE_LOGGING=true` 及指向现有可写目录的 `LOGS_DIR`；仅设置 `DEBUG=true` 不会启用此日志器。stdio 模式诊断应写 stderr，任意 stdout 输出会破坏 MCP 消息帧。不要公开凭据、Inspector 认证令牌、日志或跟踪文件。

## 验证与限制

```bash
pnpm run build
pnpm run check
pnpm run test:protocol
pnpm run test
# 需安装 Inspector/浏览器依赖；只运行已迁移的测试文件：
pnpm run test:e2e headless tests/e2e/mcp-inspector.spec.ts
```

构建成功不等于在线提供者验证通过。Vitest 含网络集成测试及可能跳过的用例，应记录实际运行范围与失败。协议测试不认证第三方客户端或托管服务。上述指定 Inspector 文件不覆盖旧 Meilisearch UI 测试。详见 [Inspector 指南](./inspector-ui-testing.md)及[贡献指南](../CONTRIBUTING.zh-CN.md)。历史设计文档与排障资料可能仍描述旧行为；待合并的 [PR #40](https://github.com/istarwyh/mcpadvisor/pull/40) 不能作为已合并验收证据。
