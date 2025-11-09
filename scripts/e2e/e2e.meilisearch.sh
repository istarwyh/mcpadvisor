#!/bin/bash

set -euo pipefail

# 脚本名称和版本
SCRIPT_NAME="Meilisearch E2E 测试"
VERSION="1.0.0"

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
WHITE='\033[1;37m'
NC='\033[0m' # No Color

# Emoji
ROCKET="🚀"
CHECK="✅"
WARNING="⚠️"
ERROR="❌"
INFO="ℹ️"
GEAR="🔧"
LIGHTNING="⚡"
STOP="🛑"

# 配置变量
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MCP_INSPECTOR_PORT=6274
MCP_PROXY_PORT=6277
MEILISEARCH_PORT=7700
BUILD_DIR="$PROJECT_ROOT/build"
RESULTS_DIR="$PROJECT_ROOT/test-results"

# 进程跟踪
INSPECTOR_PID=""
MEILISEARCH_PID=""
CLEANUP_DONE=false

# 日志函数
log_info() {
    echo -e "${CYAN}${INFO} $1${NC}"
}

log_success() {
    echo -e "${GREEN}${CHECK} $1${NC}"
}

log_warning() {
    echo -e "${YELLOW}${WARNING} $1${NC}"
}

log_error() {
    echo -e "${RED}${ERROR} $1${NC}"
}

log_step() {
    echo -e "${BLUE}${GEAR} $1${NC}"
}

# 显示帮助信息
show_help() {
    cat << EOF
${WHITE}$SCRIPT_NAME v$VERSION${NC}

自动化 Meilisearch E2E 测试脚本 - 自动启动所有必需服务并运行测试

${YELLOW}用法:${NC}
    $0 [选项] [模式]

${YELLOW}模式:${NC}
    headed      有头模式 - 显示浏览器 (默认)
    headless    无头模式 - 后台运行
    debug       调试模式 - 测试失败时暂停
    ui          Playwright UI 模式

${YELLOW}选项:${NC}
    -h, --help     显示此帮助信息
    -v, --verbose  详细输出
    -f, --force    强制重启服务
    --no-build     跳过构建步骤
    --no-cleanup   测试后不清理服务

${YELLOW}示例:${NC}
    $0                    # 默认有头模式
    $0 headless          # 无头模式运行
    $0 debug --verbose   # 调试模式，详细输出
    $0 ui --no-build     # UI模式，跳过构建

${YELLOW}环境变量:${NC}
    MCP_AUTH_TOKEN              MCP 认证令牌 (自动生成)
    TEST_MEILISEARCH_HOST       Meilisearch 主机 (默认: http://localhost:7700)
    TEST_MEILISEARCH_KEY        Meilisearch API 密钥 (默认: developmentKey123)
    PLAYWRIGHT_TIMEOUT          Playwright 超时时间 (默认: 30000ms)

EOF
}

# 解析命令行参数
VERBOSE=false
FORCE=false
NO_BUILD=false
NO_CLEANUP=false
# 在CI环境中默认使用headless模式，否则使用headed模式
MODE="headed"
if [[ -n "${CI:-}" ]]; then
    MODE="headless"
    VERBOSE=true  # CI中启用详细日志
fi

while [[ $# -gt 0 ]]; do
    case $1 in
        -h|--help)
            show_help
            exit 0
            ;;
        -v|--verbose)
            VERBOSE=true
            shift
            ;;
        -f|--force)
            FORCE=true
            shift
            ;;
        --no-build)
            NO_BUILD=true
            shift
            ;;
        --no-cleanup)
            NO_CLEANUP=true
            shift
            ;;
        headed|headless|debug|ui)
            MODE="$1"
            shift
            ;;
        *)
            log_error "未知参数: $1"
            show_help
            exit 1
            ;;
    esac
done

# 详细日志函数
verbose_log() {
    if [[ "$VERBOSE" == "true" ]]; then
        log_info "$1"
    fi
}

# 检查端口是否被占用
check_port() {
    local port=$1
    local name=$2
    
    if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null 2>&1; then
        if [[ "$FORCE" == "true" ]]; then
            log_warning "$name 端口 $port 被占用，强制停止现有进程..."
            local pids=$(lsof -Ti :$port)
            if [[ -n "$pids" ]]; then
                kill -9 $pids 2>/dev/null || true
            fi
            sleep 2
        else
            log_warning "$name 端口 $port 已被占用"
            return 1
        fi
    fi
    return 0
}

