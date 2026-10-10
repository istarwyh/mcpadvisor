# Structured search interface (June 2025)

## Background and interface

A query string alone cannot express task intent, keywords and requested capabilities.
The shared programmatic interface is:

```ts
interface SearchParams {
  taskDescription: string;
  keywords?: string[];
  capabilities?: string[];
}
```

Providers accept this object and return `MCPServerResponse[]`. The search service
normalizes a legacy string into `{ taskDescription: query }`. Provider-specific
matching may combine the description, keywords and capabilities; implementations
must not silently ignore required input or mutate it.

## Affected components

Update search types, provider implementations, aggregation, direct callers, unit
and integration tests, and documentation together. Current sources are under
`src/types/search.ts`, `src/services/core/search/` and
`src/services/searchService.ts`; earlier plan paths are historical.

```ts
await provider.search({
  taskDescription: 'Deploy a database',
  keywords: ['sql'],
});
await service.search({
  taskDescription: 'Read local files',
  capabilities: ['storage'],
});
```

## Migration and compatibility

1. Introduce the shared types and update provider signatures.
2. Adapt the service and callers while retaining string normalization where supported.
3. Add tests for blank input, omitted optional arrays, combined fields and failures.
4. Update examples and deprecation notices before removing any compatibility shim.

Earlier proposals for new `search -d/-k/-c` CLI flags were design examples, not a
claim that the current transport CLI implements those flags. Use the actual tool
schema and current [technical reference](../../TECHNICAL_REFERENCE.md).

## Risks and verification

Old callers, inconsistent interpretation across providers, extra embedding work
and interface drift are the main risks. Verify both string and object service
calls, valid and invalid inputs, provider aggregation, timeout/fallback behavior
and relevant results. Measure latency before making performance claims.

The original June implementation record described provider and test migration as
completed. Its historical timeline and results are retained in the source edition;
current correctness must be established by the current build and test commands.

The original Chinese source, including historical code examples and timelines, is
retained in [search-interface-refactor-202506.zh-CN.md](./search-interface-refactor-202506.zh-CN.md).
