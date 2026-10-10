# Local and cloud Meilisearch request sequences

This English edition distinguishes the implemented request path from historical
proposals for hot reload, monitoring and automated deployment.

## Startup and search

1. Read startup configuration and create the selected controller/failover client.
2. Receive structured search parameters and normalize the query.
3. Reuse fresh catalog state or share one in-flight load.
4. Fetch/validate the catalog. If local auto-indexing is explicitly enabled,
   create/check the index, update settings and upsert records.
5. Wait for task success; cache only successful ingestion.
6. Search with ranking scores, map hits to public catalog IDs and return metadata.
7. Aggregate/deduplicate/filter/rank results in `SearchService`.

## Failure and recovery

Health, authentication, task status and search success are separate checks.
Search fallback can call another configured search controller. Index writes remain
local and never cross to cloud fallback. Failed ingestion leaves no success cache,
so a later request can retry. An already-created index is verified before handling
that specific concurrent creation race as success.

## Synchronization and configuration

Current ingestion upserts records; it does not remove every stale catalog document.
Configuration is selected at startup. Parent-process environment mutations do not
change a running MCP process. Restart after changing its settings.

Historical sequences for runtime configuration reload, continuous synchronization,
monitoring pipelines and service-manager upgrades describe possible extensions.
They must not be mistaken for implemented or tested application behavior.

## Observability and upgrades

Observe query/index latency, document counts, cache age, task failures and health
without logging credentials. Back up indexes and settings before upgrades, verify
compatibility, run actual queries after restart and preserve a rollback path.
Tests should synchronize real failure scenarios rather than rely on arbitrary sleeps.

The original Chinese source, including historical code examples and timelines, is
retained in [meilisearch-sequence-diagrams.zh-CN.md](./meilisearch-sequence-diagrams.zh-CN.md).