# 清理MCP Inspector相关端口
cleanup_inspector_ports() {
    log_step "清理 MCP Inspector 端口..."
    
    # 清理主端口6274和代理端口6277
    for port in $MCP_INSPECTOR_PORT $MCP_PROXY_PORT; do
        local pids=$(lsof -Ti :$port 2>/dev/null || true)
        if [[ -n "$pids" ]]; then
            verbose_log "清理端口 $port 上的进程: $pids"
            kill -9 $pids 2>/dev/null || true
        fi
    done
    
    # 额外清理inspector相关进程
    pkill -f "inspector" 2>/dev/null || true
    
    sleep 2
    log_success "MCP Inspector 端口清理完成"
}

# 等待端口可用
wait_for_port() {
    local port=$1
    local name=$2
    local timeout=${3:-30}
    
    verbose_log "等待 $name 在端口 $port 启动..."
    
    local count=0
    while ! nc -z localhost $port >/dev/null 2>&1; do
        if [[ $count -ge $timeout ]]; then
            log_error "$name 启动超时 (端口 $port)"
            return 1
        fi
        sleep 1
        ((count++))
        if [[ $((count % 5)) -eq 0 ]]; then
            verbose_log "等待 $name 启动... (${count}s)"
        fi
    done
    
    log_success "$name 已在端口 $port 启动"
}

# 等待服务健康检查
wait_for_health() {
    local url=$1
    local name=$2
    local timeout=${3:-30}
    
    verbose_log "等待 $name 健康检查通过..."
    
    local count=0
    while ! curl -f -s "$url" >/dev/null 2>&1; do
        if [[ $count -ge $timeout ]]; then
            log_error "$name 健康检查超时"
            return 1
        fi
        sleep 1
        ((count++))
        if [[ $((count % 5)) -eq 0 ]]; then
            verbose_log "等待 $name 健康检查... (${count}s)"
        fi
    done
    
    log_success "$name 健康检查通过"
}

# 清理函数
cleanup() {
    if [[ "$CLEANUP_DONE" == "true" ]]; then
        return 0
    fi
    
    CLEANUP_DONE=true
    
    echo
    log_step "开始清理服务..."
    
    # 停止 MCP Inspector
    if [[ -n "$INSPECTOR_PID" ]] && kill -0 "$INSPECTOR_PID" 2>/dev/null; then
        verbose_log "停止 MCP Inspector (PID: $INSPECTOR_PID)"
        kill -TERM "$INSPECTOR_PID" 2>/dev/null || true
        # 等待进程正常退出
        local count=0
        while kill -0 "$INSPECTOR_PID" 2>/dev/null && [[ $count -lt 10 ]]; do
            sleep 1
            ((count++))
        done
        # 如果还没退出，强制kill
        if kill -0 "$INSPECTOR_PID" 2>/dev/null; then
            kill -KILL "$INSPECTOR_PID" 2>/dev/null || true
        fi
    fi
    
    # 停止 Meilisearch (如果我们启动的)
    if [[ "$NO_CLEANUP" != "true" ]]; then
        if [[ -n "$MEILISEARCH_PID" ]] && kill -0 "$MEILISEARCH_PID" 2>/dev/null; then
            verbose_log "停止 Meilisearch (PID: $MEILISEARCH_PID)"
            kill -TERM "$MEILISEARCH_PID" 2>/dev/null || true
            # 等待进程正常退出
            local count=0
            while kill -0 "$MEILISEARCH_PID" 2>/dev/null && [[ $count -lt 5 ]]; do
                sleep 1
                ((count++))
            done
            # 如果还没退出，强制kill
            if kill -0 "$MEILISEARCH_PID" 2>/dev/null; then
                kill -KILL "$MEILISEARCH_PID" 2>/dev/null || true
            fi
        fi
        
        # 额外清理 Meilisearch 进程
        pkill -f "meilisearch" 2>/dev/null || true
    fi
    
    log_success "清理完成"
    return 0
}

# 设置清理陷阱
trap cleanup EXIT INT TERM

