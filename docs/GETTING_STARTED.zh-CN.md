# MCP Advisor 快速开始指南

[English](./GETTING_STARTED.en.md) | [简体中文](./GETTING_STARTED.zh-CN.md)

这是 MCP Advisor 的完整安装、配置和使用指南，让您快速上手并充分利用 MCP Advisor 的功能。

## 源码迁移与已发布版本

本指南的传输配置对应 issue #36 源码分支：要求 Node.js >= 20（`.nvmrc` 为 22）
及支持 MCP 2026-07-28 的客户端。执行
`pnpm install --frozen-lockfile && pnpm run build` 后，按[传输方式配置](#传输方式配置)启动。

下方包安装示例明确固定到已发布的 1.0.5 兼容／回滚版本，不会安装本次源码迁移。
具名客户端设置和第三方安装器不能作为现代分支兼容性证明。
受支持的 SDK 配置、协议要求和回滚步骤见[迁移指南](./MCP_2026_MIGRATION.md)。

## 目录

- [安装方式](#安装方式)
  - [通过 MCP 配置集成（推荐）](#通过-mcp-配置集成推荐)
  - [NPM 包安装](#npm-包安装)
  - [全局安装](#全局安装)
  - [直接使用](#直接使用)
  - [通过 Smithery 安装](#通过-smithery-安装)
- [基本使用](#基本使用)
  - [寻找 MCP 服务器](#寻找-mcp-服务器)
  - [理解搜索结果](#理解搜索结果)
  - [与 AI 助手集成](#与-ai-助手集成)
- [配置选项](#配置选项)
  - [环境变量配置](#环境变量配置)
  - [配置文件设置](#配置文件设置)
  - [传输方式配置](#传输方式配置)
- [使用技巧](#使用技巧)
  - [高效查询技巧](#高效查询技巧)
  - [高级搜索选项](#高级搜索选项)
- [常见问题排查](#常见问题排查)
  - [安装问题](#安装问题)
  - [配置问题](#配置问题)
  - [运行时问题](#运行时问题)

## 安装方式

### 通过 MCP 配置集成（推荐）

如需使用已发布的 1.0.5 兼容版本，可采用以下 MCP 配置：

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

将此配置添加到您的 AI 助手的 MCP 设置文件中：

- **MacOS/Linux**: `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows**: `%AppData%\Claude\claude_desktop_config.json`

配置完成后重启您的 AI 助手即可使用。

### NPM 包安装

如果您需要在项目中集成 MCP Advisor：

```bash
# 使用 npm
npm install @xiaohui-wang/mcpadvisor@1.0.5

# 使用 yarn
yarn add @xiaohui-wang/mcpadvisor@1.0.5

# 使用 pnpm
pnpm add @xiaohui-wang/mcpadvisor@1.0.5
```

### 全局安装

全局安装可以在任何地方使用 `mcpadvisor` 命令：

```bash
# 全局安装
npm install -g @xiaohui-wang/mcpadvisor@1.0.5

# 运行
mcpadvisor
```

### 直接使用

无需安装直接使用：

```bash
# 使用 npx 运行（无需安装）
npx @xiaohui-wang/mcpadvisor@1.0.5

# 或者使用 npx 运行特定版本
npx @xiaohui-wang/mcpadvisor@1.0.5
```

### 通过 Smithery 安装

使用 [Smithery](https://smithery.ai/server/@istarwyh/mcpadvisor) 自动安装到 Claude Desktop：

```bash
npx -y @smithery/cli install @istarwyh/mcpadvisor --client claude
```

## 基本使用

### 寻找 MCP 服务器

MCP Advisor 允许您通过自然语言查询发现和使用 MCP 服务器。以下是使用方法：

#### 1. 直接查询
向您的 AI 助手询问特定任务的 MCP 服务器：

```
哪些 MCP 服务器可以用于向量数据库集成？
```

```
Find MCP servers for natural language processing
```

#### 2. 功能导向查询
请求具有特定功能的服务器：

```
找一个用于图像生成的 MCP 服务器
```

```
I need an MCP server for image generation
```

#### 3. 任务导向查询
描述您想要完成的任务：

```
我需要分析金融数据，应该使用哪个 MCP 服务器？
```

```
I need to analyze financial data, which MCP server should I use?
```

### 理解搜索结果

MCP Advisor 返回的结果包含以下信息：

- **服务器名称**: MCP 服务器的名称
- **描述**: 服务器功能的简要说明
- **GitHub URL**: 服务器仓库的链接
- **安装说明**: 如何安装和配置服务器
- **相关性评分**: 服务器与您查询的匹配程度

#### 结果示例

```json
[
  {
    "title": "NLP Toolkit",
    "description": "Comprehensive natural language processing toolkit with sentiment analysis, entity recognition, and text summarization capabilities.",
    "github_url": "https://github.com/example/nlp-toolkit",
    "similarity": 0.92
  }
]
```

### 与 AI 助手集成

#### Claude Desktop

1. **配置 MCP Advisor**：
   
   将以下配置添加到 `claude_desktop_config.json`：
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

2. **重启 Claude Desktop**

3. **开始使用**：
   ```
   Claude，请帮我找一个用于数据库操作的 MCP 服务器
   ```

#### 其他 AI 助手

对于支持 Model Context Protocol 的其他 AI 助手：

1. **全局安装 MCP Advisor**：
   ```bash
   npm install -g @xiaohui-wang/mcpadvisor@1.0.5
   ```

2. **配置助手使用 MCP Advisor 作为服务器**

3. **参考您的助手文档了解具体的 MCP 集成步骤**

## 配置选项

### 环境变量配置

MCP Advisor 可以使用以下环境变量进行配置。所有环境变量都是可选的，除非另有说明。

#### 核心配置

| 变量 | 描述 | 默认值 | 必需 |
|------|------|--------|------|
| `TRANSPORT_TYPE` | 传输方法 (stdio, http) | `stdio` | 否 |
| `LOG_LEVEL` | 日志级别 (debug, info, warn, error) | `info` | 否 |
| `DEBUG` | 启用调试日志 | `false` | 否 |
| `ENABLE_FILE_LOGGING` | 启用文件日志 | `false` | 否 |

#### HTTP 服务器配置

| 变量 | 描述 | 默认值 |
| --- | --- | --- |
| `SERVER_HOST` | 绑定地址；未配置安全部署前请保持本地访问 | `127.0.0.1` |
| `SERVER_PORT` | HTTP 服务器端口 | `3000` |
| `MCP_HTTP_RESPONSE_MODE` | 响应编码：`auto`、`json` 或 `sse` | `auto` |
| `MCP_ALLOWED_HOSTS` | 显式部署使用的 Host 主机名白名单，逗号分隔 | 回环主机名 |
| `MCP_ALLOWED_ORIGINS` | 显式部署使用的 Origin 主机名白名单，逗号分隔 | 回环主机名 |

MCP 端点固定为 `/mcp`。`ENDPOINT`、`SSE_PATH`、`MESSAGE_PATH` 和 `messagePath`
不能配置现代协议端点。SDK 提供 Host 和 Origin 校验，但这不是认证，也不等于浏览器 CORS
配置。白名单填写主机名而不是 URL 路径；本阶段不新增跨域浏览器支持。
修改回环默认值前请阅读[部署说明](./MCP_2026_MIGRATION.md#deployment-and-security)。

#### 搜索配置

| 变量 | 描述 | 默认值 | 必需 |
|------|------|--------|------|
| `MIN_SIMILARITY` | 搜索结果的最小相似度分数 | `0.5` | 否 |
| `MAX_RESULTS` | 返回的最大搜索结果数 | `10` | 否 |
| `ENABLE_CACHE` | 启用搜索结果缓存 | `false` | 否 |
| `CACHE_TTL` | 缓存结果的生存时间（秒） | `3600` | 否 |
| `VECTOR_ENGINE_TYPE` | 向量引擎类型 (memory, oceanbase, meilisearch) | `memory` | 否 |

#### API 配置

| 变量 | 描述 | 默认值 | 必需 |
|------|------|--------|------|
| `COMPASS_API_BASE` | COMPASS API 的基础 URL | `https://registry.mcphub.io` | 否 |
| `OCEANBASE_URL` | OceanBase 数据库连接字符串 | - | 使用 OceanBase 时必需 |

#### Nacos Provider 配置

如果您选择使用 Nacos 作为搜索提供者：

| 环境变量 | 描述 | 默认值 | 必填 |
|---------|------|--------|------|
| `NACOS_SERVER_ADDR` | Nacos 服务器地址 | 无 | 是 |
| `NACOS_NAMESPACE` | Nacos 命名空间 | `public` | 否 |
| `NACOS_GROUP` | Nacos 分组 | `DEFAULT_GROUP` | 否 |
| `NACOS_USERNAME` | Nacos 用户名 | 无 | 如果 Nacos 需要认证 |
| `NACOS_PASSWORD` | Nacos 密码 | 无 | 如果 Nacos 需要认证 |
| `MCP_SERVICE_NAME` | MCP 服务在 Nacos 中的名称 | `mcp-servers` | 否 |

#### 日志配置

| 变量 | 描述 | 默认值 | 必需 |
|------|------|--------|------|
| `LOG_DIR` | 日志文件目录 | `./logs` | 否 |

### 配置文件设置

当前 CLI 不自动加载 `.mcpadvisorrc.json`，也不从 `config/default.json` 读取传输模式。
请使用本页列出的环境变量或 `--mode=stdio/http`。数据源配置与传输配置相互独立；
数据源细节请查看 [configLoader.ts](../src/config/configLoader.ts)。

### 传输方式配置

以下命令用于已构建的 issue #36 源码，要求 Node.js >= 20。
两种入口均拒绝旧版协议流量。

#### 1. Stdio Transport（默认）

```bash
node build/index.js
# 显式写法：node build/index.js --mode=stdio
```

客户端必须配置为 MCP 2026-07-28。即使使用 SDK v2 包，默认的旧 `initialize`
握手也不能连接此分支。

#### 2. 无状态 HTTP 传输

```bash
TRANSPORT_TYPE=http SERVER_HOST=127.0.0.1 SERVER_PORT=3000 node build/index.js
# 等价写法：node build/index.js --mode=http
```

现代客户端连接 `http://127.0.0.1:3000/mcp`，不需要会话 ID 或 `initialize` 握手。
`GET` 和 `DELETE /mcp` 返回 405。请使用[官方 SDK 客户端示例](./MCP_2026_MIGRATION.md#connect-with-the-official-sdk)
验证发现、工具列表和工具调用。

`MCP_HTTP_RESPONSE_MODE=auto` 默认返回 JSON，存在需要流式传送的关联消息时改用 SSE；
`json` 不传送中间进度／日志通知，`sse` 使用流式响应。这些是 `/mcp` 内部的响应编码，
不是已经废弃的 `TRANSPORT_TYPE=sse` 模式。

#### 从 SSE 或 REST 迁移

`TRANSPORT_TYPE=sse` / `TRANSPORT_TYPE=rest` 和 `--mode=sse` / `--mode=rest` 会被拒绝并给出迁移提示。
HTTP 模式下，`/sse`、`/messages`、`/rest` 返回 410 和迁移 JSON。
需要一起修改启动模式、端点和客户端协议支持，不能仅替换旧客户端 URL。
旧实现保留在 `src/services/core/server/legacy/`，不进入构建或运行链路。

`GET /health` 仍用于 HTTP 健康检查；`POST /api/sources` 保持为独立应用 API，
不是 MCP 端点。服务没有内置认证；配置带认证的反向代理和网络限制前请保留回环绑定。
Host／Origin 白名单不能替代认证。

调试文件日志示例：

```bash
mkdir -p logs
TRANSPORT_TYPE=http LOG_LEVEL=debug ENABLE_FILE_LOGGING=true node build/index.js
```

完整兼容性、安全边界和回滚步骤见[迁移指南](./MCP_2026_MIGRATION.md)。

## 使用技巧

### 高效查询技巧

为了从 MCP Advisor 获得最佳结果：

#### 1. 具体化描述
包含关键功能需求：

```
找一个支持多语言的 OCR MCP 服务器
```

```
Find an MCP server for OCR with support for multiple languages
```

#### 2. 包含领域上下文
提及您的应用领域：

```
需要一个具有合规功能的金融数据分析 MCP 服务器
```

```
MCP server for financial data analysis with regulatory compliance features
```

#### 3. 指定技术要求
包含任何技术限制：

```
找一个轻量级的离线图像处理 MCP 服务器
```

```
Find a lightweight MCP server for image processing that works offline
```

### 高级搜索选项

当以编程方式使用 MCP Advisor 时，您可以指定其他搜索参数：

```typescript
const results = await searchService.search("vector database", {
  limit: 10,
  minSimilarity: 0.2,
  includeMetadata: true
});
```

## 常见问题排查

### 安装问题

#### 1. 权限错误

如果遇到权限错误，请尝试使用管理员权限：

```bash
# macOS/Linux
sudo npm install -g @xiaohui-wang/mcpadvisor@1.0.5

# Windows (以管理员身份运行命令提示符)
npm install -g @xiaohui-wang/mcpadvisor@1.0.5
```

#### 2. 版本冲突

如果与其他包有版本冲突：

```bash
npm install @xiaohui-wang/mcpadvisor@1.0.5 --force
```

#### 3. 找不到命令

确保全局 npm bin 目录在您的 PATH 中：

```bash
# 查看 npm 全局路径
npm bin -g

# 添加到 PATH（macOS/Linux）
export PATH="$PATH:$(npm bin -g)"

# Windows
set PATH=%PATH%;%APPDATA%\npm
```

### 配置问题

#### 1. MCP 配置不生效

检查配置文件路径：

- **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows**: `%AppData%\Claude\claude_desktop_config.json`

确保 JSON 格式正确：

```bash
# 验证 JSON 格式
cat ~/.../claude_desktop_config.json | python -m json.tool
```

#### 2. 环境变量不生效

确认环境变量设置：

```bash
# Linux/macOS
echo $TRANSPORT_TYPE
export TRANSPORT_TYPE=http

# Windows
echo %TRANSPORT_TYPE%
set TRANSPORT_TYPE=http
```

### 运行时问题

#### 1. 连接被拒绝

确保服务器运行在指定端口并检查防火墙设置：

```bash
# 检查端口占用
netstat -an | grep 3000
lsof -i :3000

# 检查服务状态
curl http://127.0.0.1:3000/health
```

#### 2. 搜索无结果

尝试更通用的查询：

```
# 从具体查询
"advanced machine learning vector database with GPU acceleration"

# 改为通用查询  
"machine learning" 或 "vector database"
```

检查网络连接：

```bash
# 测试外部 API 连接
curl -I https://api.getmcp.org
ping registry.mcphub.io
```

#### 3. 性能问题

考虑以下优化：

- 使用更具体的搜索词
- 检查服务器资源（CPU/内存）
- 启用缓存：`ENABLE_CACHE=true`
- 调整搜索限制：`MAX_RESULTS=5`

### 验证安装

CLI 没有专用的 `--version` 或 `--help` 处理，不能据此验证启动成功。
使用[官方 SDK 客户端示例](./MCP_2026_MIGRATION.md#connect-with-the-official-sdk)
连接现代源码服务，确认工具列表包含 `recommend-mcp-servers`，再发起调用。

HTTP 模式可以先检查监听状态：

```bash
curl http://127.0.0.1:3000/health
```

该端点不适用于 stdio。健康检查成功不等于协议兼容，也不证明外部搜索提供者可用。

---

如果您遇到本指南未涵盖的问题，请：

1. 查看 [故障排除文档](./TROUBLESHOOTING.zh-CN.md)
2. 检查 [GitHub Issues](https://github.com/istarwyh/mcpadvisor/issues)
3. 创建新的 Issue 寻求帮助

更多高级配置和技术细节，请参阅：
- [技术参考手册](./TECHNICAL_REFERENCE.zh-CN.md)
- [架构文档](./ARCHITECTURE.zh-CN.md)
- [贡献指南](../CONTRIBUTING.md)