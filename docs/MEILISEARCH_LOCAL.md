# Local Meilisearch Integration for MCPAdvisor

This integration allows MCPAdvisor to use a local self-hosted Meilisearch instance instead of or as a fallback to the cloud service.

## Quick Start

### 1. Start Local Meilisearch

```bash
# Requires an installed ./meilisearch binary; keep this shell and its key.
export MEILI_MASTER_KEY="$(openssl rand -hex 32)"
pnpm meilisearch:start

# Check if it's running
pnpm meilisearch:health
```

### 2. Configure Environment Variables

```bash
export MEILISEARCH_INSTANCE=local
export MEILISEARCH_LOCAL_HOST=http://localhost:7700
export MEILISEARCH_MASTER_KEY="$MEILI_MASTER_KEY"
```

### 3. Run MCPAdvisor

After building, run `node build/index.js` in the configured shell. The local
index must already contain data, or you must explicitly enable catalog indexing
as described in [Full-text search](./full-text-search.md). The startup script
references an absent bootstrap file; its best-effort bootstrap is not proof that
the index is populated. Do not share its output or `~/.meilisearch/env`, which
contain the local key.

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `MEILISEARCH_INSTANCE` | Instance type: 'local' or 'cloud' | 'cloud' |
| `MEILISEARCH_LOCAL_HOST` | Local Meilisearch URL | 'http://localhost:7700' |
| `MEILISEARCH_MASTER_KEY` | Master key for local instance | 'developmentKey' |
| `MEILISEARCH_INDEX_NAME` | Index name for local instance | 'mcp_servers' |
| `MEILISEARCH_CLOUD_API_KEY` | API key for cloud instance | Placeholder only; supply a valid key |

## Testing

### Run All Meilisearch Tests
```bash
pnpm test:meilisearch:all
```

### Run Specific Test Suites
```bash
# Unit tests
pnpm test:meilisearch:config
pnpm test:meilisearch:failover

# Integration tests (requires running Meilisearch)
pnpm test:meilisearch:local

# E2E tests (requires MCP Inspector and Meilisearch)
pnpm test:meilisearch:e2e
```

The legacy Inspector environment-switching suite is not covered by the migrated
Inspector suite. These commands do not establish that all E2E tests pass; see
[Inspector validation boundaries](./inspector-ui-testing.md).

## Management Commands

```bash
# Start local Meilisearch
pnpm meilisearch:start

# Legacy helper: stops all processes matching meilisearch; use only in isolation.
# Otherwise stop the specific PID printed by the startup script.
pnpm meilisearch:stop

# Logs written by the current startup script
tail -f ~/.meilisearch/meilisearch.log

# Check health
pnpm meilisearch:health
```

## Features

- ✅ **Automatic Failover**: Falls back to cloud instance if local fails
- ✅ **Health Monitoring**: Built-in health checks and monitoring
- ✅ **Environment-based Configuration**: Easy switching between local/cloud
- ✅ **Binary Installation**: Fast and lightweight setup
- ✅ **Comprehensive Testing**: Unit, integration, and E2E tests
- ✅ **Performance Monitoring**: Response time tracking and comparison

## Architecture

The integration uses the Strategy Pattern with a Failover Client:

```
MeilisearchSearchProvider
├── FailoverMeilisearchClient
    ├── PrimaryClient (LocalMeilisearchController | CloudClient)
    └── FallbackClient (CloudClient | null)
```

When `MEILISEARCH_INSTANCE=local`:
- Primary: Local Meilisearch instance
- Fallback: Cloud Meilisearch instance

When `MEILISEARCH_INSTANCE=cloud`:
- Primary: Cloud Meilisearch instance  
- Fallback: None

## Troubleshooting

### Local Meilisearch Won't Start
```bash
# Check if binary exists
ls -la ./meilisearch

# Check port conflicts
lsof -i :7700

# View detailed logs
tail -f ~/.meilisearch/meilisearch.log
```

### Tests Failing
```bash
# Ensure Meilisearch is running
pnpm meilisearch:health

# Check environment variables
echo $MEILISEARCH_INSTANCE
echo $TEST_MEILISEARCH_HOST

# Run with debug output
MEILISEARCH_INSTANCE=local pnpm test:meilisearch:local
```

### Performance Issues
- Check available memory and configure the engine explicitly; the startup script does not set a 256 MB limit
- Monitor response times using the built-in monitoring tools
- Consider adjusting Meilisearch configuration for your system resources

## Production Deployment

For production use:

1. **Security**: Use a strong master key
2. **Resources**: Monitor system resources and adjust as needed
3. **Persistence**: Ensure data directory permissions are correct
4. **Monitoring**: Enable the monitoring system
5. **Backup**: Implement regular data backups

```bash
# Production environment variables
export MEILISEARCH_INSTANCE=local
export MEILISEARCH_LOCAL_HOST=http://your-meilisearch-host:7700
export MEILISEARCH_MASTER_KEY=your-secure-master-key
export MEILISEARCH_INDEX_NAME=mcp_servers_prod
```