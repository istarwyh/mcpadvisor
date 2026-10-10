# MCP Advisor Technical Reference

[English](./TECHNICAL_REFERENCE.md) | [Simplified Chinese](./TECHNICAL_REFERENCE.zh-CN.md)

> Translation scope: This English counterpart preserves every section of the Chinese reference, but corrects source-confirmed configuration drift. Conceptual code examples inherited from the original are explicitly labeled below; they are not validated current APIs or runnable recipes.

**Current-source compatibility notes**:

- Provider initialization is defined in [src/index.ts](../src/index.ts): Meilisearch, Compass, and GetMCP are constructed together, Nacos is conditional on three required environment variables, and `SearchService` enables offline search by default. `SEARCH_PROVIDER`, hybrid weight environment variables, and the illustrated `fallbackOrder` schema do not control this entry point.
- [Meilisearch configuration](../src/config/meilisearch.ts) uses `MEILISEARCH_INSTANCE`, `MEILISEARCH_LOCAL_HOST`, `MEILISEARCH_MASTER_KEY`, and `MEILISEARCH_CLOUD_API_KEY`, rather than the original reference's `MEILISEARCH_URL` and `MEILISEARCH_API_KEY`. The configured default instance is `cloud`.
- The current [SearchProvider interface](../src/types/index.ts) accepts structured `SearchParams` and returns `MCPServerResponse[]`; it has no `getName()` or `getWeight()`. [SearchService](../src/services/searchService.ts) registers providers with `addProvider()`, not `registerProvider()`. Its public TypeScript overload exposes structured parameters; the implementation also handles strings at runtime.

Configuration blocks below use POSIX shell `export` statements. Set equivalent
environment values in your MCP client on other platforms; the CLI does not
automatically load a `.env` file.

For practical startup instructions, use the [Quick Start Guide](./GETTING_STARTED.md).

This document details MCP Advisor's technical implementation, search providers, advanced features, and configuration options for developers who need deep integration or customization.

## Contents

