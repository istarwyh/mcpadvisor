# Meilisearch search-provider requirements

## Purpose

Use Meilisearch to retrieve MCP servers by title, description, category and tags,
with a clear local/cloud configuration boundary and shared provider interface.
The original proposal used the GetMCP catalog as a source and considered embedding
and vector-search extensions separately from ordinary full-text retrieval.

## Implementation boundaries

Separate catalog fetching, record conversion, controller calls and result mapping.
Validate metadata, preserve stable public IDs and retain installation information.
Use explicit startup configuration and environment-provided credentials. A healthy
engine does not imply that the selected index exists or contains the catalog.

Current local indexing is an opt-in: create/check the index, configure searchable
attributes and upsert documents, then wait for successful asynchronous tasks.
Default and cloud search remain read-only. Consult the current
[full-text guide](../full-text-search.md) and
[self-hosted integration guide](../tech/202507/meilisearch-self-hosted-integration.md).

## Failure handling and tests

Bound network/task waits, distinguish invalid data and search failures, preserve
retryability, and avoid writing to cloud fallback. Test no-write defaults,
searchable metadata, failed tasks, original IDs and concurrent ingestion on a real
engine. Embedding storage, advanced ranking and business quality targets need
separate implementation and evaluation; they are not implied by indexing success.

The original Chinese source, including historical code examples and timelines, is
retained in [ feature-support-mellisearch.zh-CN.md](./%20feature-support-mellisearch.zh-CN.md).