# 检查依赖
check_dependencies() {
    log_step "检查依赖..."
    
    local missing_deps=()
    
    # 检查 Node.js
    if ! command -v node &> /dev/null; then
        missing_deps+=("node")
    fi
    
    # 检查 pnpm
    if ! command -v pnpm &> /dev/null; then
        missing_deps+=("pnpm")
    fi
    
    # 检查 nc (netcat)
    if ! command -v nc &> /dev/null; then
        missing_deps+=("nc")
    fi
    
    # 检查 curl
    if ! command -v curl &> /dev/null; then
        missing_deps+=("curl")
    fi
    
    if [[ ${#missing_deps[@]} -gt 0 ]]; then
        log_error "缺少依赖: ${missing_deps[*]}"
        echo "请安装缺少的依赖后重试"
        exit 1
    fi
    
    log_success "所有依赖已满足"
}

# 设置环境变量
setup_environment() {
    log_step "设置环境变量..."
    
    # 生成认证令牌
    if [[ -z "${MCP_AUTH_TOKEN:-}" ]]; then
        export MCP_AUTH_TOKEN=$(openssl rand -hex 32 2>/dev/null || python3 -c "import secrets; print(secrets.token_hex(32))" 2>/dev/null || node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
        verbose_log "生成 MCP_AUTH_TOKEN: ${MCP_AUTH_TOKEN:0:8}..."
    fi
    
    # 设置 Meilisearch 环境变量
    export TEST_MEILISEARCH_HOST="${TEST_MEILISEARCH_HOST:-http://localhost:7700}"
    export TEST_MEILISEARCH_KEY="${TEST_MEILISEARCH_KEY:-developmentKey123}"
    export MEILISEARCH_INSTANCE="local"
    export MEILISEARCH_LOCAL_HOST="$TEST_MEILISEARCH_HOST"
    export MEILISEARCH_MASTER_KEY="$TEST_MEILISEARCH_KEY"
    export MEILISEARCH_INDEX_NAME="mcp_servers_test"
    
    # 设置测试环境
    export NODE_ENV="test"
    export MCP_INSPECTOR_URL="http://localhost:$MCP_INSPECTOR_PORT"
    export PLAYWRIGHT_TIMEOUT="${PLAYWRIGHT_TIMEOUT:-30000}"
    
    verbose_log "环境变量设置完成"
}

# 构建项目
build_project() {
    if [[ "$NO_BUILD" == "true" ]]; then
        log_info "跳过构建步骤"
        return
    fi
    
    log_step "构建项目..."
    
    cd "$PROJECT_ROOT"
    
    if ! pnpm run build >/dev/null 2>&1; then
        log_error "项目构建失败"
        exit 1
    fi
    
    if [[ ! -f "$BUILD_DIR/index.js" ]]; then
        log_error "构建产物不存在: $BUILD_DIR/index.js"
        exit 1
    fi
    
    log_success "项目构建完成"
}

# 启动 Meilisearch
start_meilisearch() {
    log_step "启动 Meilisearch..."
    
    # 检查是否已经运行
    if curl -f -s "http://localhost:$MEILISEARCH_PORT/health" >/dev/null 2>&1; then
        log_success "Meilisearch 已经在运行"
        return
    fi
    
    # 尝试使用现有脚本启动
    if [[ -x "$PROJECT_ROOT/scripts/start-local-meilisearch.sh" ]]; then
        verbose_log "使用启动脚本启动 Meilisearch..."
        MEILI_MASTER_KEY="$TEST_MEILISEARCH_KEY" "$PROJECT_ROOT/scripts/start-local-meilisearch.sh" >/dev/null 2>&1 &
        MEILISEARCH_PID=$!
        
        # 等待启动
        if wait_for_port $MEILISEARCH_PORT "Meilisearch" 30; then
            if wait_for_health "http://localhost:$MEILISEARCH_PORT/health" "Meilisearch" 10; then
                log_success "Meilisearch 启动成功"
                return
            fi
        fi
    fi
    
    # 回退：尝试直接启动 meilisearch
    if command -v meilisearch &> /dev/null; then
        verbose_log "直接启动 Meilisearch 二进制..."
        meilisearch --master-key="$TEST_MEILISEARCH_KEY" --http-addr="localhost:$MEILISEARCH_PORT" >/dev/null 2>&1 &
        MEILISEARCH_PID=$!
        
        if wait_for_port $MEILISEARCH_PORT "Meilisearch" 30; then
            if wait_for_health "http://localhost:$MEILISEARCH_PORT/health" "Meilisearch" 10; then
                log_success "Meilisearch 启动成功"
                return
            fi
        fi
    fi
    
    log_error "无法启动 Meilisearch"
    log_info "请手动启动 Meilisearch 或运行: pnpm meilisearch:start"
    exit 1
}

# 启动 MCP Inspector
start_inspector() {
    log_step "启动 MCP Inspector..."
    
    # 先清理端口
    cleanup_inspector_ports
    
    # 检查端口可用性
    check_port $MCP_INSPECTOR_PORT "MCP Inspector"
    check_port $MCP_PROXY_PORT "MCP Proxy"
    
    cd "$PROJECT_ROOT"
    
    # 创建临时文件来捕获输出
    local inspector_log=$(mktemp)
    
    # 启动 Inspector，确保使用正确的环境变量
    verbose_log "启动 MCP Inspector 进程..."
    
    # 优先使用 npx（最新版本），如果失败则尝试本地命令
    if npx @modelcontextprotocol/inspector --help >/dev/null 2>&1; then
        verbose_log "使用 npx @modelcontextprotocol/inspector 启动（推荐）"
        ENABLE_FILE_LOGGING=true npx @modelcontextprotocol/inspector node "$BUILD_DIR/index.js" > "$inspector_log" 2>&1 &
    elif command -v mcp-inspector &> /dev/null; then
        verbose_log "使用本地 mcp-inspector 命令启动"
        ENABLE_FILE_LOGGING=true mcp-inspector node "$BUILD_DIR/index.js" > "$inspector_log" 2>&1 &
    else
        log_error "未找到 MCP Inspector，请运行: npm install -g @modelcontextprotocol/inspector"
        rm -f "$inspector_log"
        exit 1
    fi
    INSPECTOR_PID=$!
    
    # 等待启动
    if ! wait_for_port $MCP_INSPECTOR_PORT "MCP Inspector" 30; then
        log_error "MCP Inspector 启动失败"
        cat "$inspector_log"
        rm -f "$inspector_log"
        exit 1
    fi
    
    # 等待代理端口
    if ! wait_for_port $MCP_PROXY_PORT "MCP Proxy" 10; then
        log_warning "MCP Proxy 端口未检测到，但继续进行"
    fi
    
    # 等待一下让日志产生
    sleep 3
    
    # 从日志中提取实际的session token
    if [[ -f "$inspector_log" ]]; then
        local extracted_token=$(grep -o "Session token: [a-f0-9]*" "$inspector_log" | sed 's/Session token: //' || true)
        if [[ -n "$extracted_token" ]]; then
            export MCP_AUTH_TOKEN="$extracted_token"
            verbose_log "从 Inspector 输出中提取到令牌: ${MCP_AUTH_TOKEN:0:8}..."
        else
            verbose_log "无法提取令牌，使用生成的令牌"
        fi
    fi
    
    # 清理临时文件
    rm -f "$inspector_log"
    
    # 健康检查
    if ! kill -0 "$INSPECTOR_PID" 2>/dev/null; then
        log_error "MCP Inspector 进程意外退出"
        exit 1
    fi
    
    log_success "MCP Inspector 启动成功"
    log_info "URL: http://localhost:$MCP_INSPECTOR_PORT/?MCP_PROXY_AUTH_TOKEN=$MCP_AUTH_TOKEN"
}

# 验证 MCP 连接
verify_mcp_connection() {
    log_step "验证 MCP 连接..."
    
    # 等待几秒让服务稳定
    sleep 5
    
    # 检查 Inspector 页面是否可访问
    local inspector_url="http://localhost:$MCP_INSPECTOR_PORT"
    if ! curl -f -s "$inspector_url" >/dev/null 2>&1; then
        log_error "无法访问 MCP Inspector 页面"
        return 1
    fi
    
    verbose_log "MCP Inspector 页面可访问"
    
    # 检查认证URL是否可访问
    local auth_url="$inspector_url/?MCP_PROXY_AUTH_TOKEN=$MCP_AUTH_TOKEN"
    if ! curl -f -s "$auth_url" >/dev/null 2>&1; then
        log_warning "认证URL可能有问题，但继续测试"
    else
        verbose_log "认证URL可访问"
    fi
    
    log_success "MCP 连接验证完成"
}

# 运行测试
run_tests() {
    log_step "运行 Meilisearch E2E 测试..."
    
    cd "$PROJECT_ROOT"
    
    # 创建结果目录
    mkdir -p "$RESULTS_DIR"
    
    # 根据模式选择 Playwright 参数
    local playwright_args=""
    case "$MODE" in
        "headed")
            playwright_args="--headed"
            ;;
        "headless")
            playwright_args=""
            ;;
        "debug")
            playwright_args="--debug"
            ;;
        "ui")
            playwright_args="--ui"
            ;;
    esac
    
    verbose_log "运行模式: $MODE"
    verbose_log "Playwright 参数: $playwright_args"
    
    # 运行测试（抑制 punycode 弃用警告）
    local test_command="NODE_OPTIONS='--no-deprecation' pnpm exec playwright test tests/e2e/meilisearch-local-e2e.spec.ts $playwright_args"
    
    if [[ "$VERBOSE" == "true" ]]; then
        log_info "执行: $test_command"
    fi
    
    # 使用exec运行测试，确保信号正确传播
    if eval "$test_command"; then
        log_success "所有测试通过! 🎉"
        
        # 显示结果
        if [[ -d "$RESULTS_DIR" ]]; then
            local result_count=$(find "$RESULTS_DIR" -name "*.png" 2>/dev/null | wc -l || echo "0")
            if [[ "$result_count" -gt 0 ]]; then
                log_info "测试截图保存在: $RESULTS_DIR"
            fi
        fi
        
        return 0
    else
        local exit_code=$?
        log_error "测试失败"
        
        # 显示失败信息
        log_info "查看详细报告: pnpm exec playwright show-report"
        if [[ -d "$RESULTS_DIR" ]]; then
            log_info "测试截图和视频: $RESULTS_DIR"
        fi
        
        # 如果是143 (SIGTERM)，这通常不是真正的测试失败
        if [[ $exit_code -eq 143 ]]; then
            log_warning "收到终止信号，但测试可能已成功完成"
            return 0
        fi
        
        return 1
    fi
}

