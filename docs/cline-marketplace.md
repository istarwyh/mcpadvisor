# Optional Cline marketplace search

`ClineSearchProvider` implements the existing `SearchProvider` interface. It reads
https://api.cline.bot/v1/mcp/marketplace only when explicitly searched. Existing
provider choices and the default offline source are unchanged. This change does
not add a new MCP tool, HTTP route, installation flow, or automatic startup fetch.

## Enable in the MCP server

Set `CLINE_MARKETPLACE_ENABLED=true` in the MCP client's server environment, or
when launching the built server:

```sh
CLINE_MARKETPLACE_ENABLED=true node build/index.js
```

The executable adds Cline to its existing sources only for the exact value `true`.
Unset, empty, or `false` preserves the existing sources. Other values fail startup
with a configuration error rather than silently enabling or ignoring the source.
The catalog is fetched only when a search runs. This opt-in works with the existing
stdio, SSE and REST transports. Existing source priorities are unchanged; Cline
uses the reranker's default priority and is not guaranteed to rank above them.

## Programmatic selection

For callers using the search factory:

```ts
import { getSearchFunction } from '../src/services/core/search/SearchMcpFactory.js';

const search = getSearchFunction('cline');
const results = await search('Postman API testing', { limit: 5 });
```

The factory uses the existing `SearchService`, including its offline fallback,
score filtering, ordering, limit, and exact-source-URL deduplication. It reuses one
Cline provider so repeated calls share its catalog cache. To compose sources or
customize timing directly:

```ts
import { ClineSearchProvider } from '../src/services/core/search/ClineSearchProvider.js';
import { SearchService } from '../src/services/searchService.js';

const cline = new ClineSearchProvider({
  timeoutMs: 10_000,
  cacheTtlMs: 300_000,
});
const service = new SearchService([cline], { enabled: false });
const results = await service.search({
  taskDescription: 'feature flags',
  keywords: ['LaunchDarkly'],
  capabilities: ['rollouts'],
});
```

## Mapping and behavior

The endpoint was verified on 2026-10-09 (HTTP 200, JSON array, 199 entries).
`src/tests/fixtures/cline/marketplace.json` preserves the fields used from three
actual returned entries: Postman API Tools, LaunchDarkly and AWS Infrastructure. Runtime tests use
that fixture and mocked requests, not a changing live service.

- `mcpId` → `id` (repository URL if missing); `name` → `title`;
  `githubUrl` → `sourceUrl`; `description` → `description`;
  `category` → `categories`; string `tags` entries → `tags`.
- Entries without a non-empty name or HTTPS GitHub repository URL are skipped.
  Missing/invalid optional description, category, and tags become empty values.
  Monorepo subdirectory URLs retain their paths. URLs have trailing slash and `.git` suffix removed for the existing
  deduplication path. Other providers' URL variants are not normalized globally.
- Deterministic lexical matching uses name, description, category and tags against
  task description, keywords and capabilities. Similarity is the fraction of
  distinct query terms matched (0–1). Blank queries do not fetch; unmatched entries
  are omitted. This is lexical discovery, not semantic embedding search.
- `readmeContent`, installation commands and credentials are not consumed or
  executed. No API key, additional service or model download is needed by Cline.
- The existing `MemoryCache` stores the catalog for five minutes by default.
  Concurrent searches share one load. Timeout covers headers and JSON body;
  non-2xx, invalid JSON/schema and network failures reject at provider level.
  Failed loads are not cached and the next search can retry. `SearchService`
  isolates provider failures so its other sources may still return results.
