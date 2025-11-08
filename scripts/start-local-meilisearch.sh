#!/bin/bash
# 启动本地 Meilisearch 实例
# 使用二进制文件

set -e

echo "🚀 Starting local Meilisearch for MCPAdvisor..."

# Check or generate master key
if [ -z "$MEILI_MASTER_KEY" ]; then
    echo "🔐 MEILI_MASTER_KEY not set. Generating a secure key..."
    if command -v openssl >/dev/null 2>&1; then
        MEILI_MASTER_KEY=$(openssl rand -hex 32)
        echo "✅ Generated MEILI_MASTER_KEY via openssl"
    else
        # Fallback: generate 64-char alphanumeric
        MEILI_MASTER_KEY=$(LC_ALL=C tr -dc 'A-Za-z0-9' </dev/urandom | head -c 64)
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
    
    # Start with binary
    nohup ./meilisearch --master-key="$MEILI_MASTER_KEY" > meilisearch.log 2>&1 &
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
            kill $MEILISEARCH_PID 2>/dev/null || true
        fi
        exit 1
    fi
    counter=$((counter + 1))
    sleep 1
done

echo "✅ Meilisearch is ready at http://localhost:7700"
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