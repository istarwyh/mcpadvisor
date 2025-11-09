#!/bin/bash
# 启动本地 Meilisearch 实例
# 使用二进制文件

set -e

echo "🚀 Starting local Meilisearch for MCPAdvisor..."

# Base directories for data and logs
BASE_DIR="$HOME/.meilisearch"
DB_PATH="$BASE_DIR/data.ms"
LOG_PATH="$BASE_DIR/meilisearch.log"
ENV_FILE="$BASE_DIR/env"

# Ensure directories exist
mkdir -p "$BASE_DIR"

# Check or generate master key
if [ -z "$MEILI_MASTER_KEY" ]; then
    echo "🔐 MEILI_MASTER_KEY not set. Generating a secure key..."
    if command -v openssl >/dev/null 2>&1; then
        MEILI_MASTER_KEY=$(openssl rand -hex 32)
        echo "✅ Generated MEILI_MASTER_KEY via openssl: $MEILI_MASTER_KEY"
    else
        # Fallback: generate 64-char alphanumeric
        MEILI_MASTER_KEY=$(head -c 64 /dev/urandom | LC_ALL=C tr -dc 'A-Za-z0-9' | head -c 64)
        echo "✅ Generated MEILI_MASTER_KEY via /dev/urandom fallback"
    fi
fi

# Check if meilisearch binary exists
if [ -f "./meilisearch" ]; then
    echo "📦 Found Meilisearch binary, starting..."
    
    # Check if already running
    if lsof -i :7700 > /dev/null 2>&1; then
        echo "✅ Meilisearch is already running at http://localhost:7700"
        exit 0
    fi
    
    # Start with binary (use fixed db and log paths)
    nohup ./meilisearch --master-key="$MEILI_MASTER_KEY" --db-path="$DB_PATH" > "$LOG_PATH" 2>&1 &
    MEILISEARCH_PID=$!
    echo "🔄 Started Meilisearch with PID: $MEILISEARCH_PID"
    
else
    echo "❌ Meilisearch binary not found"
    echo "Please install Meilisearch first:"
    echo "  curl -L https://install.meilisearch.com | sh"
    exit 1
fi

# Wait for health check
echo "⏳ Waiting for Meilisearch to be ready..."
timeout=60
counter=0
while ! curl -sf http://localhost:7700/health > /dev/null 2>&1; do
    if [ $counter -eq $timeout ]; then
        echo "❌ Meilisearch failed to start within ${timeout}s"
        if [ ! -z "$MEILISEARCH_PID" ]; then
            kill -- -$MEILISEARCH_PID 2>/dev/null || true
        fi
        exit 1
    fi
    counter=$((counter + 1))
    sleep 1
done

echo "✅ Meilisearch is ready at http://localhost:7700"
echo "📁 Data path: $DB_PATH"
echo "📝 Logs: $LOG_PATH"
echo "🔑 Master key: $MEILI_MASTER_KEY"
echo ""
echo "To stop Meilisearch, run:"
echo "  pkill -f meilisearch"
echo "  # or find PID: lsof -i :7700 and kill <PID>"
echo ""
echo "To use local Meilisearch in MCPAdvisor, set these environment variables:"
echo "  export MEILISEARCH_INSTANCE=local"
echo "  export MEILISEARCH_LOCAL_HOST=http://localhost:7700"
echo "  export MEILISEARCH_MASTER_KEY=$MEILI_MASTER_KEY"
echo "  export MEILISEARCH_INDEX_NAME=mcp_servers"
echo "  export MEILISEARCH_DB_PATH=$DB_PATH"

# Persist env for future shells
cat > "$ENV_FILE" <<EOF
export MEILISEARCH_INSTANCE=local
export MEILISEARCH_LOCAL_HOST=http://localhost:7700
export MEILISEARCH_MASTER_KEY=$MEILI_MASTER_KEY
export MEILISEARCH_INDEX_NAME=mcp_servers
export MEILISEARCH_DB_PATH=$DB_PATH
EOF
echo "🔧 Saved environment to $ENV_FILE (source this file to load vars)"

# Bootstrap local index with data if available (best-effort)
if command -v node >/dev/null 2>&1; then
  echo "🧩 Bootstrapping Meilisearch index with local data (best-effort)..."
  SCRIPT_DIR="$(dirname "$(readlink -f "$0")")"
  NODE_OPTIONS='--no-deprecation' MEILISEARCH_MASTER_KEY="$MEILI_MASTER_KEY" MEILISEARCH_LOCAL_HOST="http://localhost:7700" node "$SCRIPT_DIR/meilisearch.bootstrap.mjs" || \
    echo "⚠️  Bootstrap skipped or failed"
else
  echo "⚠️  Node.js not found, skipping bootstrap"
fi

# Final hint: load environment variables in current shell
echo ""
echo "💡 To load env vars now, run:"
echo "  source $ENV_FILE"