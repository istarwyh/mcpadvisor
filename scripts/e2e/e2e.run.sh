#!/bin/bash

# MCPAdvisor 端到端测试启动脚本
# 自动启动 MCP Inspector 并运行 Playwright 测试

set -e

echo "🚀 开始 MCPAdvisor 端到端测试流程"
echo "======================================="

# 清理函数
cleanup() {
    echo ""
    echo "🧹 清理进程..."
    if [[ -n $MCP_INSPECTOR_PID ]]; then
        kill $MCP_INSPECTOR_PID 2>/dev/null || true
        echo "✅ MCP Inspector 进程已终止"
    fi
    
    # 额外清理可能占用端口的进程
    cleanup_ports
    exit 0
}

# 清理端口占用
cleanup_ports() {
    local ports=(6274 6277)
    for port in "${ports[@]}"; do
        local pids=$(lsof -ti :$port 2>/dev/null || true)
        if [[ -n "$pids" ]]; then
            echo "🧹 清理端口 $port 上的进程: $pids"
            kill -9 $pids 2>/dev/null || true
        fi
    done
    # 额外清理 inspector 相关进程
    pkill -f "inspector" 2>/dev/null || true
    sleep 2
}

# 设置信号处理
trap cleanup SIGINT SIGTERM

# 第一步：构建项目
echo "📦 构建 MCPAdvisor..."
pnpm run build

if [ $? -ne 0 ]; then
    echo "❌ 构建失败"
    exit 1
fi

echo "✅ 构建完成"

# 第二步：启动 MCP Inspector
echo ""
echo "🔄 启动 MCP Inspector..."

# 先清理可能占用的端口
echo "🧹 清理现有端口占用..."
cleanup_ports

ENABLE_FILE_LOGGING=true mcp-inspector node "$(pwd)/build/index.js" > mcp-inspector.log 2>&1 &
MCP_INSPECTOR_PID=$!

echo "⏳ 等待 MCP Inspector 启动..."

# 等待并解析 MCP Inspector 输出
timeout=30
count=0
INSPECTOR_URL=""
AUTH_TOKEN=""

while [ $count -lt $timeout ]; do
    if [[ -f mcp-inspector.log ]]; then
        # 检查是否有 URL 和 token
        if grep -q "inspector with token pre-filled" mcp-inspector.log; then
            INSPECTOR_URL=$(grep -o "http://localhost:[0-9]*/?MCP_PROXY_AUTH_TOKEN=[a-f0-9]*" mcp-inspector.log | head -1)
            if [[ -n $INSPECTOR_URL ]]; then
                # 提取 token
                AUTH_TOKEN=$(echo $INSPECTOR_URL | grep -o "MCP_PROXY_AUTH_TOKEN=[a-f0-9]*" | cut -d'=' -f2)
                BASE_URL=$(echo $INSPECTOR_URL | cut -d'?' -f1)
                break
            fi
        fi
    fi
    sleep 1
    count=$((count + 1))
done

if [[ -z $INSPECTOR_URL ]]; then
    echo "❌ MCP Inspector 启动失败或超时"
    echo "日志内容："
    cat mcp-inspector.log 2>/dev/null || echo "无法读取日志文件"
    cleanup
fi

echo "✅ MCP Inspector 已启动"
echo "📍 URL: $BASE_URL"
echo "🔑 Token: $AUTH_TOKEN"

# 第三步：等待服务就绪
echo ""
echo "⏳ 等待服务就绪..."
for i in {1..10}; do
    if curl -s "$BASE_URL/health" > /dev/null 2>&1; then
        echo "✅ 服务就绪"
        break
    fi
    if [ $i -eq 10 ]; then
        echo "❌ 服务未就绪，超时"
        cleanup
    fi
    sleep 2
done

# 第四步：运行 Playwright 测试
echo ""
echo "🧪 运行 Playwright 测试..."
echo "使用 URL: $INSPECTOR_URL"

# 导出环境变量供 Playwright 使用
export MCP_AUTH_TOKEN="$AUTH_TOKEN"
export MCP_INSPECTOR_URL="$BASE_URL"

# 运行测试（根据参数选择模式）
TEST_MODE=${1:-"headed"}

case $TEST_MODE in
    "headless")
        echo "🔧 运行无头模式测试..."
        NODE_OPTIONS='--no-deprecation' npx playwright test
        ;;
    "debug")
        echo "🐛 运行调试模式测试..."
        NODE_OPTIONS='--no-deprecation' npx playwright test --debug
        ;;
    "ui")
        echo "🎨 运行 UI 模式测试..."
        NODE_OPTIONS='--no-deprecation' npx playwright test --ui
        ;;
    *)
        echo "👀 运行有头模式测试..."
        NODE_OPTIONS='--no-deprecation' npx playwright test --headed
        ;;
esac

TEST_EXIT_CODE=$?

# 第五步：显示结果
echo ""
echo "======================================="
if [ $TEST_EXIT_CODE -eq 0 ]; then
    echo "✅ 测试完成！所有测试通过"
else
    echo "❌ 测试完成，但有测试失败"
    echo "📊 查看详细报告: npx playwright show-report"
fi

echo ""
echo "📊 测试报告和截图位置: test-results/"
echo "🔗 Inspector 仍在运行: $INSPECTOR_URL"
echo ""
echo "按 Ctrl+C 停止 Inspector 并退出..."

# 保持脚本运行直到用户中断
while true; do
    sleep 1
done