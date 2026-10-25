# MCP Advisor Technical Reference

[English](./TECHNICAL_REFERENCE.md) | [简体中文](./TECHNICAL_REFERENCE.zh-CN.md)

This reference describes repository source at `94829fd` (2026-10-25), not a
promise about the npm `1.0.5` artifact or the hosted service. See
[Getting Started](./GETTING_STARTED.md) for installation and client configuration.

## Protocol and transport

The source requires **MCP 2026-07-28**. `stdio` is the default; `http` is stateless
Streamable HTTP at `/mcp`, not the historical `/sse` + `/messages` transport.
`--mode` takes precedence over `TRANSPORT_TYPE`. Old `sse`/`rest` modes and custom
endpoint options fail with migration guidance; historical HTTP endpoints return
410. See [transport configuration](../src/config/mcpTransport.ts).

HTTP supports POST `/mcp`; GET and DELETE `/mcp` return 405. `/health` is a health
check, not proof that external recommendation providers work. `POST /api/sources`
is a separate application API that adds catalog sources. `MCP_HTTP_RESPONSE_MODE=auto|json|sse` controls response
encoding; `sse` here does **not** restore the old SSE transport. Each HTTP request
uses an independent server/transport, without resumable sessions.

HTTP binds to `127.0.0.1:3000` by default. `MCP_ALLOWED_HOSTS` and
`MCP_ALLOWED_ORIGINS` are comma-separated request guards, not authentication or a
CORS configuration. There is no application authentication layer; keep the
listener private or place an appropriately secured proxy in front of it.

## Tool contracts

### `recommend-mcp-servers`

```json
{
  "taskDescription": "Find a read-only PostgreSQL query tool",
  "keywords": ["PostgreSQL"],
  "capabilities": ["database", "read-only"]
}
```

`taskDescription` is preferred; `query` is a compatibility alias. At the tool
boundary, `keywords` and `capabilities` accept strings or string arrays and are
normalized to arrays. The service API below uses arrays only. Results are MCP
text content, not a structured JSON response contract. Scores rank candidates;
they are not calibrated probabilities, security certification, or proof that a
server meets the requested capability. Offline candidates do not prove provider
availability. Inspect the linked project before installation.

### `install-mcp-server`

Requires `mcpName` and `sourceUrl`; optionally accepts `mcpClient`. It generates
installation **guidance**. It does not install packages or modify client files.

See [tool registration](../src/services/core/server/stateless/McpServerFactory.ts) and
[recommendation handler](../src/services/core/server/tools/RecommendMcpServerToolHandler.ts).

## Search providers in detail

The [CLI entry point](../src/index.ts) constructs these providers together; there
is no `SEARCH_PROVIDER` environment switch selecting just one:

| Provider | Current behavior / configuration |
| --- | --- |
| Meilisearch | Text search using `MeilisearchConfigManager`; cloud is the default instance. Local configuration uses `MEILISEARCH_LOCAL_HOST`, `MEILISEARCH_MASTER_KEY`, `MEILISEARCH_INDEX_NAME`, `MEILISEARCH_AUTO_INDEX`. Cloud API key: `MEILISEARCH_CLOUD_API_KEY`. Local failures can fall back to cloud. Do not expose a development master key. |
| Compass | GET recommendation request to `COMPASS_API_BASE` (default `https://registry.mcphub.io`), with task, keywords and capabilities combined into the description. |
| GetMCP | Fetches a JSON catalog from `GETMCP_API_URL` (default `https://getmcp.io/api/servers.json`), then searches its indexed data; this is not a remote POST search API. |
| Cline | Opt-in only with `CLINE_MARKETPLACE_ENABLED=true`; unavailable optional sources do not imply no recommendations. |
| Nacos | Added only when `NACOS_SERVER_ADDR`, `NACOS_USERNAME`, **and** `NACOS_PASSWORD` are present and initialization succeeds. |

For Nacos the CLI also passes `MCP_HOST` (default `localhost`), `MCP_PORT`
(default `3000`), `AUTH_TOKEN` (default empty), and `NACOS_DEBUG` (debug is enabled only for exactly `true`; otherwise false)
to its provider configuration. It does not read `NACOS_NAMESPACE`, `NACOS_GROUP`, or
`NACOS_SERVICE_NAME` into that configuration. Provider constructor options and
CLI environment variables are not interchangeable.

