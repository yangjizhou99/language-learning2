#!/bin/bash
# 项目初始化设置脚本

echo "🔧 Lang Trainer 项目初始化设置..."

# 检查 Node.js
if ! command -v node &> /dev/null; then
    echo "❌ 请先安装 Node.js (版本 20+)"
    echo "下载地址: https://nodejs.org/"
    exit 1
fi

node_version=$(node --version)
echo "✅ Node.js 版本: $node_version"

# 安装 pnpm
if ! command -v pnpm &> /dev/null; then
    echo "📦 安装 pnpm..."
    npm install -g pnpm
else
    echo "✅ pnpm 已安装: $(pnpm --version)"
fi

# 安装依赖
echo "📦 安装项目依赖..."
pnpm install

# 检查环境变量文件
if [ ! -f ".env.local" ]; then
    echo "⚠️ 未找到 .env.local 文件"
    echo "📝 创建环境变量模板..."
    cp env.example .env.local
    echo "✅ 已创建 .env.local 文件"
    echo "📖 请编辑 .env.local 文件并配置您的环境变量"
    echo "📚 参考文档: docs/setup/ENVIRONMENT_VARIABLES_GUIDE.md"
else
    echo "✅ 环境变量文件已存在"
fi

# 检查 Supabase 配置
if grep -q "your-project.supabase.co" .env.local; then
    echo "⚠️ 请配置 Supabase 环境变量"
    echo "📚 参考文档: docs/setup/ENVIRONMENT_VARIABLES_GUIDE.md"
fi

echo ""
echo "🎉 项目设置完成！"
echo ""
echo "下一步操作："
echo "1. 编辑 .env.local 文件配置环境变量"
echo "2. 运行 'pnpm dev' 启动开发服务器"
echo "3. 访问 http://localhost:3000 查看应用"
echo ""
echo "📚 更多信息请查看 docs/ 目录"
