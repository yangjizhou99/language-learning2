#!/bin/bash
# 开发环境启动脚本

echo "🚀 启动 Lang Trainer 开发服务器..."

# 检查环境变量文件
if [ ! -f ".env.local" ]; then
    echo "❌ 未找到 .env.local 文件"
    echo "请先配置环境变量，参考 docs/setup/ENVIRONMENT_VARIABLES_GUIDE.md"
    exit 1
fi

# 检查 Node.js 版本
node_version=$(node --version 2>/dev/null)
if [ $? -ne 0 ]; then
    echo "❌ 未安装 Node.js"
    exit 1
fi

echo "✅ Node.js 版本: $node_version"

# 检查 pnpm
if ! command -v pnpm &> /dev/null; then
    echo "❌ 未安装 pnpm，正在安装..."
    npm install -g pnpm
fi

echo "✅ pnpm 版本: $(pnpm --version)"

# 安装依赖（如果需要）
if [ ! -d "node_modules" ]; then
    echo "📦 安装依赖..."
    pnpm install
fi

# 启动开发服务器
echo "🌐 启动开发服务器..."
echo "访问地址: http://localhost:3000"
echo "按 Ctrl+C 停止服务器"
echo ""

pnpm dev
