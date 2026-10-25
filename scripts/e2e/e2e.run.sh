#!/bin/bash

# Legacy Inspector UI harness. Passing this runner does not establish modern
# MCP compatibility; use test:protocol for the current protocol contract.
set -euo pipefail
# Give only the processes we launch their own groups, including their children.
set -m

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$PROJECT_ROOT"
MCP_INSPECTOR_PID=""
PLAYWRIGHT_PID=""
BUILD_PID=""
TEST_MODE=${1:-headed}
STARTUP_TIMEOUT=${E2E_STARTUP_TIMEOUT:-30}
HEALTH_TIMEOUT=${E2E_HEALTH_TIMEOUT:-20}

stop_owned_group() {
    local pid=$1
    [[ -n "$pid" ]] || return 0
    kill -TERM -- "-$pid" 2>/dev/null || true
    # Bound cleanup even if a child ignores TERM. Never kill by name or port.
    for _ in {1..20}; do
        kill -0 -- "-$pid" 2>/dev/null || break
        sleep 0.1
    done
    kill -KILL -- "-$pid" 2>/dev/null || true
    wait "$pid" 2>/dev/null || true
}

cleanup() {
    local status=$?
    trap - EXIT INT TERM
    stop_owned_group "$BUILD_PID"
    stop_owned_group "$PLAYWRIGHT_PID"
    stop_owned_group "$MCP_INSPECTOR_PID"
    exit "$status"
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

case "$TEST_MODE" in
    headless|headed|debug|ui) ;;
    *) echo "Unknown test mode: $TEST_MODE" >&2; exit 2 ;;
esac
for timeout in "$STARTUP_TIMEOUT" "$HEALTH_TIMEOUT"; do
    if [[ ! "$timeout" =~ ^[1-9][0-9]*$ ]]; then
        echo "E2E timeouts must be positive integer seconds" >&2
        exit 2
    fi
done

# Fail before starting anything when dependencies or ports are unavailable.
for command in pnpm mcp-inspector npx curl; do
    if ! command -v "$command" >/dev/null 2>&1; then
        echo "Required command unavailable: $command" >&2
        exit 127
    fi
done
if command -v lsof >/dev/null 2>&1; then
    for port in 6274 6277; do
        if lsof -tiTCP:"$port" -sTCP:LISTEN >/dev/null 2>&1; then
            echo "Port $port is already in use; no existing process was stopped" >&2
            exit 1
        fi
    done
fi

pnpm run build &
BUILD_PID=$!
wait "$BUILD_PID"
stop_owned_group "$BUILD_PID"
BUILD_PID=""
# Restrict the log containing Inspector's transient authentication token.
umask 077
: > mcp-inspector.log
chmod 600 mcp-inspector.log
ENABLE_FILE_LOGGING=true mcp-inspector node "$PROJECT_ROOT/build/index.js" > mcp-inspector.log 2>&1 &
MCP_INSPECTOR_PID=$!

INSPECTOR_URL=""
for ((count=0; count<=STARTUP_TIMEOUT; count++)); do
    if ! kill -0 "$MCP_INSPECTOR_PID" 2>/dev/null; then
        status=0
        wait "$MCP_INSPECTOR_PID" || status=$?
        [[ "$status" -ne 0 ]] || status=1
        echo "MCP Inspector exited before becoming ready ($status)" >&2
        exit "$status"
    fi
    INSPECTOR_URL=$(grep -o 'http://localhost:[0-9]*/?MCP_PROXY_AUTH_TOKEN=[a-f0-9]*' mcp-inspector.log | head -1 || true)
    [[ -z "$INSPECTOR_URL" ]] || break
    [[ "$count" -lt "$STARTUP_TIMEOUT" ]] || break
    sleep 1
done
if [[ -z "$INSPECTOR_URL" ]]; then
    if ! kill -0 "$MCP_INSPECTOR_PID" 2>/dev/null; then
        status=0
        wait "$MCP_INSPECTOR_PID" || status=$?
        [[ "$status" -ne 0 ]] || status=1
        echo "MCP Inspector exited before becoming ready ($status)" >&2
        exit "$status"
    fi
    echo "MCP Inspector startup timed out; inspect mcp-inspector.log locally" >&2
    exit 1
fi
BASE_URL=${INSPECTOR_URL%%\?*}
AUTH_TOKEN=${INSPECTOR_URL##*MCP_PROXY_AUTH_TOKEN=}
[[ -n "$AUTH_TOKEN" ]] || { echo "Missing Inspector token" >&2; exit 1; }

ready=false
for ((count=0; count<HEALTH_TIMEOUT; count++)); do
    kill -0 "$MCP_INSPECTOR_PID" 2>/dev/null || { echo "MCP Inspector exited" >&2; exit 1; }
    if curl --fail --silent --max-time 1 "${BASE_URL%/}/health" >/dev/null 2>&1; then
        ready=true
        break
    fi
    sleep 1
done
if [[ "$ready" != true ]]; then
    echo "MCP Inspector health check timed out" >&2
    exit 1
fi

export MCP_AUTH_TOKEN="$AUTH_TOKEN"
export MCP_INSPECTOR_URL="$BASE_URL"
args=(test)
case "$TEST_MODE" in
    headed) args+=(--headed) ;;
    debug) args+=(--debug) ;;
    ui) args+=(--ui) ;;
esac
NODE_OPTIONS='--no-deprecation' npx playwright "${args[@]}" &
PLAYWRIGHT_PID=$!
status=0
wait "$PLAYWRIGHT_PID" || status=$?
# A terminated Inspector invalidates an otherwise successful UI run.
if [[ "$status" -eq 0 ]] && ! kill -0 "$MCP_INSPECTOR_PID" 2>/dev/null; then
    echo "MCP Inspector exited during the test run" >&2
    status=1
fi
if [[ "$status" -eq 0 ]]; then
    echo "Playwright completed successfully"
else
    echo "Playwright did not complete successfully ($status)" >&2
fi
# All modes exit when Playwright exits. Debug/UI remain interactive in Playwright.
exit "$status"
