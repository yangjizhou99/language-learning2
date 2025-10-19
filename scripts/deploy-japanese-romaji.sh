#!/bin/bash

# =====================================================
# 日语罗马音系统一键部署脚本
# 用于生产环境快速部署
# =====================================================

set -e  # 遇到错误立即退出

echo "🚀 开始日语罗马音系统部署..."

# 检查环境变量
if [ -z "$NEXT_PUBLIC_SUPABASE_URL" ] || [ -z "$SUPABASE_SERVICE_ROLE_KEY" ]; then
    echo "❌ 缺少必要的环境变量"
    echo "请设置: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY"
    exit 1
fi

# 检查Node.js环境
if ! command -v node &> /dev/null; then
    echo "❌ Node.js 未安装"
    exit 1
fi

# 检查npm依赖
if [ ! -d "node_modules" ]; then
    echo "📦 安装依赖..."
    npm install
fi

echo "✅ 环境检查通过"

# 1. 数据库迁移
echo ""
echo "🗄️  执行数据库迁移..."
if command -v supabase &> /dev/null; then
    echo "使用 Supabase CLI 执行迁移..."
    supabase db push
else
    echo "⚠️  Supabase CLI 未安装，请手动执行迁移文件："
    echo "   supabase/migrations/20250120000002_update_japanese_to_romaji.sql"
    read -p "按 Enter 继续（迁移完成后）..."
fi

# 2. 验证迁移
echo ""
echo "🔍 验证数据库迁移..."
node -e "
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function verifyMigration() {
  const { data, error } = await supabase
    .from('unit_catalog')
    .select('symbol')
    .eq('lang', 'ja-JP');
  
  if (error) {
    console.error('❌ 验证失败:', error.message);
    process.exit(1);
  }
  
  if (!data || data.length !== 104) {
    console.error('❌ 迁移不完整：期望104个罗马字音节，实际', data?.length || 0, '个');
    process.exit(1);
  }
  
  console.log('✅ 数据库迁移验证成功：', data.length, '个罗马字音节');
}

verifyMigration().catch(console.error);
"

# 3. 重新生成数据
echo ""
echo "📊 重新生成句节关联和用户统计..."
node scripts/production-deploy-japanese-romaji.js

# 4. 最终验证
echo ""
echo "🔍 最终验证..."
node -e "
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function finalVerification() {
  console.log('检查关键数据...');
  
  // 检查罗马字音节
  const { data: units, error: unitsError } = await supabase
    .from('unit_catalog')
    .select('symbol')
    .eq('lang', 'ja-JP');
  
  if (unitsError) throw unitsError;
  console.log('✅ 罗马字音节:', units.length, '个');
  
  // 检查句节关联
  const { data: associations, error: assocError } = await supabase
    .from('sentence_units')
    .select('sentence_id')
    .in('sentence_id', 
      await supabase.from('pron_sentences').select('sentence_id').eq('lang', 'ja-JP').then(r => r.data?.map(s => s.sentence_id) || [])
    );
  
  if (assocError) throw assocError;
  console.log('✅ 句节关联:', associations.length, '个');
  
  // 检查用户统计
  const { data: stats, error: statsError } = await supabase
    .from('user_unit_stats')
    .select('unit_id')
    .eq('lang', 'ja-JP');
  
  if (statsError) throw statsError;
  console.log('✅ 用户统计:', stats.length, '条');
  
  console.log('');
  console.log('🎉 日语罗马音系统部署完成！');
  console.log('📊 部署统计:');
  console.log('  - 罗马字音节:', units.length, '个');
  console.log('  - 句节关联:', associations.length, '个');
  console.log('  - 用户统计:', stats.length, '条');
}

finalVerification().catch(console.error);
"

echo ""
echo "✅ 部署完成！"
echo ""
echo "📋 后续步骤："
echo "1. 测试管理界面句节关联功能"
echo "2. 测试个人画像页面罗马音显示"
echo "3. 测试日语句子生成功能"
echo "4. 监控系统性能"
echo ""
echo "📖 详细文档：docs/deployment/日语罗马音系统生产环境部署指南.md"
