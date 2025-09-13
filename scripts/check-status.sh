#!/bin/bash
# 项目状态检查脚本

echo "🔍 Lang Trainer 项目状态检查"
echo "================================"

# 检查 Node.js
echo -n "Node.js: "
if command -v node &> /dev/null; then
    echo "✅ $(node --version)"
else
    echo "❌ 未安装"
fi

# 检查 pnpm
echo -n "pnpm: "
if command -v pnpm &> /dev/null; then
    echo "✅ $(pnpm --version)"
else
    echo "❌ 未安装"
fi

# 检查环境变量文件
echo -n "环境变量文件: "
if [ -f ".env.local" ]; then
    echo "✅ 存在"
    
    # 检查关键环境变量
    echo "  环境变量检查:"
    if grep -q "your-project.supabase.co" .env.local; then
        echo "    ❌ Supabase URL 未配置"
    else
        echo "    ✅ Supabase URL 已配置"
    fi
    
    if grep -q "your_anon_key_here" .env.local; then
        echo "    ❌ Supabase Anon Key 未配置"
    else
        echo "    ✅ Supabase Anon Key 已配置"
    fi
    
    if grep -q "your_service_role_key_here" .env.local; then
        echo "    ❌ Supabase Service Role Key 未配置"
    else
        echo "    ✅ Supabase Service Role Key 已配置"
    fi
else
    echo "❌ 不存在"
fi

# 检查依赖
echo -n "项目依赖: "
if [ -d "node_modules" ]; then
    echo "✅ 已安装"
else
    echo "❌ 未安装"
fi

# 检查构建状态
echo -n "构建状态: "
if [ -d ".next" ]; then
    echo "✅ 已构建"
else
    echo "❌ 未构建"
fi

# 检查端口占用
echo -n "端口 3000: "
if lsof -Pi :3000 -sTCP:LISTEN -t >/dev/null 2>&1; then
    echo "❌ 被占用"
else
    echo "✅ 可用"
fi

echo ""
echo "📋 建议操作:"
if [ ! -f ".env.local" ]; then
    echo "  - 运行 'pnpm setup' 进行项目初始化"
elif grep -q "your-project.supabase.co" .env.local; then
    echo "  - 配置 .env.local 文件中的环境变量"
elif [ ! -d "node_modules" ]; then
    echo "  - 运行 'pnpm install' 安装依赖"
elif [ ! -d ".next" ]; then
    echo "  - 运行 'pnpm dev' 启动开发服务器"
else
    echo "  - 项目状态良好，可以开始开发！"
fi
