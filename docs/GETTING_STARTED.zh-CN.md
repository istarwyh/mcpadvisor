# MCP Advisor 快速开始

[English](./GETTING_STARTED.md) | [简体中文](./GETTING_STARTED.zh-CN.md)

本文是当前源码操作指南，2026-10-25 按 main `94829fd` 核对。先选择制品：源码有某项能力，不代表 npm 已发布该能力，也不代表第三方托管入口已完成验收。

## 安装方式

### 现代源码构建

需要 Node.js >=20、pnpm **8.15.9**、Git 和 POSIX shell。`.nvmrc` 选择 Node.js 22；可选 Inspector UI 测试另要求 **Node.js >=22.19.0**。

```bash
git clone https://github.com/istarwyh/mcpadvisor.git
cd mcpadvisor
pnpm install --frozen-lockfile
pnpm run build
node build/index.js
```

最后一行启动 stdio 并等待 MCP 客户端，不是交互式搜索提示符。客户端必须显式选择 **MCP 2026-07-28**；按[官方 SDK 示例](./MCP_2026_MIGRATION.md#connect-with-the-official-sdk)执行 discovery、tools/list 和首次调用。仅使用 SDK v2 不等于选择现代协议；本文不证明具体桌面客户端已兼容。

### 已发布兼容版本

历史客户端或回滚路径固定使用 npm **1.0.5**，它不包含现代源码的 transport 迁移。

```json
{
  "mcpServers": {
    "mcpadvisor": {
      "command": "npx",
      "args": ["-y", "@xiaohui-wang/mcpadvisor@1.0.5"]
    }
  }
}
```

Claude Desktop 历史配置路径：macOS 为 `~/Library/Application Support/Claude/claude_desktop_config.json`，Windows 为 `%AppData%\Claude\claude_desktop_config.json`。Linux 或其他客户端请按其自身说明配置。这些路径不证明现代协议兼容；第三方安装按钮和托管目录不属于制品验收证据。真实托管迁移仍在 [#36](https://github.com/istarwyh/mcpadvisor/issues/36) 和草稿 [#40](https://github.com/istarwyh/mcpadvisor/pull/40) 单独跟踪。

## 基本使用

### 查找 MCP 服务器

让客户端调用 `recommend-mcp-servers`。例如以下是工具参数，不是完整 JSON-RPC 请求：

```json
{
  "taskDescription": "查找能查询 PostgreSQL 数据库结构元数据的 MCP 服务器",
  "keywords": ["PostgreSQL"],
  "capabilities": ["schema inspection"]
}
```

提供明确工作流和约束，不只输入宽泛类别。`query` 是 `taskDescription` 的兼容别名，优先使用后者。可选 keywords/capabilities 支持字符串或字符串数组。

### 理解结果

工具返回 MCP 文本内容，包含候选名称、描述、来源 URL 和可用元数据；也可能无结果。分数是排序信号，不是置信度、质量认证或可用性证明。使用前应核对候选来源、权限、维护状态及安装说明。网络和目录新鲜度影响结果；得到离线结果不证明在线 provider 成功。

### 安装指导

`install-mcp-server` 需要 `mcpName`、`sourceUrl`，可选 `mcpClient`。它只返回安装和配置**指导**，不会替用户安装、启动或验证目标 MCP。执行说明与验证结果是后续独立步骤。

## 配置选项

### 环境变量

在启动 shell 或客户端配置中设置变量。CLI 不会自动加载 `.env` 或 `.mcpadvisorrc.json`，不要提交真实凭据。

| 配置 | 当前源码行为 |
| --- | --- |
| `TRANSPORT_TYPE` | 默认 `stdio`，可选 `http`；命令行 `--mode` 优先 |
| `SERVER_HOST`、`SERVER_PORT` | 默认 `127.0.0.1`、`3000`；`--host`/`--port` 优先 |
| `MCP_HTTP_RESPONSE_MODE` | 默认 `auto`，可选 `json`、`sse`；是响应编码而非旧 transport |
| `MCP_ALLOWED_HOSTS`、`MCP_ALLOWED_ORIGINS` | 逗号分隔的主机名，默认 SDK loopback guards |
| `LOG_LEVEL` | 默认 `info`，诊断可用 `debug` |
| `ENABLE_FILE_LOGGING`、`LOGS_DIR` | 文件日志显式开启，目录默认 `./logs` |
| `COMPASS_API_BASE` | 默认 `https://registry.mcphub.io` |
| `GETMCP_API_URL` | 默认 `https://getmcp.io/api/servers.json` |
| `CLINE_MARKETPLACE_ENABLED` | 仅值为 `true` 才启用；见 [Cline](./cline-marketplace.md) |
| `RERANK_PROVIDER` | 未设置/`none` 为关闭，`flashrank` 显式启用 |
| `RERANK_URL`、`RERANK_TIMEOUT_MS` | 默认 `http://127.0.0.1:8001/rerank`、`5000`；需要独立服务 |

文件日志开启前创建目录：

```bash
mkdir -p logs
ENABLE_FILE_LOGGING=true LOG_LEVEL=debug node build/index.js
```

仅设 `DEBUG=true` 不控制当前 logger。`LOGS_DIR` 配置日志输出；日志读取 resource 使用 `LOG_DIR`（回退到 `LOGS_DIR`），两者不能与 transport/search 配置混淆。

### 搜索配置

CLI 同时构造 Meilisearch、Compass、GetMCP；Cline 需显式开启，Nacos 需满足条件，SearchService 默认加入离线搜索。`SEARCH_PROVIDER` 不选择此列表。`MIN_SIMILARITY`、`MAX_RESULTS`、`ENABLE_CACHE`、`CACHE_TTL` 不是 CLI 的 SearchService 控制项。程序调用的 search 默认值为 `limit: 5`、`minSimilarity: 0.4`；offline 默认 `enabled: true`、`minSimilarity: 0.3`。

Meilisearch 默认 `cloud` 实例；本地配置和必须显式开启的目录写入操作见[本地 Meilisearch](./MEILISEARCH_LOCAL.md)。向量引擎配置的 `VECTOR_ENGINE_TYPE` 默认 `oceanbase`，它不选择 CLI provider。`OCEANBASE_URL` 属于该引擎配置，不等于 CLI 自动加入 OceanBase provider。

### Nacos 配置

只有 `NACOS_SERVER_ADDR`、`NACOS_USERNAME`、`NACOS_PASSWORD` **三项均存在且初始化成功**，CLI 才加入 Nacos。还传入 `MCP_HOST`（默认 `localhost`）、`MCP_PORT`（`3000`）、`AUTH_TOKEN`（空串）、`NACOS_DEBUG`（仅 `true` 开启）。CLI **不传递** `NACOS_NAMESPACE`、`NACOS_GROUP`、`MCP_SERVICE_NAME`；底层构造参数与自动读取环境变量不是一回事。

### 配置文件

[configLoader.ts](../src/config/configLoader.ts) 支持包括 `CONFIG_FILE` 在内的数据源配置，并不配置 CLI 的 transport/provider 列表。实际契约以 [src/index.ts](../src/index.ts)、[传输配置](../src/config/mcpTransport.ts)及[技术参考](./TECHNICAL_REFERENCE.zh-CN.md)为准。

### 传输配置

```bash
# 替代 stdio 的启动方式，不是同时启动第二种模式
TRANSPORT_TYPE=http node build/index.js
```

HTTP 固定使用 `http://127.0.0.1:3000/mcp`。`GET /health` 是健康检查；GET/DELETE `/mcp` 返回 405，不是浏览器界面。`POST /api/sources` 是独立应用 API。服务没有内置鉴权：除非已有鉴权且受限的部署环境，否则保持 loopback。Host/Origin guards 不等于鉴权或 CORS 支持。

旧 `sse`/`rest` 模式以及 `ENDPOINT`/`--endpoint`/`--messagePath` 被拒绝；HTTP `/sse`、`/messages`、`/rest` 返回 410。现代 `/mcp` 仍可用 SSE 编码响应。[保留的 legacy 源码](../src/services/core/server/legacy/README.md)仅供参考，不进入现代构建。详见[迁移、安全与回滚](./MCP_2026_MIGRATION.md)。

## 高级搜索参数

程序集成是源码级方式，不是包根导出 API。[SearchService](../src/services/searchService.ts) 使用结构化 `SearchParams` 和可选 `SearchOptions`。导入 npm 包根会执行 CLI，不会导出 SearchService。完整源码示例见[技术参考](./TECHNICAL_REFERENCE.zh-CN.md#开发自定义提供者)。

## 常见问题

- stdio 静默等待时，需要兼容客户端，不是浏览器。
- 旧握手/模式错误需要同时核对制品和客户端，不是只把 `/sse` 改成 `/mcp`。
- 结果为空或不全，应检查 provider 和日志；不能认为全部目录或可选模型都执行成功。
- 排查客户端前，先核对 Node、包管理器与 build 产物。

[故障排查](./TROUBLESHOOTING.zh-CN.md)正在草稿 #40 中更新，其中旧说明不构成启用已退役 transport 的依据；协议问题优先使用当前[迁移指南](./MCP_2026_MIGRATION.md)。

## 测试与证据

构建后 `pnpm run test:protocol` 检查协议；`pnpm test` 执行配置中的 Vitest 单元/集成套件。选定 Inspector UI 套件的前置条件与边界见 [Inspector 验证](./inspector-ui-testing.md)：

```bash
pnpm run test:e2e headless tests/e2e/mcp-inspector.spec.ts
```

省略测试路径会选择全部 Playwright 测试，不只是迁移后的套件。以上检查不证明搜索质量、真实托管兼容或推荐 MCP 已安装。请记录实际 SHA、命令、跳过与失败，不把文档当执行报告。