## Hybrid search strategy

[SearchService](../src/services/searchService.ts) searches providers and the
built-in offline data in parallel, tolerates individual provider failures,
filters candidates for product evidence, deduplicates, and applies deterministic
ranking. Its normal result limit is 5 and default minimum similarity is 0.4.
Offline search is enabled by default with its own minimum similarity of 0.3.
Those offline values are constructor options, **not** environment variables read
by the CLI. Empty results and offline-only results require different diagnosis.

Optional professional reranking is enabled with `RERANK_PROVIDER=flashrank`
(`none` or unset disables it), `RERANK_URL` (default
`http://127.0.0.1:8001/rerank`), and `RERANK_TIMEOUT_MS` (default `5000`). The
service bounds candidate count and only uses the optional branch for supported
limit/sort settings and enough candidates; failure falls back to deterministic
ranking. This is an additional service dependency, not a bundled model server.
See [reranker](../src/services/core/search/ProfessionalReranker.ts).

## Developing custom providers

These are **source-level** TypeScript interfaces, not published package-root
exports. `@xiaohui-wang/mcpadvisor` points to the CLI entry point, which invokes
`main`; do not import `SearchService` from that package root.

```typescript
// Illustrative file inside src/; imports are relative to that location.
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

The synthetic record is not a verified recommendation. Exact output also depends
on filtering/ranking. The current public contracts are:

- `SearchParams`: required `taskDescription: string`; optional `keywords: string[]`
  and `capabilities: string[]`.
- `SearchProvider.search(params: SearchParams): Promise<MCPServerResponse[]>`.
- `SearchService(providers = [], offlineConfig = {}, professionalReranker?)`.
- `addProvider(provider)`, `removeProvider(index)`, `getProviders()` (a shallow copy).
- `search(params, options?)`, with `limit`, `minSimilarity`, `sortBy`, `sortOrder`
  in `SearchOptions`. Use structured parameters, not the implementation's legacy
  string compatibility path, which is not the public TypeScript overload.
- Responses require `title`, `description`, `sourceUrl`, and the deprecated
  `similarity`; `score`, `id`, `installations`, `categories`, and `tags` are optional.

See [types](../src/types/index.ts), [search types](../src/types/search.ts), and
[service implementation](../src/services/searchService.ts) before extending them.
Keep external adapters separate from orchestration and ranking; test new
providers with deterministic fixtures and explicitly isolated network access.

## System configuration

The CLI reads `process.env`; it does not automatically load `.env` or
`.mcpadvisorrc`. Export variables before starting it, or explicitly preload
`dotenv`. The data configuration loader is not a general CLI settings loader.
`SEARCH_PROVIDER`, `SEARCH_TIMEOUT`, `SEARCH_LIMIT`, `OFFLINE_ENABLED`, and
`OFFLINE_MIN_SIMILARITY` are not current CLI controls.

`VECTOR_ENGINE_TYPE` and `OCEANBASE_URL` configure vector infrastructure where
used; they do not select the top-level CLI providers. Catalog cache TTL is a
source constant, not a documented `CACHE_TTL` environment setting. See
[constants](../src/config/constants.ts) and
[Getting Started configuration](./GETTING_STARTED.md#configuration-options).

For file logs use `ENABLE_FILE_LOGGING=true` and `LOGS_DIR` with an existing
writable directory. `DEBUG=true` alone does not enable this logger. Keep stderr
for diagnostics in stdio mode; arbitrary stdout output corrupts MCP framing.
Do not publish credentials, Inspector authentication tokens, logs, or traces.

## Verification and limitations

```bash
pnpm run build
pnpm run check
pnpm run test:protocol
pnpm run test
# Requires Inspector/browser prerequisites; runs the migrated suite only:
pnpm run test:e2e headless tests/e2e/mcp-inspector.spec.ts
```

A successful build is not live-provider validation. Vitest can include network
integration tests and skipped cases; record exact executed tests and failures.
Protocol tests do not certify third-party clients or the hosted service. The
selected Inspector command does not cover the legacy Meilisearch UI suite.
See [Inspector guide](./inspector-ui-testing.md) and
[Contributing](../CONTRIBUTING.md). Historical design documents and troubleshooting
material may describe earlier behavior; pending [PR #40](https://github.com/istarwyh/mcpadvisor/pull/40)
is not merged acceptance evidence.
