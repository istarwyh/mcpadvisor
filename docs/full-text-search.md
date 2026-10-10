# Local full-text search

The Meilisearch provider supports title, description, category and tag queries.
Opt in to populating a dedicated local index from the GetMCP catalog:

```sh
export MEILISEARCH_INSTANCE=local
export MEILISEARCH_LOCAL_HOST=http://localhost:7700
export MEILISEARCH_MASTER_KEY=<your-local-master-key>
export MEILISEARCH_INDEX_NAME=mcp_servers
export MEILISEARCH_AUTO_INDEX=true
node build/index.js
```

On the first nonempty search, the provider creates a missing index, configures
searchable attributes and upserts catalog records. It waits for each asynchronous
indexing task before searching. Concurrent searches share one catalog load, and
successful loads are cached for the existing catalog TTL. Failed indexing is not
cached and the next search retries. Existing documents are upserted, not deleted;
catalog removal still requires index maintenance.

Automatic indexing is disabled by default. Enabling it allows settings updates
and document writes to the selected local index; use a dedicated catalog index.
Cloud search remains read-only and indexing failures never write to the fallback
cloud instance. Existing manually populated indexes still work with the opt-in
unset. Scores now use Meilisearch's requested ranking score, including zero, and
category/tag metadata is retained in results.

Run the isolated real-engine integration test with a local Meilisearch 1.15:

```sh
MEILI_FULLTEXT_TEST_HOST=http://localhost:7700 \
MEILI_FULLTEXT_TEST_KEY=<your-local-master-key> \
pnpm test src/tests/integration/providers/meilisearch-fulltext.test.ts
```

The test creates a unique fixture index and deletes it afterward. It uses a fixed
catalog so search quality assertions do not depend on a changing external feed.

CI runs unit tests, test-project type checking, real-engine integration tests,
and real MCP stdio protocol tests. The protocol tests start the compiled server
services against a unique local index, discover and invoke the recommendation
tool, verify invalid input handling and exercise a failed catalog fetch. A failed
catalog currently yields the existing empty-results response, not an MCP error.
No real LLM, Tavily, Redis or cloud-search credentials are required.

After building, run the protocol suite with the same host/key configuration:

```sh
MEILI_FULLTEXT_TEST_HOST=http://localhost:7700 \
MEILI_FULLTEXT_TEST_KEY=<your-local-master-key> \
node --test tests/e2e/meilisearch-mcp.test.mjs
```

The legacy Inspector browser suite is retained behind the explicit
`workflow_dispatch` input `inspector_ui`. Its current Inspector connection waits
time out, and its cloud comparisons require separate configuration. Changing the
test runner's environment after the server starts does not reconfigure that
server. That suite has not passed this verification; the automatic protocol
checks above verify the application directly and do not certify Inspector UI or
cloud-versus-local performance.
