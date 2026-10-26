# MCP Advisor

[English](README.md) | [简体中文](README_zh.md)

MCP Advisor 帮助 MCP 客户端按任务发现服务器并获取安装指导。它聚合搜索来源、
返回推荐和配置文字，**不会自动安装服务器、改写客户端配置，也不替你完成推荐项目的安全审查**。

## 从这里开始

1. **使用当前源码**：[快速开始](docs/GETTING_STARTED.zh-CN.md) 介绍 MCP 2026-07-28、
   stdio 和 HTTP。
2. **兼容旧客户端**：npm 已发布的 `1.0.5` 是独立的旧版本，不要套用当前源码的传输配置。
3. **开发与排障**：阅读[贡献指南](CONTRIBUTING.zh-CN.md)、
   [系统架构](docs/ARCHITECTURE.zh-CN.md)和[技术参考](docs/TECHNICAL_REFERENCE.zh-CN.md)。
   当前协议问题优先看[迁移指南（英文）](docs/MCP_2026_MIGRATION.md)。

### 获奖背景

据[主办方 2025 年 5 月 19 日报道](https://www.modb.pro/db/1924452526657646592)，
MCP Advisor 由 `mcpadvisor` 团队开发，该团队获得了 **2025 年首届 OceanBase AI 黑客松大赛二等奖**。
报道介绍了团队的 MCP 搜索推荐项目；赛事于 2025 年 5 月 17 日在广州收官。
[作者在 OceanBase 社区的介绍](https://ask.oceanbase.com/t/topic/35625183)
将该项目与本仓库关联。这是历史获奖记录，不是当前所有功能的质量测评或背书。

## 当前能力

| 能力 | 当前源码状态 |
| --- | --- |
| `recommend-mcp-servers` | 按任务推荐，可传关键词和能力要求 |
| `install-mcp-server` | 仅返回安装指导及配置文字，不执行安装 |
| Meilisearch、Compass、GetMCP | CLI 默认构造；仍依赖外部服务可用性与配置 |
| 离线提供者 | SearchService 默认启用；嵌入模型可能需要联网下载 |
| Nacos 发现 | 可选；CLI 必须同时配置地址、用户名、密码 |
| Cline Marketplace | 已实现，`CLINE_MARKETPLACE_ENABLED=true` 显式启用 |
| FlashRank 重排 | 已实现、默认关闭；需独立启动 Python 服务及模型 |
| 搜索质量评估 | 有工具和示意数据，不代表生产质量已获验证 |
| 自动安装 / 质量保证 | 未实现 / 未建立 |

当前 Meilisearch 提供者使用文本搜索；离线检索结合文本和向量。没有通用向量检索、
按查询动态调权或固定返回五条结果的保证。离线数据也不意味着 CLI 不会访问在线来源。

## 选择运行方式

### 当前源码（现代协议）

应用要求 Node.js 20+；Inspector 2.10.1 还要求 Node.js 22.19+。
使用 `package.json` 固定的 pnpm 8.15.9。

```sh
git clone https://github.com/istarwyh/mcpadvisor.git
cd mcpadvisor
corepack enable
pnpm install --frozen-lockfile
pnpm run build
node build/index.js
```

默认使用 stdio，诊断信息不能写入 stdout。本机 HTTP：

```sh
TRANSPORT_TYPE=http SERVER_HOST=127.0.0.1 SERVER_PORT=3000 node build/index.js
```

使用兼容 MCP 2026-07-28 的客户端连接 `http://127.0.0.1:3000/mcp`。
参见[官方 SDK 客户端示例（英文）](docs/MCP_2026_MIGRATION.md#connect-with-the-official-sdk)。
HTTP 每次请求创建协议服务器，提供者缓存仍可由进程共享。旧 SSE/REST 模式被拒绝、
旧 HTTP 路径返回 410；现代 POST 的响应仍可能采用 SSE 编码。
没有内置认证或跨源浏览器 CORS，默认保持回环绑定；远程开放需要独立安全网关，
文档不代表托管验收通过。

### 已发布 npm 1.0.5（旧版）

```sh
npx -y @xiaohui-wang/mcpadvisor@1.0.5
```

这运行旧的已发布包，不是以上当前源码；请核对该版本自身的客户端兼容性和配置。
源码 package.json 仍写 1.0.5，不代表新增改动已经发布到 npm。

### 第三方安装器

市场或 Smithery 的条目与安装器独立维护。执行前检查其实际版本、权限及传输支持；
本指南不保证它们提供当前现代协议源码。

## 配置与专题入口

CLI 不读取 `SEARCH_PROVIDER`、`SEARCH_LIMIT`、`SEARCH_MIN_SIMILARITY`；
提供者注入和 `SearchOptions` 是程序化 API，不是环境变量。
不要从 npm 包根导入 SearchService：包入口是有启动副作用的 CLI。
参见[源码 API 示例](docs/TECHNICAL_REFERENCE.zh-CN.md)。

| 主题 | 文档 |
| --- | --- |
| CLI、HTTP、Nacos 三项凭据与程序化参数 | [快速开始](docs/GETTING_STARTED.zh-CN.md) |
| 本地 Meilisearch 生命周期 | [本地 Meilisearch（英文）](docs/MEILISEARCH_LOCAL.md) |
| 文本检索 | [全文搜索（英文）](docs/full-text-search.md) |
| 可选 Cline 来源 | [Cline Marketplace（英文）](docs/cline-marketplace.md) |
| 独立模型服务、失败回退和隐私 | [FlashRank（英文）](docs/professional-reranking.md) |
| 标注、指标及示意数据边界 | [搜索质量评估（英文）](docs/search-quality-evaluation.md) |
| 浏览器与 Inspector 检查前置条件 | [Inspector（英文）](docs/inspector-ui-testing.md) |
| 现代协议与回滚边界 | [迁移指南（英文）](docs/MCP_2026_MIGRATION.md) |
| 较早的运行排障资料 | [故障排除](docs/TROUBLESHOOTING.zh-CN.md) |

故障排除的托管相关修订由 PR #40 单独跟进；当前传输行为以迁移指南为准，
这里没有引入尚未合并的托管配置。

## 验证修改

```sh
pnpm run check
pnpm test
pnpm run build
pnpm run test:protocol
```

以上分别覆盖 lint/格式、Vitest、生产编译及离线协议/启动检查，不证明真实外部来源可用或排序质量。
Playwright 聚合套件是 `pnpm run test:e2e`（`scripts/e2e/e2e.run.sh`），
需要其浏览器及服务前置条件；只跑 Inspector 单个 spec 不等于完整端到端测试。
详见[贡献指南](CONTRIBUTING.zh-CN.md)。

## 后续方向

[路线图](docs/ROADMAP.md) 保留历史计划，不承诺原定日期。
Cline 和 FlashRank 已是可选实现，不能继续列为未实现 TODO。
新的提供者、质量结论和部署都需要独立范围与证据。

[文档核对记录（英文）](docs/DOCUMENTATION_REVIEW.md) 说明源码基线、验证边界及语言镜像规则。
欢迎通过明确的 issue 与经过验证的小范围 PR 贡献。
