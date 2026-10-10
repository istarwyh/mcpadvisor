# Custom catalog search provider

## Requirements

Expose a `GetMcpSearchProvider` similar to other providers, but ingest a structured
catalog URL rather than a ready-made search API. The original source is
`https://getmcp.io/api/servers.json`. Records contain server identity, description,
repository, categories, tags, installation metadata and related fields.

1. Fetch GET resources with validation, bounded failures and a one-hour cache.
2. Normalize catalog records to the shared response/index schema.
3. Separate resource retrieval, embedding/vector processing, persistence and query logic.
4. Return `MCPServerResponse[]` through the shared search interface.
5. Keep database credentials in environment configuration and retain useful errors.

## Original architecture

The proposal separates `GetMcpResourceFetcher`, the search provider, a database
controller, the vector engine and the public provider integration. It considered
OceanBase standalone vector storage with HNSW indexes and similarity queries.
The repository also contains alternative engines and offline fallback; select the
actual supported engine through current configuration rather than assuming that
vector-engine selection changes every CLI provider.

## Data flow

Fetch metadata, validate/normalize records, generate embeddings with a chosen model,
store records/vectors, query candidate similarities, map results and aggregate them
in `SearchService`. Cache successful catalog retrieval; explicitly define update,
removal and refresh behavior. Use dependency injection and stable public IDs.

## Implementation record and unresolved risks

The original record described modular separation, OceanBase integration and
connection/error handling as completed, with remaining concerns about array-versus-
string metadata, table/schema changes, repeated index creation, batch insertion,
cache freshness and production test coverage. These are historical statements;
verify current code and the chosen database rather than treating the prose as CI.

The earlier connection example disabled TLS to accommodate one server. That is not
a general security recommendation; preserve secure transport and configure trust
for the actual deployment. Do not reuse hardcoded endpoints or credentials.

## Further work

Improve schema validation, explicit migrations, idempotent index management,
provider-specific errors/retries, batch insertion, caching and observability.
Unit tests should cover malformed metadata and transformation; integration tests
should use an actual configured engine and exercise success and failure cases.
Without that engine, report the integration tests as unrun rather than passing.

The original Chinese source, including historical code examples and timelines, is
retained in [feature-add-custom-search-provider.zh-CN.md](./feature-add-custom-search-provider.zh-CN.md).
