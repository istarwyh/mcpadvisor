# Self-hosted Meilisearch integration

## Goals and architecture

The local service supports lower-latency catalog search, development without a
cloud search subscription, controlled index administration and explicit cloud
fallback. Local deployment alone does not establish recommendation quality.

`SearchService` aggregates provider results. `MeilisearchSearchProvider` loads the
GetMCP catalog and calls the selected controller. Local and cloud controllers sit
behind `FailoverMeilisearchClient`; local administration must never be redirected
to cloud fallback. Configuration is read from `src/config/meilisearch.ts`.

## Deploy the engine

Use an official Meilisearch release compatible with the application SDK; current
integration tests use the 1.15 series. Obtain the binary or image from the official
project, verify its release provenance, and run it under a dedicated OS account.
Keep its data directory writable only by that service account.

```sh
export MEILI_MASTER_KEY='<your-local-master-key>'
meilisearch --http-addr 127.0.0.1:7700 --db-path ./meili-data --no-analytics
```

Set a real key for any shared environment. Do not expose an unauthenticated engine
on a public interface or reuse CI fixture keys. Put persistent configuration and
credentials in the service manager or protected configuration, not in the repository.
A systemd deployment should set the service user, working directory, environment
file, restart policy and data-directory permissions explicitly.

## Configure the application

```sh
export MEILISEARCH_INSTANCE=local
export MEILISEARCH_LOCAL_HOST=http://localhost:7700
export MEILISEARCH_MASTER_KEY='<your-local-master-key>'
export MEILISEARCH_INDEX_NAME=mcp_servers
export MEILISEARCH_AUTO_INDEX=true
node build/index.js
```

Choose a dedicated catalog index when opting into automatic settings/document
writes. With the flag absent, the provider remains read-only. See
[the current full-text guide](../../full-text-search.md) for exact behavior.

The local controller creates a missing index, waits for asynchronous tasks,
configures title/description/category/tag search attributes, and upserts documents.
It preserves the original catalog ID separately when the internal primary key
must be hashed. Concurrent index creation tolerates the specific already-exists
race after checking the actual index. Other failures remain errors.

## Ingestion, freshness and removal

Normalize external data before indexing, validate required fields, retain useful
metadata and wait for task success before caching ingestion. The provider cache
has a catalog TTL; the factory reuses the provider across requests and concurrent
loads share in-flight work. Failed loads are not cached as success.

Upsert is not deletion synchronization. Catalog removals require an explicit
maintenance policy. Back up data and index settings before destructive operations;
verify document counts, task errors and a representative query sample afterward.

## Health and fallback

Check `/health`, authentication, index existence, settings, document counts and task
status independently. A health response alone does not prove that a query works.
Search failures may fall back according to configuration. Do not silently turn
failed index writes into remote writes or log connection credentials.

Changing a parent's environment does not reconfigure an already running child.
Restart the application after changing startup configuration. Earlier plans for
hot reload, advanced monitoring and automatic catalog cleanup are proposals, not
an assertion that those features exist today.

## Performance and operations

Measure cold ingestion separately from warm search. Track catalog freshness,
fetch/index durations, failed tasks and query latency. Reuse clients and provider
state; bound requests and avoid unbounded connections, caches or batch sizes.
Popularity, semantic embeddings and custom ranking require actual data and
separate relevance evaluation rather than an assumption of higher quality.

Keep backups and a rollback procedure for binary upgrades and data format changes.
Use rolling migration only where the chosen deployment supports it. Observe disk,
memory, service restarts and indexing queues; do not present proposed thresholds
as measured service guarantees.

## Test matrix and CI

Unit tests cover configuration, fallback, caching and response mapping. Real-engine
integration tests cover ingestion, searchable fields, no-write defaults, task
failures, public IDs and concurrent creation. MCP protocol E2E invokes compiled
application services through stdio. These suites use isolated fixture indexes and
clean them up after execution.

```sh
pnpm run build
MEILI_FULLTEXT_TEST_HOST=http://localhost:7700 \
MEILI_FULLTEXT_TEST_KEY='<your-local-master-key>' \
pnpm exec vitest run src/tests/integration/providers/meilisearch-fulltext.test.ts
```

The legacy Inspector UI suite remains explicit/manual after documented connection
failures. Its cloud comparisons need separately configured cloud credentials.
Never label skipped or unavailable tests as passing. Earlier coverage targets and
performance examples in the original proposal are goals, not current measurements.

The original Chinese source, including historical code examples and timelines, is
retained in [meilisearch-self-hosted-integration.zh-CN.md](./meilisearch-self-hosted-integration.zh-CN.md).
