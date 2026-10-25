# MCP Advisor Quick Start Guide

[English](./GETTING_STARTED.md) | [简体中文](./GETTING_STARTED.zh-CN.md)

This is a current-source operating guide, checked against main `94829fd` on
2026-10-25. Choose an artifact first; source changes do not establish that the
same capabilities are published to npm or available through a hosted gateway.

## Installation Methods

### Modern source build

Requires Node.js >=20, pnpm **8.15.9**, Git and a POSIX shell. `.nvmrc` selects
Node.js 22. The optional Inspector UI harness requires **Node.js >=22.19.0**.

```bash
git clone https://github.com/istarwyh/mcpadvisor.git
cd mcpadvisor
pnpm install --frozen-lockfile
pnpm run build
node build/index.js
```

The last command starts stdio and waits for an MCP client; it is not a search
prompt. Use a client explicitly configured for **MCP 2026-07-28**. Follow the
[official SDK example](./MCP_2026_MIGRATION.md#connect-with-the-official-sdk)
for discovery, tools/list and a first call. SDK v2 alone does not imply modern
protocol negotiation. Named desktop-client compatibility is not established here.

### Published compatibility version

For historical clients and rollback, the documented npm artifact is fixed at
**1.0.5**. This does not install the modern source transport.

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

For Claude Desktop, the historical settings paths are
`~/Library/Application Support/Claude/claude_desktop_config.json` on macOS and
`%AppData%\Claude\claude_desktop_config.json` on Windows. Use the client's own
instructions on Linux or with another client. These paths are not proof of
modern-protocol support. Third-party install buttons and hosted listings are
not versioned acceptance evidence; hosting migration is tracked separately in
[#36](https://github.com/istarwyh/mcpadvisor/issues/36) and draft
[#40](https://github.com/istarwyh/mcpadvisor/pull/40).

## Basic Usage

### Find MCP Servers

Ask your client to call `recommend-mcp-servers`, for example with these tool
arguments (not a complete JSON-RPC envelope):

```json
{
  "taskDescription": "Find MCP servers to query PostgreSQL schema metadata",
  "keywords": ["PostgreSQL"],
  "capabilities": ["schema inspection"]
}
```

Use a specific workflow and constraints rather than only a broad category.
`query` is a compatibility alias for `taskDescription`; prefer the latter.
The tool accepts optional keywords/capabilities as strings or string arrays.

### Understand Search Results

Expect MCP text content containing candidate names, descriptions, source URLs
and available metadata. An empty result is possible. Scores are ranking signals,
not calibrated confidence or proof of suitability. Check each candidate's
source, permissions, maintenance and instructions before use. Provider network
access and catalog freshness can affect results; an offline result does not
prove an online provider succeeded.

### Installation guidance

`install-mcp-server` requires `mcpName` and `sourceUrl`, with optional `mcpClient`.
It returns installation/configuration **guidance only**. It does not install,
start or verify another MCP server. Follow and validate that guidance separately.

## Configuration Options

### Environment Variables

Set variables in the launching shell or client configuration. The CLI does not
automatically load `.env` or `.mcpadvisorrc.json`. Do not commit real credentials.

| Setting | Current source behavior |
| --- | --- |
| `TRANSPORT_TYPE` | `stdio` (default) or `http`; CLI `--mode` takes precedence |
| `SERVER_HOST`, `SERVER_PORT` | `127.0.0.1`, `3000`; CLI `--host`/`--port` override |
| `MCP_HTTP_RESPONSE_MODE` | `auto` (default), `json`, `sse`; response encoding, not legacy transport |
| `MCP_ALLOWED_HOSTS`, `MCP_ALLOWED_ORIGINS` | Comma-separated hostnames; defaults use SDK loopback guards |
| `LOG_LEVEL` | `info` by default; use `debug` for diagnosis |
| `ENABLE_FILE_LOGGING`, `LOGS_DIR` | File logging is opt-in; directory defaults to `./logs` |
| `COMPASS_API_BASE` | Default `https://registry.mcphub.io` |
| `GETMCP_API_URL` | Default `https://getmcp.io/api/servers.json` |
| `CLINE_MARKETPLACE_ENABLED` | Disabled unless exactly `true`; see [Cline](./cline-marketplace.md) |
| `RERANK_PROVIDER` | Unset/`none` disables professional reranking; `flashrank` opts in |
| `RERANK_URL`, `RERANK_TIMEOUT_MS` | `http://127.0.0.1:8001/rerank`, `5000`; separate service required |

Create the log directory before requesting file logging:

```bash
mkdir -p logs
ENABLE_FILE_LOGGING=true LOG_LEVEL=debug node build/index.js
```

`DEBUG=true` alone does not control this logger. `LOGS_DIR` configures logger
output; `LOG_DIR` (with `LOGS_DIR` fallback) configures the log-reading resource.
Do not confuse these with transport or search settings.

#### Search Configuration

The CLI constructs Meilisearch, Compass and GetMCP together; Cline is opt-in,
Nacos is conditional, and SearchService adds offline search by default.
`SEARCH_PROVIDER` does not select this list. `MIN_SIMILARITY`, `MAX_RESULTS`,
`ENABLE_CACHE` and `CACHE_TTL` are not CLI SearchService controls. Its programmatic
search defaults are `limit: 5`, `minSimilarity: 0.4`; offline defaults are
`enabled: true`, `minSimilarity: 0.3`.

Meilisearch defaults to the `cloud` instance. For local configuration and the
explicitly opt-in catalog-writing operation, see [Local Meilisearch](./MEILISEARCH_LOCAL.md).
`VECTOR_ENGINE_TYPE` defaults to `oceanbase` in the vector-engine configuration;
it does not select the CLI provider list. `OCEANBASE_URL` belongs to that engine,
not an automatically enabled CLI provider.

#### Nacos Provider Configuration

All three of `NACOS_SERVER_ADDR`, `NACOS_USERNAME` and `NACOS_PASSWORD` must be
present, and initialization must succeed, before the CLI adds Nacos. It also
passes `MCP_HOST` (default `localhost`), `MCP_PORT` (`3000`), `AUTH_TOKEN` (empty),
and `NACOS_DEBUG` (`true` enables debug). The CLI does **not** forward
`NACOS_NAMESPACE`, `NACOS_GROUP` or `MCP_SERVICE_NAME`. Constructor-level support
must not be confused with automatic environment wiring.

### Configuration Files

[configLoader.ts](../src/config/configLoader.ts) supports data-source configuration
including `CONFIG_FILE`; this does not configure the CLI transport/provider list.
Use [src/index.ts](../src/index.ts), [transport config](../src/config/mcpTransport.ts)
and the [technical reference](./TECHNICAL_REFERENCE.md) as the current contract.

### Transport Configuration

```bash
# Alternative to stdio, not an additional simultaneous launch
TRANSPORT_TYPE=http node build/index.js
```

HTTP uses fixed `http://127.0.0.1:3000/mcp`. `GET /health` is a health probe;
GET/DELETE `/mcp` return 405, not a browser UI. `POST /api/sources` is a separate
application API. No built-in authentication is provided: keep loopback binding
unless an authenticated, restricted deployment is in place. Host/Origin guards
are not authentication or CORS support.

Legacy `sse`/`rest` modes and `ENDPOINT`/`--endpoint`/`--messagePath` settings are
rejected. HTTP `/sse`, `/messages`, `/rest` return 410. Modern `/mcp` may still
encode a response as SSE. Retained [legacy source](../src/services/core/server/legacy/README.md)
is reference-only, excluded from the modern build. See [migration/security/rollback](./MCP_2026_MIGRATION.md).

## Advanced Search Options

Library integration is source-level, not a supported package-root export:
[SearchService](../src/services/searchService.ts) exposes structured `SearchParams`
and optional `SearchOptions`. Importing the npm package root executes the CLI;
it does not export SearchService. Use the complete source example in the
[technical reference](./TECHNICAL_REFERENCE.md#developing-custom-providers).

## Common Troubleshooting

- A stdio process waiting silently needs a compatible MCP client, not a browser.
- Legacy handshake/mode errors require a compatible artifact and client, not
  only replacing `/sse` with `/mcp`.
- Empty/partial recommendations require provider/log inspection; do not infer
  that every catalog or optional model ran successfully.
- Check Node/package-manager versions and build output before debugging clients.

[Troubleshooting](./TROUBLESHOOTING.md) is being aligned in draft #40; its older
instructions are not authority to enable retired transports. Prefer the current
[migration guide](./MCP_2026_MIGRATION.md) for protocol errors.

## Testing and evidence

`pnpm run test:protocol` checks protocol behavior after building. `pnpm test`
runs the configured Vitest unit/integration suite. For the selected Inspector UI
suite, prerequisites and scope are in [Inspector validation](./inspector-ui-testing.md):

```bash
pnpm run test:e2e headless tests/e2e/mcp-inspector.spec.ts
```

Omitting the test path selects all Playwright tests, not just the migrated suite.
These checks do not establish search quality, live hosted compatibility, or
installation of a recommended server. Record the tested SHA, commands, skips and
failures rather than treating this guide as an execution report.