# 主函数
main() {
    echo -e "${WHITE}${ROCKET} $SCRIPT_NAME v$VERSION${NC}"
    echo "========================================"
    
    # 检查依赖
    check_dependencies
    
    # 设置环境
    setup_environment
    
    # 构建项目
    build_project
    
    # 启动服务
    start_meilisearch
    start_inspector
    
    # 验证连接
    verify_mcp_connection
    
    # 等待服务就绪
    log_step "等待服务就绪..."
    sleep 3
    log_success "所有服务就绪"
    
    # 运行测试
    local test_result=0
    if ! run_tests; then
        test_result=1
    fi
    
    echo
    echo "========================================"
    if [[ $test_result -eq 0 ]]; then
        log_success "测试完成! 所有测试通过"
    else
        log_error "测试完成，但有失败"
    fi
    
    if [[ "$NO_CLEANUP" == "true" ]]; then
        log_info "服务继续运行 (--no-cleanup)"
        log_info "MCP Inspector: http://localhost:$MCP_INSPECTOR_PORT/?MCP_PROXY_AUTH_TOKEN=$MCP_AUTH_TOKEN"
        log_info "Meilisearch: http://localhost:$MEILISEARCH_PORT"
        log_info "按 Ctrl+C 停止服务"
        
        # 等待用户中断
        wait
    else
        # 在CI环境中，让容器自动清理以避免信号处理问题
        if [[ -n "${CI:-}" ]]; then
            log_info "CI环境：让容器自动清理资源"
            # 取消EXIT trap，避免清理冲突
            trap - EXIT INT TERM
        else
            # 手动调用清理，避免EXIT trap重复调用
            CLEANUP_DONE=false
            cleanup
            # 取消EXIT trap，避免重复清理
            trap - EXIT
        fi
    fi
    
    exit $test_result
}

# 执行主函数
main "$@"