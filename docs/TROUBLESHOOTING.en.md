# Troubleshooting

[English](./TROUBLESHOOTING.md) | [Simplified Chinese](./TROUBLESHOOTING.zh-CN.md)

This document provides solutions and diagnostic techniques for common MCP Advisor issues.

> Scope: This English edition translates the Chinese troubleshooting guide and corrects verified differences from the current source. Examples marked illustrative or historical require adaptation; they are not supported configuration instructions. Check the [Getting Started Guide](./GETTING_STARTED.md), [Technical Reference](./TECHNICAL_REFERENCE.md), and current source before applying an example. Redact secrets before sharing environment variables or logs.

## Current Implementation Caveats

The sections below correct practical commands where verified against source and label illustrative examples where they are not implemented. These checks inspect source code only; they do not constitute runtime validation.

- **Startup and logging:** [`package.json`](../package.json) defines no `start` or `restart` script. Build with `pnpm run build`, then run `node build/index.js` (set `TRANSPORT_TYPE=sse` for SSE). The [logger](../src/utils/logger.ts) writes `all.log` and `error.log` under `LOGS_DIR`, or `logs` by default, rather than `mcpadvisor.log`. File logging requires `MCP_COMPASS_MAIN=true` or `ENABLE_FILE_LOGGING=true` and an existing log directory; the main-application mode can create that directory. `ENABLE_PERFORMANCE_LOGGING` has no handler in the current source.
- **SSE:** The `EventSource` example only enables credentials; it does not set a timeout. WebSocket is not an implemented alternative: the supported [transport types](../src/services/core/server/types.ts) are `stdio`, `sse`, and `rest`.
- **Search APIs and defaults:** The [GetMCP endpoint](../src/config/constants.ts) defaults to `https://getmcp.io/api/servers.json`. The [search service](../src/services/searchService.ts) defaults to `minSimilarity: 0.4`, not `0.5`; its provider priorities use class names (`GetMcpSearchProvider: 10`, `MeilisearchSearchProvider: 9`, `CompassSearchProvider: 8`, `OfflineSearchProvider: 5`). `textMatchWeight` and `vectorMatchWeight` are not fields in the current [`SearchOptions`](../src/types/index.ts). The public TypeScript search overload takes structured `SearchParams`, although the implementation also handles a string. Cache, batching, PCA, and memory-monitoring examples are illustrative and may require additional implementation or dependencies.
- **Development and diagnostics:** [`pnpm run check`](../package.json) runs lint and formatting checks; `pnpm run build` invokes TypeScript compilation. The named `ERR_*` codes below are diagnostic categories from the source guide, not a guaranteed exported error-code API. A rejected commit does not create a commit to amend: use `git commit` after fixing it, and use `--amend` only when you intend to change the existing last commit. Deleting `pnpm-lock.yaml` can change dependency versions; preserve it unless deliberately regenerating the lockfile.

## Contents

