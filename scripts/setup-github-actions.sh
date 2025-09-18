#!/bin/bash

# GitHub Actions 快速设置脚本
# 用于帮助用户快速配置 GitHub Actions 自动化部署

echo "🚀 GitHub Actions 自动化部署设置脚本"
echo "======================================"
echo ""

# 检查是否在正确的目录
if [ ! -f "supabase/config.toml" ]; then
    echo "❌ 错误: 请在项目根目录运行此脚本"
    exit 1
fi

echo "✅ 检测到 Supabase 项目配置"
echo ""

# 检查 Supabase CLI
echo "🔧 检查 Supabase CLI..."
if command -v supabase &> /dev/null; then
    echo "✅ Supabase CLI 已安装"
    supabase --version
else
    echo "❌ Supabase CLI 未安装"
    echo "请先安装: npm install -g supabase"
    exit 1
fi

echo ""

# 检查 GitHub CLI
echo "🔧 检查 GitHub CLI..."
if command -v gh &> /dev/null; then
    echo "✅ GitHub CLI 已安装"
    gh --version | head -1
else
    echo "⚠️ GitHub CLI 未安装 (可选，用于自动设置 Secrets)"
    echo "安装方法: https://cli.github.com/"
fi

echo ""

# 显示需要设置的 Secrets
echo "📋 需要在 GitHub 仓库中设置以下 Secrets（安全默认策略）:"
echo ""
echo "1. SUPABASE_ACCESS_TOKEN"
echo "   - 获取方式: Supabase Dashboard → Account → Access Tokens"
echo "   - 用途: 用于 GitHub Actions 访问 Supabase API"
echo ""
echo "2. STAGING_PROJECT_ID"
echo "   - 获取方式: Supabase Dashboard → Staging 项目 → Settings → General"
echo "   - 用途: Staging 环境项目标识符"
echo ""
echo "3. STAGING_DB_PASSWORD"
echo "   - 获取方式: Supabase Dashboard → Staging 项目 → Settings → Database"
echo "   - 用途: Staging 环境数据库密码"
echo ""
echo "🔒 安全策略说明:"
echo "   - 仅自动部署到 Staging 环境"
echo "   - Production 环境手动部署（supabase link && supabase db push）"
echo "   - 避免 CI 误操作生产环境"
echo ""

# 提供设置 Secrets 的选项
if command -v gh &> /dev/null; then
    echo "🔧 是否要使用 GitHub CLI 设置 Secrets? (y/n)"
    read -r response
    if [[ "$response" =~ ^[Yy]$ ]]; then
        echo ""
        echo "请按顺序输入以下值:"
        echo ""
        
        read -p "SUPABASE_ACCESS_TOKEN: " access_token
        read -p "STAGING_PROJECT_ID: " staging_project_id
        read -p "STAGING_DB_PASSWORD: " staging_db_password
        
        echo ""
        echo "正在设置 GitHub Secrets..."
        
        gh secret set SUPABASE_ACCESS_TOKEN --body "$access_token"
        gh secret set STAGING_PROJECT_ID --body "$staging_project_id"
        gh secret set STAGING_DB_PASSWORD --body "$staging_db_password"
        
        echo "✅ GitHub Secrets 设置完成!"
    fi
else
    echo "📝 手动设置 GitHub Secrets:"
    echo "1. 进入 GitHub 仓库"
    echo "2. 点击 Settings → Secrets and variables → Actions"
    echo "3. 点击 'New repository secret' 添加上述 3 个变量"
fi

echo ""
echo "🧪 测试本地环境..."
if supabase db start &> /dev/null; then
    echo "✅ Supabase 本地环境启动成功"
    echo "正在测试迁移..."
    if supabase db reset &> /dev/null; then
        echo "✅ 数据库迁移测试成功"
    else
        echo "❌ 数据库迁移测试失败"
    fi
    supabase db stop &> /dev/null
else
    echo "❌ Supabase 本地环境启动失败"
fi

echo ""
echo "📚 下一步操作:"
echo "1. 确保所有 GitHub Secrets 已正确设置"
echo "2. 创建功能分支进行开发"
echo "3. 创建 PR 到 develop 分支触发 CI 验证"
echo "4. 合并到 develop 分支触发 Staging 部署"
echo "5. 合并到 main 分支后，手动部署到 Production:"
echo "   supabase link --project-ref YOUR_PROD_PROJECT_ID"
echo "   supabase db push"
echo ""
echo "📖 详细文档: GITHUB_ACTIONS_SETUP_GUIDE.md"
echo ""
echo "✨ 设置完成！"
