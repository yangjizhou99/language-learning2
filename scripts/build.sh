#!/bin/bash
# 生产环境构建脚本

echo "🏗️ 构建 Lang Trainer 生产版本..."

# 检查环境变量文件
if [ ! -f ".env.local" ]; then
    echo "❌ 未找到 .env.local 文件"
    echo "请先配置环境变量，参考 docs/setup/ENVIRONMENT_VARIABLES_GUIDE.md"
    exit 1
fi

# 检查 pnpm
if ! command -v pnpm &> /dev/null; then
    echo "❌ 未安装 pnpm，正在安装..."
    npm install -g pnpm
fi

# 安装依赖
echo "📦 安装依赖..."
pnpm install

# 类型检查
echo "🔍 类型检查..."
pnpm exec tsc --noEmit

# 代码检查
echo "🔍 代码检查..."
pnpm exec next lint

# 构建项目
echo "🏗️ 构建项目..."
pnpm build

if [ $? -eq 0 ]; then
    echo "✅ 构建成功！"
    echo "📁 构建文件位于 .next 目录"
    echo "🚀 使用 'pnpm start' 启动生产服务器"
else
    echo "❌ 构建失败！"
    exit 1
fi