- [Search Providers in Detail](#search-providers-in-detail)
  - [Meilisearch Provider](#meilisearch-provider)
  - [GetMCP Provider](#getmcp-provider)
  - [Compass Provider](#compass-provider)
  - [Nacos Provider](#nacos-provider)
  - [Offline Provider](#offline-provider)
  - [OceanBase Provider](#oceanbase-provider)
  - [Developing Custom Providers](#developing-custom-providers)
- [Hybrid Search Strategy](#hybrid-search-strategy)
- [Advanced Technical Features](#advanced-technical-features)
  - [Vector Normalization](#vector-normalization)
  - [Parallel Search Execution](#parallel-search-execution)
  - [Weighted Result Merging](#weighted-result-merging)
- [Error Handling System](#error-handling-system)
- [Data Update Strategy](#data-update-strategy)
- [Logging System](#logging-system)
- [Performance Optimization](#performance-optimization)
- [End-to-End Testing Framework](#end-to-end-testing-framework)
- [System Configuration](#system-configuration)

## Search Providers in Detail

MCP Advisor uses a multi-provider search architecture that allows different search engines to work in parallel and merges their results to provide the best recommendations. Each provider has specific strengths and use cases, and the system is designed to degrade gracefully when any provider is unavailable.

### Meilisearch Provider

The current [MeilisearchSearchProvider](../src/services/core/search/MeilisearchSearchProvider.ts) sends text queries with a result limit to Meilisearch. The vector-search/HNSW implementation shown below is a historical concept, not the active query path.

**Key features**:

- Text-query search through Meilisearch
- Local/cloud client configuration and failover
- Conversion of indexed server records to MCP server responses

Vector/HNSW, filtering, and faceting are capabilities discussed in the original
reference; the current provider call does not request those features.

**Configuration options**:

```bash
export MEILISEARCH_INSTANCE=local
export MEILISEARCH_LOCAL_HOST=http://localhost:7700
export MEILISEARCH_MASTER_KEY="${MEILISEARCH_MASTER_KEY:?Set the key for your local instance}"
export MEILISEARCH_INDEX_NAME=mcp_servers
```

**Best suited for**:

- Production environments with a dedicated Meilisearch instance
- Applications requiring fast search responses
- Scenarios with high search-quality requirements

**Technical implementation**:

**Historical / illustrative example:** This inherited snippet explains the concept; its classes, helpers, and signatures are not a current, runnable API recipe.

```typescript
class MeilisearchProvider implements ISearchProvider {
  private client: MeiliSearch;
  private indexName = 'mcp_servers';

  async search(query: string, options?: SearchOptions): Promise<Server[]> {
    const index = this.client.index(this.indexName);

    // Generate the query vector
    const queryVector = await this.generateEmbedding(query);

    // Perform vector search
    const results = await index.search('', {
      vector: queryVector,
      limit: options?.limit || 10,
      filter: this.buildFilters(options),
    });

    return this.formatResults(results.hits);
  }
}
```

### GetMCP Provider

**Current implementation:** [GetMcpResourceFetcher](../src/services/common/api/getMcpResourceFetcher.ts) retrieves the configured JSON feed with a GET request, then [GetMcpSearchProvider](../src/services/core/search/GetMcpSearchProvider.ts) indexes it and performs vector search. The inherited POST `/search` example below is conceptual and does not describe that implementation.

An API-based provider that queries the GetMCP registry for the latest server information.

**Key features**:

- Up-to-date MCP server information
- Rich metadata and descriptions
- Community-maintained server information
- No local infrastructure required

**Configuration options**:

```bash
export GETMCP_API_URL=https://getmcp.io/api/servers.json
```

**Best suited for**:

- Ensuring access to the latest MCP servers
- Environments without local search infrastructure
- Supplementing local search results with community data

**Technical implementation**:

**Historical / illustrative example:** This inherited snippet explains the concept; its classes, helpers, and signatures are not a current, runnable API recipe.

```typescript
class GetMcpProvider implements ISearchProvider {
  private apiUrl: string;
  private cache: Map<string, CachedResult> = new Map();

  async search(query: string, options?: SearchOptions): Promise<Server[]> {
    // Check the cache
    const cacheKey = `${query}_${JSON.stringify(options)}`;
    const cached = this.cache.get(cacheKey);

    if (cached && !this.isCacheExpired(cached)) {
      return cached.results;
    }

    // API call
    const response = await fetch(`${this.apiUrl}/search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, ...options }),
    });

    const results = await response.json();

    // Update the cache
    this.cache.set(cacheKey, {
      results,
      timestamp: Date.now(),
    });

    return results;
  }
}
```

### Compass Provider

An API-based provider that queries the Compass registry for MCP server information.

**Key features**:

- Curated server listings
- Verified installation instructions
- Category-based browsing
- Regular updates

**Configuration options**:

```bash
export COMPASS_API_BASE=https://registry.mcphub.io
```

**Best suited for**:

- Enterprise environments requiring verified servers
- Applications needing curated server recommendations
- Supplementing other search providers

### Nacos Provider

A provider that integrates with Nacos (Naming and Configuration Service) to discover MCP servers registered in a Nacos cluster.

**Key features**:

- Dynamic discovery of MCP servers from Nacos
- Support for Nacos authentication and namespaces
- Automatic health checks for registered services
- Integration with existing Nacos service infrastructure

**Configuration options**:

```bash
export NACOS_SERVER_ADDR=localhost:8848
export NACOS_USERNAME="${NACOS_USERNAME:?Set your Nacos username}"
export NACOS_PASSWORD="${NACOS_PASSWORD:?Set your Nacos password}"
export MCP_HOST=localhost
export MCP_PORT=3000
export NACOS_DEBUG=false
```

**Environment variables**:

- `NACOS_SERVER_ADDR`: Nacos server address (required)
- `NACOS_USERNAME`: Nacos authentication username (required by the entry point)
- `NACOS_PASSWORD`: Nacos authentication password (required by the entry point)
- `MCP_HOST`: MCP host (default: localhost)
- `MCP_PORT`: MCP port (default: 3000)
- `AUTH_TOKEN`: Optional authentication token (default: empty)
- `NACOS_DEBUG`: Enable debugging when set to `true` (default: false)

**Correction from the Chinese reference:** The current [entry point](../src/index.ts) does not read `NACOS_NAMESPACE`, `NACOS_GROUP`, or `MCP_SERVICE_NAME` when constructing the provider. Its original optional-credential description and example credentials should not be used.

**Best suited for**:

- Enterprise environments using Nacos for service discovery
- Dynamic MCP server registration and discovery
- Environments requiring service health monitoring

**Technical implementation**:

**Historical / illustrative example:** This inherited snippet explains the concept; its classes, helpers, and signatures are not a current, runnable API recipe.

```typescript
class NacosProvider implements ISearchProvider {
  private nacosClient: NacosClient;

  async search(query: string, options?: SearchOptions): Promise<Server[]> {
    // Retrieve service instances from Nacos
    const instances = await this.nacosClient.getAllInstances(
      this.serviceName,
      this.group,
      this.namespace,
    );

    // Filter healthy instances
    const healthyInstances = instances.filter(instance => instance.healthy);

    // Convert to the server format and apply search filtering
    const servers = healthyInstances.map(this.instanceToServer);

    return this.filterByQuery(servers, query);
  }
}
```

### Offline Provider

A local-data search provider combining vector search and text matching. Its embedding implementation loads a Universal Sentence Encoder model; that initialization can require a network download. The name “offline” does not guarantee network-free startup.

**Key features**:

- Local server-data search
- Hybrid search combining vector and text matching
- Prepackaged server data
- Embedding initialization may need network access; see [embedding.ts](../src/utils/embedding.ts)

**Configuration options**:

There is no `SEARCH_PROVIDER=offline` switch in the current entry point. [SearchService](../src/services/searchService.ts) enables its offline provider by default. The following selects the in-memory vector engine for consumers of [VectorEngineFactory](../src/services/vectorEngineFactory.ts); it does not disable the other providers or guarantee network-free startup.

```bash
export VECTOR_ENGINE_TYPE=memory
```

**Best suited for**:

- A fallback when other providers are unavailable
- Local development with model dependencies available

For disconnected or privacy-sensitive deployments, verify model availability
and network behavior separately. The standard CLI still initializes external
providers; this page does not establish a no-network mode.

**Technical implementation**:

**Historical / illustrative example:** This inherited snippet explains the concept; its classes, helpers, and signatures are not a current, runnable API recipe.

```typescript
class OfflineProvider implements ISearchProvider {
  private vectorEngine: VectorSearchEngine;
  private textMatcher: TextMatcher;

  async search(query: string, options?: SearchOptions): Promise<Server[]> {
    // Run vector and text searches in parallel
    const [vectorResults, textResults] = await Promise.all([
      this.vectorEngine.search(query, options),
      this.textMatcher.search(query, options),
    ]);

    // Merge results
    return this.mergeResults(vectorResults, textResults, {
      vectorWeight: 0.7,
      textWeight: 0.3,
    });
  }
}
```

### OceanBase Provider

**Current implementation:** OceanBase is a vector engine selected by [VectorEngineFactory](../src/services/vectorEngineFactory.ts), rather than an independent provider selected by `SEARCH_PROVIDER`. It uses `OCEANBASE_URL`; when that URL is absent, the factory falls back to memory. The original separate host, port, user, password, and database environment variables are not the configuration consumed here.

A vector search provider that uses OceanBase for storage and retrieval.

**Key features**:

- Enterprise-grade database backend
- High availability and scalability
- HNSW indexing for vector search
- Support for complex queries and filtering

**Configuration options**:

```bash
export VECTOR_ENGINE_TYPE=oceanbase
export OCEANBASE_URL="${OCEANBASE_URL:?Set your OceanBase connection URL}"
```

**Best suited for**:

- Enterprise environments already using OceanBase
- Applications requiring high availability
- Scenarios with large amounts of server data

### Developing Custom Providers

The Chinese reference illustrates custom providers through the following conceptual interface. For an actual implementation, use `SearchProvider` from [src/types/index.ts](../src/types/index.ts), implement `search(params: SearchParams): Promise<MCPServerResponse[]>`, and register the instance with `SearchService.addProvider()`. The inherited interface and registration code below are historical illustrations.

**Historical / illustrative example:** This inherited snippet explains the concept; its classes, helpers, and signatures are not a current, runnable API recipe.

```typescript
interface ISearchProvider {
  search(query: string, options?: SearchOptions): Promise<Server[]>;
  getName(): string;
  getWeight(): number;
}
```

**Implementing a custom provider**:

**Historical / illustrative example:** This inherited snippet explains the concept; its classes, helpers, and signatures are not a current, runnable API recipe.

```typescript
import { ISearchProvider, SearchOptions, Server } from '../types';

export class CustomProvider implements ISearchProvider {
  private weight = 0.5;

  async search(query: string, options?: SearchOptions): Promise<Server[]> {
    // Implement your search logic
    const results = await this.performCustomSearch(query, options);

    return results.map(result => ({
      name: result.name,
      description: result.description,
      githubUrl: result.repository_url,
      category: result.tags.join(', '),
      relevanceScore: result.score,
    }));
  }

  getName(): string {
    return 'custom';
  }

  getWeight(): number {
    return this.weight;
  }

  private async performCustomSearch(
    query: string,
    options?: SearchOptions,
  ): Promise<any[]> {
    // Custom search implementation
    // Can call external APIs, query databases, etc.
    return [];
  }
}

// Register the provider
import { SearchService } from '../services';
const searchService = new SearchService();
searchService.registerProvider(new CustomProvider());
```

## Hybrid Search Strategy

MCP Advisor implements a sophisticated hybrid search strategy combining multiple search techniques:

### Search Combination Strategy

1. **Vector search**: Convert queries to vector embeddings for semantic similarity matching
2. **Text matching**: Use keyword and metadata matching for precise results
3. **Weighted merging**: The current [offline provider](../src/services/core/search/OfflineSearchProvider.ts) defaults to 70% text and 30% vector weight, correcting the reversed weights in the Chinese reference. These are provider-level options, not `SearchOptions` environment settings.
4. **Parallel execution**: Run searches in parallel for optimal performance
5. **Adaptive filtering (historical concept)**: The source reference proposes dynamically adjusting thresholds; the current score filter uses the supplied threshold directly.

### Provider Selection Logic

**Historical / illustrative example:** This inherited snippet explains the concept; its classes, helpers, and signatures are not a current, runnable API recipe.

```typescript
class ProviderSelectionEngine {
  selectProviders(query: string, options: SearchOptions): ISearchProvider[] {
    // Analyze query characteristics
    const queryFeatures = this.analyzeQuery(query);

    // Select providers based on query characteristics
    if (queryFeatures.isHighlySpecific) {
      return [this.getProvider('meilisearch'), this.getProvider('getmcp')];
    } else if (queryFeatures.isGeneral) {
      return this.getAllProviders();
    } else {
      return this.getDefaultProviders();
    }
  }
}
```

The hybrid approach offers several advantages:

- Better handling of ambiguous queries
- Improved results for non-English queries
- Resilience to vocabulary mismatches
- A balance between semantic understanding and keyword precision

## Advanced Technical Features

### Vector Normalization

Vector normalization is a key technique for improving search quality.

**How it works**:

- Convert all vectors to unit length (magnitude = 1)
- Normalize using the Euclidean norm
- Ensure consistent cosine similarity calculations

**Technical advantages**:

- Improve search accuracy by focusing on direction rather than magnitude
- Reduce the impact of changes in vector dimensionality
- Improve performance for cross-language queries

**Historical / illustrative example:** This inherited snippet explains the concept; its classes, helpers, and signatures are not a current, runnable API recipe.

```typescript
/**
 * Normalize a vector to unit length
 * @param vector Input vector
 * @returns Normalized vector
 */
function normalizeVector(vector: number[]): number[] {
  // Calculate the vector magnitude (Euclidean norm)
  const magnitude = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0));

  // Prevent division by zero
  if (magnitude === 0 || !isFinite(magnitude)) {
    return vector;
  }

  // Normalize the vector
  return vector.map(val => val / magnitude);
}
```

### Parallel Search Execution

MCP Advisor uses a parallel search strategy to optimize performance.

**Implementation**:

- Use `Promise.all` to execute multiple searches concurrently
- Significantly reduce total search time
- Improve system responsiveness
- Allow results from different search strategies to be merged

**Historical / illustrative example:** This inherited snippet explains the concept; its classes, helpers, and signatures are not a current, runnable API recipe.

```typescript
/**
 * Execute multiple search providers in parallel
 * @param query Search query
 * @param providers List of search providers
 * @returns Merged search results
 */
async function parallelSearch(
  query: string,
  providers: SearchProvider[],
): Promise<SearchResult[]> {
  try {
    // Execute searches across all providers in parallel
    const resultsPromises = providers.map(provider =>
      provider.search(query).catch(error => {
        logger.error(`Provider ${provider.name} failed:`, error);
        return []; // Return empty results on failure
      }),
    );

    // Wait for all searches to finish
    const results = await Promise.all(resultsPromises);

    // Merge and deduplicate results
    return deduplicateResults(results.flat());
  } catch (error) {
    logger.error('Parallel search failed:', error);
    throw error;
  }
}
```

### Weighted Result Merging

Weighted result merging allows results from different search strategies to be intelligently combined.

**How it works**:

- Merge vector and text search results using configurable weights
- Current offline-provider defaults: text matching (70%), vector similarity (30%). The source reference reverses these values; the illustrative snippets below retain its conceptual API rather than the current provider implementation.
- Dynamic query-dependent weights are a historical design idea from the source reference; the current offline provider keeps the weights configured at construction.

**Historical / illustrative example:** This inherited snippet explains the concept; its classes, helpers, and signatures are not a current, runnable API recipe.

```typescript
/**
 * Merge vector and text search results
 * @param textResults Text search results
 * @param vectorResults Vector search results
 * @param weights Merge weight configuration
 * @returns Merged results
 */
function mergeSearchResults(
  textResults: SearchResult[],
  vectorResults: SearchResult[],
  weights: { textMatchWeight: number; vectorMatchWeight: number },
): SearchResult[] {
  const { textMatchWeight, vectorMatchWeight } = weights;
  const mergedMap = new Map<string, SearchResult>();

  // Process text search results
  for (const result of textResults) {
    const key = result.github_url || result.title;
    mergedMap.set(key, {
      ...result,
      similarity: result.similarity * textMatchWeight,
    });
  }

  // Process vector search results, merging matching items
  for (const result of vectorResults) {
    const key = result.github_url || result.title;
    if (mergedMap.has(key)) {
      const existing = mergedMap.get(key)!;
      mergedMap.set(key, {
        ...existing,
        similarity: existing.similarity + result.similarity * vectorMatchWeight,
      });
    } else {
      mergedMap.set(key, {
        ...result,
        similarity: result.similarity * vectorMatchWeight,
      });
    }
  }

  // Convert back to an array and sort
  return Array.from(mergedMap.values()).sort(
    (a, b) => b.similarity - a.similarity,
  );
}
```

## Error Handling System

MCP Advisor implements a robust error handling system to ensure reliability and provide detailed diagnostic information.

### Graceful Degradation Strategy

- **Multi-provider fallback**: If one search provider fails, the system uses other providers
- **Partial result handling**: The system can return partial results even if some providers fail
- **Default responses**: The system provides default responses for critical failures
- **User-friendly error messages**: Convert technical errors into messages users can understand

**Historical / illustrative example:** This inherited snippet explains the concept; its classes, helpers, and signatures are not a current, runnable API recipe.

```typescript
/**
 * Search function with graceful degradation
 * @param query Search query
 * @param options Search options
 * @returns Search results
 */
async function resilientSearch(
  query: string,
  options: SearchOptions,
): Promise<SearchResult[]> {
  try {
    // Try using all providers
    return await searchWithAllProviders(query, options);
  } catch (primaryError) {
    logger.warn('Primary search failed, falling back:', primaryError);

    try {
      // Try using the offline provider
      return await searchWithOfflineProvider(query, options);
    } catch (fallbackError) {
      logger.error('Fallback search failed:', fallbackError);

      // Return default results
      return getDefaultResults(query);
    }
  }
}
```

### Contextual Error Formatting

**Historical / illustrative example:** This inherited snippet explains the concept; its classes, helpers, and signatures are not a current, runnable API recipe.

```typescript
/**
 * Format an error object and add contextual information
 * @param error Original error
 * @param context Error context
 * @returns Formatted error
 */
function formatError(error: any, context: ErrorContext): FormattedError {
  // Extract the error message
  const message = error instanceof Error ? error.message : String(error);

  // Extract and format the stack trace
  const stack =
    error instanceof Error && error.stack
      ? error.stack.split('\n').map(line => line.trim())
      : [];

  // Create the formatted error object
  return {
    message,
    stack,
    type: error.constructor.name || 'Unknown',
    code: error.code || 'UNKNOWN_ERROR',
    context: {
      component: context.component,
      operation: context.operation,
      params: context.params,
      timestamp: new Date().toISOString(),
      ...context.additionalInfo,
    },
  };
}
```

## Data Update Strategy

The following timestamp-tracking and conditional-indexing descriptions are
historical design examples from the Chinese reference, not verified current
configuration features. Current GetMCP and Meilisearch providers cache feed data
using `CACHE_TTL_MS` (one hour); this does not implement the generalized
`getLastUpdateTimestamp` / `getFreshnessWindow` APIs shown below.

### Timestamp Tracking

- Each data source maintains a last-update timestamp
- The system tracks update frequency and patterns
- Configurable freshness window (default: 1 hour)

**Historical / illustrative example:** This inherited snippet explains the concept; its classes, helpers, and signatures are not a current, runnable API recipe.

```typescript
/**
 * Check whether data needs updating
 * @param dataSource Data source
 * @returns Whether an update is needed
 */
function shouldUpdateData(dataSource: DataSource): boolean {
  const lastUpdate = dataSource.getLastUpdateTimestamp();
  const now = Date.now();
  const freshnessWindow = config.getFreshnessWindow();

  // Update if there is no last-update timestamp or the freshness window has elapsed
  return !lastUpdate || now - lastUpdate > freshnessWindow;
}
```

### Conditional Indexing

**Historical / illustrative example:** This inherited snippet explains the concept; its classes, helpers, and signatures are not a current, runnable API recipe.

```typescript
/**
 * Conditionally update the vector index
 * @param dataSource Data source
 */
async function conditionalIndexUpdate(dataSource: DataSource): Promise<void> {
  // Check whether an update is needed
  if (!shouldUpdateData(dataSource)) {
    logger.debug('Index is fresh, skipping update');
    return;
  }

  try {
    // Fetch new data
    const newData = await dataSource.fetchLatestData();

    // Check whether the data has changed
    if (dataSource.hasDataChanged(newData)) {
      logger.info('Data changed, rebuilding index');
      await vectorDatabase.rebuildIndex(newData);
      dataSource.updateLastUpdateTimestamp();
    } else {
      logger.info('No data changes detected');
      dataSource.updateLastUpdateTimestamp();
    }
  } catch (error) {
    logger.error('Index update failed:', error);
    // Failure does not prevent use of the existing index
  }
}
```

## Logging System

MCP Advisor implements an enhanced logging system providing detailed visibility into system operations.

### Context-Aware Logging

**Historical / illustrative example:** This inherited snippet explains the concept; its classes, helpers, and signatures are not a current, runnable API recipe.

```typescript
/**
 * Create a context-aware log entry
 * @param level Log level
 * @param message Log message
 * @param context Log context
 */
function logWithContext(
  level: LogLevel,
  message: string,
  context: LogContext,
): void {
  const logEntry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    component: context.component,
    operation: context.operation,
    ...context.metadata,
  };

  // Write to the console
  if (config.consoleLogging) {
    console[level](JSON.stringify(logEntry));
  }

  // Write to a file
  if (config.fileLogging) {
    fileLogger.write(logEntry);
  }
}
```

### Performance Tracking

**Historical / illustrative example:** This inherited snippet explains the concept; its classes, helpers, and signatures are not a current, runnable API recipe.

```typescript
/**
 * Performance tracking wrapper
 * @param operation Operation name
 * @param func Function to execute
 * @returns Function result
 */
async function trackPerformance<T>(
  operation: string,
  func: () => Promise<T>,
): Promise<T> {
  const start = performance.now();
  try {
    const result = await func();
    const duration = performance.now() - start;

    logger.debug(
      `Operation ${operation} completed in ${duration.toFixed(2)}ms`,
    );

    // Record performance metrics
    metrics.recordOperationDuration(operation, duration);

    return result;
  } catch (error) {
    const duration = performance.now() - start;
    logger.error(
      `Operation ${operation} failed after ${duration.toFixed(2)}ms:`,
      error,
    );
    throw error;
  }
}
```

## Performance Optimization

The following sections translate optimization ideas from the source reference.
They are not all implemented as described; check the specific notes below.

### Caching Strategy

- **Feed caching (current)**: GetMCP and Meilisearch providers cache fetched feed data with a TTL.
- **Embedding caching (current)**: [embedding.ts](../src/utils/embedding.ts) maintains an embedding LRU cache.
- **General query-result caching (historical concept)**: The source reference describes this as a feature, but the example below is not the current search-service implementation.

**Historical / illustrative example:** This inherited snippet explains the concept; its classes, helpers, and signatures are not a current, runnable API recipe.

```typescript
/**
 * Create an LRU cache
 * @param maxSize Maximum number of cache entries
 * @returns Cache object
 */
function createLRUCache<K, V>(maxSize: number): Cache<K, V> {
  const cache = new Map<K, V>();
  const keys: K[] = [];

  return {
    get(key: K): V | undefined {
      const value = cache.get(key);
      if (value !== undefined) {
        // Move the item to the most recently used position
        const index = keys.indexOf(key);
        if (index > -1) {
          keys.splice(index, 1);
          keys.push(key);
        }
      }
      return value;
    },

    set(key: K, value: V): void {
      // Remove the oldest item if the maximum size is reached
      if (keys.length >= maxSize && !cache.has(key)) {
        const oldestKey = keys.shift();
        if (oldestKey !== undefined) {
          cache.delete(oldestKey);
        }
      }

      // Add or update an item
      if (!cache.has(key)) {
        keys.push(key);
      }
      cache.set(key, value);
    },

    clear(): void {
      cache.clear();
      keys.length = 0;
    },
  };
}
```

### Batch Processing

**Historical / illustrative example:** This inherited snippet explains the concept; its classes, helpers, and signatures are not a current, runnable API recipe.

```typescript
/**
 * Generate embeddings in batches
 * @param texts List of texts to embed
 * @returns List of embedding vectors
 */
async function batchGenerateEmbeddings(texts: string[]): Promise<number[][]> {
  // Process directly if there is only one text
  if (texts.length === 1) {
    return [await generateEmbedding(texts[0])];
  }

  // Process multiple texts in a batch
  logger.debug(`Generating embeddings for ${texts.length} texts in batch`);

  try {
    // Call the embedding model's batch API
    const embeddings = await embeddingModel.embedBatch(texts);

    // Normalize all embeddings
    return embeddings.map(normalizeVector);
  } catch (error) {
    logger.error('Batch embedding generation failed:', error);

    // Fall back to individual processing
    logger.info('Falling back to individual embedding generation');
    const results: number[][] = [];

    for (const text of texts) {
      try {
        results.push(await generateEmbedding(text));
      } catch (innerError) {
        logger.error(
          `Failed to generate embedding for text: ${text.substring(0, 50)}...`,
          innerError,
        );
        // Add a zero vector for any text that fails
        results.push(new Array(embeddingModel.dimensions).fill(0));
      }
    }

    return results;
  }
}
```

### Lazy Loading

**Historical / illustrative example:** This inherited snippet explains the concept; its classes, helpers, and signatures are not a current, runnable API recipe.

```typescript
/**
 * Lazily load a search provider
 */
class LazyLoadedProvider implements SearchProvider {
  private provider: SearchProvider | null = null;
  private readonly factory: () => SearchProvider;

  constructor(factory: () => SearchProvider) {
    this.factory = factory;
  }

  async search(query: string): Promise<SearchResult[]> {
    // Initialize the provider on demand
    if (!this.provider) {
      this.provider = this.factory();
    }

    return this.provider.search(query);
  }
}
```

## End-to-End Testing Framework

### Port Management

An automatic cleanup mechanism for MCP Inspector and proxy ports has been added to end-to-end tests to ensure port conflicts do not affect test runs.

**Historical port cleanup mechanism (destructive):** This inherited shell example force-kills processes on ports 6274 and 6277 and every process matching `inspector`. Do not run it as a general cleanup recipe; first identify the specific test processes you own.

```bash
# Clean up processes occupying ports
cleanup_ports() {
    local ports=(6274 6277)
    for port in "${ports[@]}"; do
        local pids=$(lsof -ti :$port 2>/dev/null || true)
        if [[ -n "$pids" ]]; then
            kill -9 $pids 2>/dev/null || true
        else
            echo "No process found on port $port"
        fi
    done
    pkill -f "inspector" 2>/dev/null || true
}
```

### Testing Utilities

Modular testing utility classes have been added to improve test environment management:

**Testing utility classes**:

- `EnvironmentManager`: Save and restore environment variables
- `SmartWaiter`: Smart waiting mechanism
- `MCPConnectionManager`: MCP connection management
- `SearchOperations`: Search operation wrappers
- `ScreenshotManager`: Screenshot management
- `TestValidator`: Test result validation

**Historical / illustrative example:** This inherited snippet explains the concept; its classes, helpers, and signatures are not a current, runnable API recipe.

```typescript
// Usage example
const envManager = new EnvironmentManager();
envManager.saveEnvironment();
envManager.setMeilisearchConfig({
  instance: 'local',
  host: 'http://localhost:7700',
});
// ... Test code
envManager.restoreEnvironment();
```

## System Configuration

### Provider Configuration

The current entry point constructs multiple providers together and `SearchService` manages their results. The original reference's environment switches and JSON provider schema are not implemented as the described runtime controls; the working environment names below replace those obsolete recommendations.

**Environment variable configuration**:

```bash
# Local Meilisearch configuration
export MEILISEARCH_INSTANCE=local
export MEILISEARCH_LOCAL_HOST=http://localhost:7700
export MEILISEARCH_MASTER_KEY="${MEILISEARCH_MASTER_KEY:?Set the key for your local instance}"

# Provider data sources
export GETMCP_API_URL=https://getmcp.io/api/servers.json
export COMPASS_API_BASE=https://registry.mcphub.io
```

**Historical / illustrative configuration file:** The following retains the original design example for context. The current entry point does not read this `search.providers` / `fallbackOrder` schema; do not use it to select, weight, or disable providers. See [src/index.ts](../src/index.ts), [SearchService](../src/services/searchService.ts), and the repository's [default configuration](../config/default.json).

```json
{
  "search": {
    "provider": "hybrid",
    "providers": {
      "meilisearch": {
        "enabled": true,
        "url": "http://localhost:7700",
        "apiKey": "your_api_key",
        "weight": 0.4
      },
      "getmcp": {
        "enabled": true,
        "url": "https://api.getmcp.org",
        "weight": 0.3
      },
      "offline": {
        "enabled": true,
        "weight": 0.3
      }
    },
    "fallbackOrder": ["meilisearch", "getmcp", "offline"]
  }
}
```

### Provider Selection Logic

The Chinese reference describes `SEARCH_PROVIDER`, `hybrid`, and sequential `fallbackOrder` selection. That description does not match the current source:

1. [src/index.ts](../src/index.ts) creates Meilisearch, Compass, and GetMCP providers directly.
2. Nacos is added only when its server address, username, and password are present and initialization succeeds.
3. [SearchService](../src/services/searchService.ts) adds the offline provider by default and searches providers in parallel; it does not consume the illustrated `fallbackOrder` setting.
4. Result handling and failure behavior are implemented by `SearchService`, rather than the historical JSON schema. No `SEARCH_PROVIDER` environment switch is read by this entry point.

### Performance Tuning Configuration

**Historical / illustrative configuration:** This inherited `performance` JSON is a conceptual tuning example, not a verified configuration contract consumed by the current runtime. Its caching, batching, and parallelism values should not be presented as active defaults.

```json
{
  "performance": {
    "caching": {
      "enabled": true,
      "ttl": 3600,
      "maxSize": 1000
    },
    "batching": {
      "enabled": true,
      "batchSize": 10,
      "timeout": 5000
    },
    "parallelism": {
      "maxConcurrentProviders": 5,
      "timeout": 10000
    }
  }
}
```

---

This technical reference provides in-depth technical details about MCP Advisor. For more information, see:

- [Quick Start Guide](./GETTING_STARTED.md) - Installation and basic usage
- [Architecture](./ARCHITECTURE.md) - Detailed system architecture
- [Contributing Guide](../CONTRIBUTING.md) - Developer guide
- [Troubleshooting](./TROUBLESHOOTING.md) - Solutions to common problems