- [Connection Issues](#connection-issues)
- [Search Issues](#search-issues)
- [Performance Issues](#performance-issues)
- [Configuration Issues](#configuration-issues)
- [Development and Commit Issues](#development-and-commit-issues)
- [Logging and Debugging](#logging-and-debugging)
- [Common Error Codes](#common-error-codes)
- [Advanced Troubleshooting](#advanced-troubleshooting)
- [Getting Help](#getting-help)

## Connection Issues

### Connection Refused

**Symptom**: You receive a "Connection refused" error when trying to connect to the MCP Advisor server.

**Possible causes**:

1. The server is not running
2. The port configuration is incorrect
3. A firewall is blocking the connection
4. The host address is incorrect

**Solutions**:

1. Make sure the server is running:

   ```bash
   ps aux | grep mcpadvisor
   ```

2. Verify the port configuration:

   ```bash
   # Check whether the port is in use
   lsof -i :3000

   # Confirm the environment variable setting
   echo $SERVER_PORT
   ```

3. Check the firewall settings:

   ```bash
   # MacOS
   sudo pfctl -s rules

   # Linux
   sudo iptables -L
   ```

4. Verify the host address:
   ```bash
   # Confirm the environment variable setting
   echo $SERVER_HOST
   ```

### SSE Disconnections

**Symptom**: The Server-Sent Events (SSE) connection disconnects frequently.

**Possible causes**:

1. The client timeout is too short
2. Server resource limits
3. An unstable network
4. CORS configuration issues

**Solutions**:

1. Check client connection handling. The source guide presents the following as a timeout change, but it only enables credentials; the browser `EventSource` constructor has no timeout option:

   ```javascript
   const eventSource = new EventSource('/sse', {
     withCredentials: true,
   });
   ```

2. Check the server logs for error messages:

   ```bash
   tail -f logs/error.log
   ```

3. Ensure that CORS is configured correctly (when connecting from a browser). This is illustrative Express code, not a configuration setting; restrict origins to trusted clients before enabling credentials:

   ```javascript
   // Server-side CORS configuration
   app.use(
     cors({
       origin: true,
       credentials: true,
     }),
   );
   ```

4. The source guide suggests WebSocket as an alternative. MCP Advisor implements no WebSocket transport; use a supported transport (`stdio`, `sse`, or `rest`) and diagnose network or proxy interruptions.

## Search Issues

### No Results Returned

**Symptom**: A search query returns no results, even when matches are expected.

**Possible causes**:

1. The query is too specific
2. Network connection issues
3. Incorrect API endpoint configuration
4. The similarity threshold is too high

**Solutions**:

1. Try a more general query:

   ```
   # Too specific
   "An MCP server for financial data analysis with real-time data streaming and advanced visualization"

   # More general
   "Financial data analysis MCP"
   ```

2. Check network connectivity to the registry API:

   ```bash
   curl -v https://getmcp.io/api/servers.json
   ```

3. Verify the API endpoint configuration:

   ```bash
   # Check environment variables
   env | grep API
   ```

4. Lower the similarity threshold:
   ```javascript
   // The current default is 0.4; try lowering it
   const results = await searchService.search(
     { taskDescription: query },
     { minSimilarity: 0.3 },
   );
   ```

### Irrelevant Results

**Symptom**: Search results are unrelated to the query.

**Possible causes**:

1. Vector embedding quality issues
2. Unbalanced text matching weights
3. Incorrect provider priorities
4. A language mismatch

**Solutions**:

1. Check the vector embedding model:

   ```bash
   # Confirm which embedding model is used
   grep -r "embeddingModel" src/
   ```

2. The source guide illustrates adjusting text and vector search weights. The following historical example is not supported by current `SearchOptions`; implementing such weights requires code changes:

   ```javascript
   // Increase the text matching weight
   const results = await searchService.search(
     { taskDescription: query },
     {
       textMatchWeight: 0.5,
       vectorMatchWeight: 0.5,
     },
   );
   ```

3. Review or change the provider priority constant in `src/services/searchService.ts` (a source change, not a configuration-file override). Current values:

   ```javascript
   // In src/services/searchService.ts
   const PROVIDER_PRIORITIES = {
     CompassSearchProvider: 8,
     GetMcpSearchProvider: 10,
     MeilisearchSearchProvider: 9,
     OfflineSearchProvider: 5,
   };
   ```

4. Make sure the embedding model supports multiple languages.

## Performance Issues

### Slow Search Responses

**Symptom**: Search queries take a long time to return results.

**Possible causes**:

1. Server resource limits
2. External API latency
3. Expensive vector calculations
4. Missing caching

**Solutions**:

1. Check server resource usage:

   ```bash
   top -u <username>
   ```

2. Enable debug logs while investigating external API latency. The source guide's `ENABLE_PERFORMANCE_LOGGING` switch has no current implementation; timing instrumentation requires a code change:

   ```bash
   # Enable diagnostic debug logging
   mkdir -p logs
   ENABLE_FILE_LOGGING=true LOG_LEVEL=debug node build/index.js
   ```

3. Implement query caching if needed. This illustrative code requires an `actualSearch` implementation and a cache size/expiry policy:

```javascript
// Use an in-memory cache
const queryCache = new Map();

async function cachedSearch(query, options) {
  const cacheKey = `${query}-${JSON.stringify(options)}`;

  if (queryCache.has(cacheKey)) {
    return queryCache.get(cacheKey);
  }

  const results = await actualSearch(query, options);
  queryCache.set(cacheKey, results);

  return results;
}
```

4. Optimize vector calculations. This illustrative example requires a `batchGenerateEmbeddings` implementation:
   ```javascript
   // Use batching
   const embeddings = await batchGenerateEmbeddings(queries);
   ```

### Excessive Memory Usage

**Symptom**: Server memory usage keeps increasing, potentially causing crashes.

**Possible causes**:

1. Memory leaks
2. Unbounded cache growth
3. Large vector datasets
4. Excessive logging

**Solutions**:

1. Use memory profiling tools:

   ```bash
   # Use Node.js built-in heap snapshots
   node --inspect build/index.js
   ```

2. Implement an LRU cache to limit its size. This historical CommonJS example requires an additional `lru-cache` dependency and adaptation to its installed API and this project's ES module format:

   ```javascript
   const LRU = require('lru-cache');

   const cache = new LRU({
     max: 500, // Maximum number of items
     maxAge: 1000 * 60 * 60, // Expires after 1 hour
   });
   ```

3. Reduce vector dimensions or use dimensionality reduction techniques. This illustrative example requires an `applyPCA` implementation and consistent dimensions for stored and query vectors:

   ```javascript
   // Use PCA to reduce dimensions
   const reducedVector = applyPCA(originalVector, 100);
   ```

4. Limit logging verbosity:
   ```bash
   mkdir -p logs
   ENABLE_FILE_LOGGING=true LOG_LEVEL=info node build/index.js
   ```

## Configuration Issues

### Environment Variables Have No Effect

**Symptom**: Changing environment variables has no effect.

**Possible causes**:

1. Incorrect environment variable format
2. The application has not been restarted
3. Configuration loading order issues
4. Misspelled variable names

**Solutions**:

1. Check the environment variable format:

```bash
# Correct format
export TRANSPORT_TYPE=sse

# The CLI does not automatically load a .env file.
# Export settings in the launching shell or configure your MCP client.
```

2. Stop the running process and start it again after building. There is no `restart` package script:

   ```bash
   node build/index.js
   ```

3. Verify the configuration loading order:

   ```javascript
   // Check the configuration loading code
   console.log('Loading configuration...');
   // Inspect only non-secret settings; do not print the full environment.
   console.log({ TRANSPORT_TYPE: process.env.TRANSPORT_TYPE });
   ```

4. Double-check variable names:
   ```bash
   # List all environment variables
   env | grep MCP
   ```

### Configuration File Conflicts

**Symptom**: Configuration file settings conflict with environment variables.

**Possible causes**:

1. Multiple configuration sources
2. Unclear precedence
3. Incorrect configuration file format

**Solutions**:

1. Understand configuration precedence:

   - The source guide gives the general ordering: command-line arguments > environment variables > configuration files > defaults. Verify each setting rather than treating this as universal. [`src/index.ts`](../src/index.ts) applies CLI > environment > default for transport mode, host, and port. [`loadConfig()`](../src/config/configLoader.ts) returns early when loading an existing custom configuration file, before its separate environment-override step.

2. Check the configuration file format:

   ```bash
   # Validate JSON format
   jq . config.json
   ```

3. Inspect which code loads the affected setting. The following preserves the source guide's custom-config example, but it does not make `CONFIG_FILE` the sole source for every setting; transport mode is selected separately in `src/index.ts`:

   ```bash
   # Clear the environment variable
   unset TRANSPORT_TYPE

   # Use a configuration file
   CONFIG_FILE=./custom-config.json node build/index.js
   ```

## Development and Commit Issues

### Pre-commit Hook Failures

**Symptom**: A Git hook blocks a commit. The current [pre-commit hook](../.husky/pre-commit) runs `npx tsc --noEmit`; the [commit-msg hook](../.husky/commit-msg) validates commit messages. ESLint troubleshooting below applies to separately run lint checks.

**Possible causes**:

1. TypeScript type errors
2. ESLint code style issues
3. A commit message that does not follow the required format

**Solutions**:

1. **TypeScript type checking fails**:

   ```bash
   # Run the same type check as the pre-commit hook
   npx tsc --noEmit

   # Run lint and formatting checks separately
   pnpm run check

   # Rebuild after fixing type errors
   pnpm run build

   # Commit again
   git commit -m "fix: Fix type errors"
   ```

2. **ESLint checks fail**:

   ```bash
   # Automatically fix lint issues
   pnpm run lint:fix

   # Manually check the remaining issues
   pnpm run lint

   # Commit again
   git add .
   git commit -m "style: Fix linting issues"
   ```

3. **Incorrect commit message format**:

   ```bash
   # Incorrect example (starts with a lowercase letter)
   git commit -m "feat: add new feature"
   # ❌ Error: subject must be sentence-case [subject-case]

   # Correct format (starts with an uppercase letter)
   git commit -m "feat: Add new feature"
   # ✅ Correct

   # Amend only an existing last commit that you intend to change.
   # A rejected commit creates no new commit; retry git commit after fixing it.
   git commit --amend -m "feat: Add new feature with proper case"
   ```

4. **Skip pre-commit hooks entirely** (not recommended):
   ```bash
   # Use only in emergencies
   git commit --no-verify -m "feat: Emergency commit"
   ```

### Common Commit Message Errors

**Error types and fixes**:

1. **Incorrect sentence case**:

   ```bash
   # ❌ Incorrect
   feat: add vector search functionality

   # ✅ Correct
   feat: Add vector search functionality
   ```

2. **Incorrect type**:

   ```bash
   # ❌ Incorrect
   feature: Add new search provider

   # ✅ Correct
   feat: Add new search provider
   ```

3. **Subject line too long**:

   ```bash
   # ❌ Incorrect (more than 72 characters)
   feat: Add comprehensive vector similarity search functionality with Meilisearch integration and fallback mechanisms

   # ✅ Correct
   feat: Add vector similarity search with Meilisearch

   Add comprehensive search functionality with proper fallback
   mechanisms and error handling.
   ```

### Development Environment Issues

**Incompatible Node.js version**:

The source guide uses Node.js 18 below. This is a historical example, not a current supported-version recommendation; choose a maintained release compatible with the project and its dependencies.

```bash
# Check the current Node.js version
node --version

# Historical source-guide example: switch with nvm
nvm use 18

# Historical source-guide example: install with nvm
nvm install 18
nvm alias default 18
```

**Dependency installation issues**:

```bash
# Clean the dependency cache
pnpm store prune

# Remove installed dependencies while preserving the lockfile
rm -rf node_modules

# Reinstall the locked dependency versions
pnpm install --frozen-lockfile
```

## Logging and Debugging

Keep console logging disabled for stdio MCP transport: diagnostic output on
stdout can corrupt protocol messages. The examples below use file-only logging.
Do not set `MCP_COMPASS_MAIN=true` or `ENABLE_CONSOLE_LOGGING=true` for a stdio
client connection.

### Enable Verbose Logging

To enable verbose logging for troubleshooting:

```bash
# Enable debug logging
mkdir -p logs
ENABLE_FILE_LOGGING=true LOG_LEVEL=debug node build/index.js

# Enable file logging
mkdir -p logs
ENABLE_FILE_LOGGING=true node build/index.js

# No ENABLE_PERFORMANCE_LOGGING switch is implemented.
# Use the performance profiling commands below for diagnostics.
```

### View Log Files

With file logging enabled, log files are located in `LOGS_DIR`, or `logs` by default. The following commands assume the default directory:

```bash
# View the latest logs
tail -f logs/all.log

# View error logs
grep error logs/all.log

# View logs for a specific component
grep "SearchService" logs/all.log
```

### Use Debugging Tools

Use the Node.js debugging tools:

```bash
# Enable the inspector
node --inspect build/index.js

# Open in Chrome
chrome://inspect
```

## Common Error Codes

These labels are diagnostic categories retained from the source guide, not a guaranteed error-code API emitted by MCP Advisor.

### ERR_CONNECTION_REFUSED

**Description**: Unable to establish a connection to the server.

**Solutions**:

1. Make sure the server is running
2. Check the host and port configuration
3. Verify network connectivity

### ERR_INVALID_QUERY

**Description**: The query format is invalid or the query is empty.

**Solutions**:

1. Make sure the query is not empty
2. Check the query format
3. Remove special characters

### ERR_PROVIDER_UNAVAILABLE

**Description**: One or more search providers are unavailable.

**Solutions**:

1. Check the external API status
2. Verify API keys and credentials
3. Confirm network connectivity

### ERR_VECTOR_GENERATION

**Description**: Unable to generate vector embeddings for the text.

**Solutions**:

1. Check the embedding model configuration
2. Validate the text input
3. Make sure sufficient memory is available

### ERR_RATE_LIMIT

**Description**: An external API rate limit has been reached.

**Solutions**:

1. Reduce request frequency
2. Implement request throttling
3. Consider upgrading the API plan

## Advanced Troubleshooting

### Diagnose Network Issues

Use network diagnostic tools:

```bash
# Check network connectivity
ping getmcp.io

# Trace the network route
traceroute getmcp.io

# Check DNS resolution
dig getmcp.io

# Test the HTTP connection
curl -v https://getmcp.io/api/servers.json
```

### Performance Profiling

Use performance profiling tools:

```bash
# Use the Node.js built-in profiler
node --prof build/index.js

# Analyze the results
node --prof-process isolate-*.log > profile.txt

# Use clinic.js
npx clinic doctor -- node build/index.js
```

### Investigate Memory Leaks

Identify and fix memory leaks. The heap-snapshot commands use the current entry point. The `memwatch-next` installation and CommonJS snippet below are historical examples; that package is not a project dependency, and its runtime compatibility and ES module integration must be checked before use.

```bash
# Generate a heap snapshot
node --inspect build/index.js
# Analyze the heap snapshot in Chrome DevTools

# Use memwatch
npm install memwatch-next
# Add to the code
const memwatch = require('memwatch-next');
memwatch.on('leak', (info) => {
  console.log('Memory leak detected:', info);
});
```

## Getting Help

If you cannot resolve the issue, try these resources:

1. Check [GitHub Issues](https://github.com/istarwyh/mcpadvisor/issues)
2. Ask a question in [GitHub Discussions](https://github.com/istarwyh/mcpadvisor/discussions)
3. Open a new issue with detailed information:
   - Operating system and version
   - Node.js version
   - MCP Advisor version
   - Complete error message
   - Steps to reproduce
   - Log excerpts

---

Related documentation:

- [Getting Started Guide](./GETTING_STARTED.md) - Installation, configuration, and basic usage
- [Technical Reference](./TECHNICAL_REFERENCE.md) - Advanced technical features and configuration
- [Architecture](./ARCHITECTURE.md) - System architecture and component details
- [Contributing Guide](../CONTRIBUTING.md) - Development environment setup and code contributions
