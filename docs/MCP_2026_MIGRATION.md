# MCP 2026-07-28 migration

This guide describes the issue #36 source change. It is a breaking protocol
migration, not a claim that a new npm release has been published. The previously
published `@xiaohui-wang/mcpadvisor@1.0.5` remains the explicit compatibility and
rollback target. Do not use `@latest` to select this migration or a rollback.

## Compatibility boundary

| Surface | This source branch |
| --- | --- |
| Runtime | Node.js >= 20; `.nvmrc` selects 22 |
| Protocol | MCP `2026-07-28` only, on both transports |
| Default local transport | stdio |
| Remote transport | HTTP, fixed endpoint `/mcp` |
| Server SDK | `@modelcontextprotocol/server` and `@modelcontextprotocol/core`, exact `2.3.1` |
| Node HTTP adapter | `@modelcontextprotocol/node`, exact `2.1.1` |
| SDK client used for verification | `@modelcontextprotocol/client`, exact `2.3.1`, with explicit modern negotiation |
| Old transport packages | Not needed by the active build/runtime; archived code is not a compatibility runtime |
| Desktop clients / installers | No blanket compatibility claim; verify the client's protocol support and settings |

The official [SDK release notes](https://github.com/modelcontextprotocol/typescript-sdk/releases/tag/v2.3.1)
identify the 2.3.1 packages; the [2.3.0 release notes](https://github.com/modelcontextprotocol/typescript-sdk/releases/tag/v2.3.0)
list the unchanged Node adapter at 2.1.1. These package versions and MCP's date-based
protocol revision are different version numbers.

**An SDK v2 dependency alone is insufficient.** Its default client behavior still
uses the old `initialize` handshake. Configure modern version negotiation
explicitly. Pinning `2026-07-28` avoids an accidental legacy fallback; `auto` is
also a negotiation option, but a legacy result cannot use this server.
See the official [protocol-version guide](https://ts.sdk.modelcontextprotocol.io/v2/protocol-versions).

## Start from source

Use a checkout containing this change, rather than a registry package:

```bash
nvm use
pnpm install --frozen-lockfile
pnpm run build
```

Local stdio remains the default:

```bash
node build/index.js
# Equivalent: node build/index.js --mode=stdio
```

For HTTP, start a separate process instead:

```bash
TRANSPORT_TYPE=http node build/index.js
# Equivalent: node build/index.js --mode=http
```

The default listener is `127.0.0.1:3000`, and the MCP URL is
`http://127.0.0.1:3000/mcp`. A stdio process waits for protocol messages on stdin;
its lack of a web listener is expected. Diagnostics belong on stderr, not stdout.

## Connect with the official SDK

Use Node.js >= 20. In a separate test directory, install the exact client package:

```bash
npm init -y
npm install --save-exact @modelcontextprotocol/client@2.3.1
```

Save the following as `verify-mcp.mjs` and run `node verify-mcp.mjs` while the HTTP
server is running. This is a modern SDK configuration, not a desktop client's
settings-file schema:

```javascript
import {
  Client,
  StreamableHTTPClientTransport,
} from '@modelcontextprotocol/client';

const advisor = new Client(
  { name: 'mcpadvisor-migration-check', version: '1.0.0' },
  { versionNegotiation: { mode: { pin: '2026-07-28' } } },
);
const transport = new StreamableHTTPClientTransport(
  new URL('http://127.0.0.1:3000/mcp'),
);

try {
  await advisor.connect(transport);
  console.log('Protocol era:', advisor.getProtocolEra()); // modern
  console.log('Tools:', await advisor.listTools());
  console.log('Resources:', await advisor.listResources());

  // This also exercises configured search providers and may need network access.
  if (process.env.TEST_SEARCH === 'true') {
    console.log(
      await advisor.callTool({
        name: 'recommend-mcp-servers',
        arguments: {
          taskDescription: 'Search documents in a local knowledge base',
          keywords: ['search'],
          capabilities: [],
        },
      }),
    );
  }
} finally {
  await advisor.close();
}
```

Run `TEST_SEARCH=true node verify-mcp.mjs` to exercise the recommendation call.
Tool discovery should include `recommend-mcp-servers` and `install-mcp-server`.
The latter returns installation/configuration guidance; it does not install
software itself. Resource listings depend on the configured log directories.
A successful protocol check does not prove every external provider is healthy.

To verify stdio instead, keep the same client options and replace the HTTP
transport construction with the following. Supply the actual absolute paths to
the built checkout; do not start another stdio server manually:

```javascript
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio';

const transport = new StdioClientTransport({
  command: process.execPath,
  args: ['/absolute/path/to/mcpadvisor/build/index.js', '--mode=stdio'],
  cwd: '/absolute/path/to/mcpadvisor',
});
```

The explicit mode avoids inheriting an HTTP selection. The SDK may use a disposable
sibling process for stdio discovery, so verification can start the application
more than once. This is discovery behavior, not an MCP session. Client transport
imports and cleanup are documented in the official
[client guide](https://ts.sdk.modelcontextprotocol.io/v2/clients/connect.html).

## Server composition and wire behavior

The current implementation separates responsibilities:

- [McpServerFactory.ts](../src/services/core/server/stateless/McpServerFactory.ts)
  builds fresh SDK server instances and registers existing business tools/resources.
- [StatelessHttpServer.ts](../src/services/core/server/stateless/StatelessHttpServer.ts)
  owns HTTP routing, Host/Origin guards, and the Node adapter.
- [ServerService.ts](../src/services/core/server/ServerService.ts) coordinates
  lifecycle and stdio/HTTP selection.
- [mcpTransport.ts](../src/config/mcpTransport.ts) parses and validates launch settings.
- [legacy/](../src/services/core/server/legacy/) retains the old server, request
  factory, and Express transport as archived source. It is excluded from production
  compilation and the active import graph, not dynamically selected at runtime.

The relevant SDK entry configuration is:

```typescript
// factory registers MCPAdvisor's shared business tools/resources on each instance.
const httpHandler = createMcpHandler(factory, {
  legacy: 'reject',
  responseMode: 'auto',
});
// Use this in the alternative stdio launch mode, not alongside HTTP by default.
const stdioHandle = serveStdio(factory, { legacy: 'reject' });
```

`createMcpHandler` is imported from `@modelcontextprotocol/server`;
`serveStdio` comes from `@modelcontextprotocol/server/stdio`. HTTP wraps the handler
with `toNodeHandler` from `@modelcontextprotocol/node` **after** SDK Host/Origin
guards. The configuration excerpt is not a replacement for the project's secured
HTTP adapter. See the SDK's [HTTP serving guide](https://ts.sdk.modelcontextprotocol.io/v2/serving/http.html)
and [stdio serving guide](https://ts.sdk.modelcontextprotocol.io/v2/serving/stdio.html).

The modern protocol carries version/capability metadata with requests. SDK code
owns discovery, metadata serialization and validation, HTTP-header/body agreement,
and protocol errors. Do not handcraft a partial envelope or simply add a version
header to an old request. The protocol's
[versioning specification](https://modelcontextprotocol.io/specification/2026-07-28/basic/versioning)
explains the replacement for the old handshake.

There is no `initialize`/`notifications/initialized` lifecycle, MCP session ID,
session store, session replay, or separate GET event stream in this deployment.
Each HTTP request gets its own server instance. Shared providers and caches may
still exist for the lifetime of the process; “stateless” describes protocol state,
not an absence of business state or side effects.

`MCP_HTTP_RESPONSE_MODE` controls responses to modern requests:

| Value | Behavior |
| --- | --- |
| `auto` (default) | JSON unless related messages require streaming |
| `sse` | Stream the request's response using SSE |
| `json` | Return the final JSON result; intermediate progress/log messages are dropped |

SSE encoding inside a `/mcp` POST response does not restore the old `/sse` transport.
These modes follow the official
[`createMcpHandler` API](https://ts.sdk.modelcontextprotocol.io/v2/api/@modelcontextprotocol/server/server/createMcpHandler.html).
Transport cancellation closes the request exchange; existing search providers are
not guaranteed to honor cancellation or abort underlying network/model work.
Do not assume that disconnecting a client rolls back business effects.

## Endpoint and launch migration

| Old usage | Required change / response |
| --- | --- |
| `TRANSPORT_TYPE=sse` or `--mode=sse` | Rejected at startup; use `http` and a modern client |
| `TRANSPORT_TYPE=rest` or `--mode=rest` | Rejected at startup; use `http` and a modern client |
| `ENDPOINT`, `--endpoint`, `--messagePath` | Remove them; these old endpoint settings are rejected |
| `SSE_PATH` / `MESSAGE_PATH` | Remove them; they do not configure the modern endpoint |
| `/sse`, `/messages`, `/rest` | HTTP 410 with migration JSON when HTTP mode is running |
| Custom old REST URL | Update explicitly to `/mcp`; arbitrary historical paths are not aliases |
| `GET /mcp` | 405; no standalone event stream |
| `DELETE /mcp` | 405; no session termination endpoint |
| Legacy `initialize` on `/mcp` | Unsupported-protocol error; no fallback server is created |
| `GET /health` | Preserved, separate HTTP health endpoint |
| `POST /api/sources` | Preserved, separate application API; not an MCP protocol endpoint |

All HTTP routes first pass the Host/Origin guards. A rejected host/origin can
therefore produce a guard error before the status in this table. The SDK's strict
mode may acknowledge a legacy notification with 202 and discard it; that is not
legacy support or a successful initialization. See the official
[legacy-policy guide](https://ts.sdk.modelcontextprotocol.io/v2/serving/legacy-clients.html).

Basic route checks, with the local HTTP process running:

```bash
curl -i http://127.0.0.1:3000/health
curl -i http://127.0.0.1:3000/sse
curl -i http://127.0.0.1:3000/mcp
curl -i -X DELETE http://127.0.0.1:3000/mcp
```

Expected statuses are 200, 410, 405, and 405 respectively. Use the SDK example for
actual protocol verification; opening `/mcp` in a browser is not a connection test.

## Deployment and security

There is **no built-in authentication**. The loopback default is intentional.
Before exposing the service, provide authenticated access, TLS where appropriate,
and network restrictions. Apply them to every route, including the source-management
API and health route. MCP tools may expose configured log resources or call external
providers, so this is not a public anonymous endpoint by default.

| Setting | Default / purpose |
| --- | --- |
| `SERVER_HOST` / `--host` | `127.0.0.1`, listener bind address |
| `SERVER_PORT` / `--port` | `3000`, integer 1–65535 |
| `MCP_ALLOWED_HOSTS` | Allowed Host hostnames, comma-separated |
| `MCP_ALLOWED_ORIGINS` | Allowed Origin hostnames, comma-separated |
| Both allow-lists when unset | `localhost`, `127.0.0.1`, `[::1]` |

Explicit lists replace their defaults. Use narrowly named hosts, for example
`MCP_ALLOWED_HOSTS=advisor.example.com,127.0.0.1` and
`MCP_ALLOWED_ORIGINS=console.example.com`. The values are **hostnames**, not full
URLs, schemes, ports, or paths. These variables do not configure credentials or
CORS response headers. Do not use a broad wildcard as a deployment shortcut.
Behind a proxy, ensure the Host/Origin values reaching the application match the
intended allow-lists; changing the bind address alone does not change those lists.
Requests without Origin can still pass the SDK guard, so Origin is not identity.

This phase does not add a browser CORS allow-list extension or cross-origin
browser integration. An allowed Origin does not make a browser's preflight or
response exposure work automatically. Use a supported non-browser SDK client or
separately design and review the browser-facing deployment.

The SDK reads and bounds `/mcp` bodies (default 4 MiB); there is no global Express
JSON parser before it. The separate `/api/sources` route has a 1 MiB JSON limit.
No legacy HTTP server is mounted alongside the new one.

## Rollback

A rollback selects a previously published artifact/deployment; it does not enable
`legacy/` in the modern source build.

1. Keep the prior release artifact, deployment configuration, and client settings
   before rollout. Record the exact new commit/artifact under test.
2. If a required client cannot speak MCP 2026-07-28, stop the new process and restore
   the previous deployment. For a local npm launch, explicitly select:
   `npx -y @xiaohui-wang/mcpadvisor@1.0.5`.
3. Restore that release's transport settings, endpoint, and compatible client setup
   together. New `http`/`/mcp` settings are not a recipe for the old release.
4. Verify tool listing and a representative call with the intended client.
   Preserve the previous network/authentication controls when restoring HTTP service.

A pinned modern client will reject a legacy-only rollback endpoint. Adjust its
configuration deliberately or restore the original client, rather than hiding the
protocol mismatch. Do not remove `legacy: 'reject'`, import the archived server,
or install old SDKs into this branch as an undocumented fallback.

## 中文迁移摘要

- 本次是源码分支的协议迁移，尚不代表 npm 已发布新版本。测试使用包含本次变更的源码；
  回滚显式选择 `@xiaohui-wang/mcpadvisor@1.0.5`，不要依赖 `@latest`。
- Node.js 最低为 20，`.nvmrc` 选择 22。本地默认仍为 stdio；远程选择
  `TRANSPORT_TYPE=http` 或 `--mode=http`，固定连接 `/mcp`。
- 两种入口均仅支持 MCP 2026-07-28。官方 SDK v2 客户端默认仍走旧握手，必须显式设置
  `versionNegotiation: { mode: { pin: '2026-07-28' } }`；上方示例使用 client 2.3.1。
  尚未验证具名桌面客户端对该新协议的兼容性。
- 旧 `sse/rest` 启动模式会报错；HTTP 模式下旧 `/sse`、`/messages`、`/rest` 返回 410。
  不能只改 URL 而不升级客户端协议。旧实现保留于独立 `legacy/` 目录，不进入构建或运行链路。
- 不再使用旧初始化握手、会话 ID 或独立 GET 事件流；`GET`／`DELETE /mcp` 返回 405。
  `auto/json/sse` 只是现代响应编码，`json` 会丢弃中间进度／日志通知。
- `/health` 和 `/api/sources` 保持为独立应用路由。Host／Origin 校验覆盖所有 HTTP 路由。
  没有内置认证，也没有新增跨域浏览器 CORS 功能；白名单不能替代认证和网络限制。
- 客户端取消不保证业务提供者停止底层工作。回滚应恢复旧制品及其客户端／端点配置，
  不要重新导入归档代码作为隐式兼容层。
