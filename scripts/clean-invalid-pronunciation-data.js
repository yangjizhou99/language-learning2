#!/usr/bin/env node

/**
 * 清理无效的发音评测数据
 * - 删除 mean=0 的统计记录
 * - 删除汉字词（非拼音）的 Unit
 */

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://127.0.0.1:54321';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_SERVICE_KEY) {
  console.error('❌ 错误：未设置 SUPABASE_SERVICE_ROLE_KEY 环境变量');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function main() {
  console.log('🧹 清理无效的发音评测数据\n');

  // 1. 删除 mean=0 的统计记录
  console.log('1️⃣ 删除 mean=0 的统计记录...');
  const { data: zeroStats, error: e1 } = await supabase
    .from('user_unit_stats')
    .delete()
    .eq('mean', 0)
    .select('unit_id');
  
  console.log(`   ✅ 已删除 ${zeroStats?.length || 0} 条统计记录\n`);

  // 2. 查找汉字 Unit（symbol 包含中文字符）
  console.log('2️⃣ 查找汉字 Unit（非拼音）...');
  const { data: allUnits } = await supabase
    .from('unit_catalog')
    .select('unit_id, symbol, unit_type')
    .eq('lang', 'zh-CN');

  const chineseCharUnits = (allUnits || []).filter(u => {
    // 判断是否包含中文字符（而不是拼音）
    return /[\u4e00-\u9fa5]/.test(u.symbol);
  });

  console.log(`   找到 ${chineseCharUnits.length} 个汉字 Unit:`);
  chineseCharUnits.forEach(u => {
    console.log(`   - ${u.symbol} (unit_id: ${u.unit_id})`);
  });

  if (chineseCharUnits.length > 0) {
    console.log('\n3️⃣ 删除汉字 Unit（这些应该是拼音而不是汉字）...');
    const unitIds = chineseCharUnits.map(u => u.unit_id);
    
    // 先删除关联的统计记录
    const { data: deletedStats } = await supabase
      .from('user_unit_stats')
      .delete()
      .in('unit_id', unitIds)
      .select('unit_id');
    console.log(`   ✅ 已删除 ${deletedStats?.length || 0} 条关联统计记录`);

    // 再删除 Unit 本身
    const { data: deletedUnits } = await supabase
      .from('unit_catalog')
      .delete()
      .in('unit_id', unitIds)
      .select('unit_id');
    console.log(`   ✅ 已删除 ${deletedUnits?.length || 0} 个汉字 Unit\n`);
  }

  // 4. 统计清理结果
  console.log('4️⃣ 清理后的数据统计...');
  const { count: unitCount } = await supabase
    .from('unit_catalog')
    .select('*', { count: 'exact', head: true })
    .eq('lang', 'zh-CN');
  console.log(`   ✅ unit_catalog (zh-CN): ${unitCount} 条`);

  const { count: statsCount } = await supabase
    .from('user_unit_stats')
    .select('*', { count: 'exact', head: true })
    .eq('lang', 'zh-CN');
  console.log(`   ✅ user_unit_stats (zh-CN): ${statsCount} 条`);

  const { data: zeroCheck } = await supabase
    .from('user_unit_stats')
    .select('mean')
    .eq('mean', 0);
  console.log(`   ${zeroCheck?.length === 0 ? '✅' : '⚠️'} mean=0 的记录数: ${zeroCheck?.length || 0}`);

  console.log('\n' + '═'.repeat(60));
  console.log('✅ 清理完成！');
  console.log('\n💡 从现在开始，新的录音会使用修复后的 parser，不会再产生垃圾数据。');
}

main().catch((error) => {
  console.error('❌ 脚本执行失败:', error);
  process.exit(1);
});

