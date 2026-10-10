# MCP Advisor 快速开始指南

[English](./GETTING_STARTED.en.md) | [简体中文](./GETTING_STARTED.zh-CN.md)

这是 MCP Advisor 的完整安装、配置和使用指南，让您快速上手并充分利用 MCP Advisor 的功能。

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

最快的方式是通过 MCP 配置集成 MCP Advisor：

```json
{
  "mcpServers": {
    "mcpadvisor": {
      "command": "npx",
      "args": ["-y", "@xiaohui-wang/mcpadvisor"]
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
npm install @xiaohui-wang/mcpadvisor

# 使用 yarn
yarn add @xiaohui-wang/mcpadvisor

# 使用 pnpm
pnpm add @xiaohui-wang/mcpadvisor
```

### 全局安装

全局安装可以在任何地方使用 `mcpadvisor` 命令：

```bash
# 全局安装
npm install -g @xiaohui-wang/mcpadvisor

# 运行
mcpadvisor
```

### 直接使用

无需安装直接使用：

```bash
# 使用 npx 运行（无需安装）
npx @xiaohui-wang/mcpadvisor

# 或者使用 npx 运行特定版本
npx @xiaohui-wang/mcpadvisor@latest
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
         "args": ["-y", "@xiaohui-wang/mcpadvisor"]
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
   npm install -g @xiaohui-wang/mcpadvisor
   ```

2. **配置助手使用 MCP Advisor 作为服务器**

3. **参考您的助手文档了解具体的 MCP 集成步骤**

## 配置选项

### 环境变量配置

MCP Advisor 可以使用以下环境变量进行配置。所有环境变量都是可选的，除非另有说明。

#### 核心配置

| 变量 | 描述 | 默认值 | 必需 |
|------|------|--------|------|
| `TRANSPORT_TYPE` | 传输方法 (stdio, sse, rest) | `stdio` | 否 |
| `LOG_LEVEL` | 日志级别 (debug, info, warn, error) | `info` | 否 |
| `DEBUG` | 启用调试日志 | `false` | 否 |
| `ENABLE_FILE_LOGGING` | 启用文件日志 | `false` | 否 |

#### HTTP 服务器配置（SSE/REST 传输）

| 变量 | 描述 | 默认值 | 必需 |
|------|------|--------|------|
| `SERVER_PORT` | HTTP 服务器端口 | `3000` | 否 |
| `SERVER_HOST` | HTTP 服务器主机 | `localhost` | 否 |
| `SSE_PATH` | SSE 端点路径 | `/sse` | 否 |
| `MESSAGE_PATH` | 消息端点路径 | `/messages` | 否 |
| `ENDPOINT` | REST 端点路径 | `/rest` | 否 |

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

您也可以使用配置文件进行设置。创建 `.mcpadvisorrc.json` 文件：

```json
{
  "transport": "stdio",
  "port": 3000,
  "enableFileLogging": true,
  "logLevel": "info",
  "vectorEngineType": "memory",
  "search": {
    "provider": "hybrid",
    "limit": 5,
    "minSimilarity": 0.3
  }
}
```

或者使用 `config/default.json`：

```json
{
  "server": {
    "port": 3000,
    "transportType": "stdio"
  },
  "search": {
    "provider": "hybrid",
    "limit": 5,
    "minSimilarity": 0.3
  }
}
```

### 传输方式配置

MCP Advisor 支持多种传输方式：

#### 1. Stdio Transport（默认）
适用于命令行工具：

```bash
node build/index.js
```

#### 2. SSE Transport
适用于 Web 集成：

```bash
TRANSPORT_TYPE=sse SERVER_PORT=3000 DEBUG=true ENABLE_FILE_LOGGING=true node build/index.js
```

#### 3. REST Transport
提供 RESTful 端点：

```bash
TRANSPORT_TYPE=rest SERVER_PORT=8080 ENDPOINT=/api/mcp node build/index.js
```

#### 生产配置示例

```bash
TRANSPORT_TYPE=rest SERVER_PORT=8080 SERVER_HOST=0.0.0.0 LOG_LEVEL=warn ENABLE_FILE_LOGGING=true node build/index.js
```

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
sudo npm install -g @xiaohui-wang/mcpadvisor

# Windows (以管理员身份运行命令提示符)
npm install -g @xiaohui-wang/mcpadvisor
```

#### 2. 版本冲突

如果与其他包有版本冲突：

```bash
npm install @xiaohui-wang/mcpadvisor --force
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
export TRANSPORT_TYPE=sse

# Windows
echo %TRANSPORT_TYPE%
set TRANSPORT_TYPE=sse
```

### 运行时问题

#### 1. 连接被拒绝

确保服务器运行在指定端口并检查防火墙设置：

```bash
# 检查端口占用
netstat -an | grep 3000
lsof -i :3000

# 检查服务状态
curl http://localhost:3000/health
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

运行以下命令验证安装：

```bash
# 检查版本
mcpadvisor --version

# 或者
npx @xiaohui-wang/mcpadvisor --version

# 测试基本功能
mcpadvisor --help
```

如果显示版本号和帮助信息，则表示安装成功。

---

如果您遇到本指南未涵盖的问题，请：

1. 查看 [故障排除文档](./TROUBLESHOOTING.zh-CN.md)
2. 检查 [GitHub Issues](https://github.com/istarwyh/mcpadvisor/issues)
3. 创建新的 Issue 寻求帮助

更多高级配置和技术细节，请参阅：
- [技术参考手册](./TECHNICAL_REFERENCE.zh-CN.md)
- [架构文档](./ARCHITECTURE.zh-CN.md)
- [贡献指南](../CONTRIBUTING.md)