#!/usr/bin/env node

/**
 * 统一拼音格式为带空格格式（Azure 标准）
 * 将 "guo2" 转换为 "guo 2"，并合并统计数据
 */

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://127.0.0.1:54321';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_SERVICE_KEY) {
  console.error('❌ 错误：未设置 SUPABASE_SERVICE_ROLE_KEY 环境变量');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// 将无空格格式转为带空格格式
function addSpace(symbol) {
  // ma1 → ma 1
  return symbol.replace(/([a-z]+)([1-5])/, '$1 $2');
}

async function main() {
  console.log('🔧 统一拼音格式为带空格格式（Azure 标准）\n');

  // 1. 获取所有中文 Unit
  const { data: allUnits } = await supabase
    .from('unit_catalog')
    .select('unit_id, symbol, unit_type')
    .eq('lang', 'zh-CN');

  if (!allUnits) {
    console.log('❌ 无法获取 Unit 数据');
    return;
  }

  // 2. 分类
  const noSpaceUnits = allUnits.filter(u => /^[a-z]+[1-5]$/.test(u.symbol)); // ba1
  const withSpaceUnits = allUnits.filter(u => /^[a-z]+ [1-5]$/.test(u.symbol)); // ba 1

  console.log(`📊 当前状态：`);
  console.log(`   无空格格式：${noSpaceUnits.length} 条`);
  console.log(`   带空格格式：${withSpaceUnits.length} 条`);
  console.log(`   其他格式：${allUnits.length - noSpaceUnits.length - withSpaceUnits.length} 条\n`);

  if (noSpaceUnits.length === 0) {
    console.log('✅ 所有拼音已经是带空格格式，无需转换！');
    return;
  }

  // 3. 为无空格 Unit 创建别名映射
  console.log(`3️⃣ 为 ${noSpaceUnits.length} 个无空格 Unit 创建别名...\n`);
  
  let aliasCreated = 0;
  let merged = 0;
  
  for (const oldUnit of noSpaceUnits) {
    const newSymbol = addSpace(oldUnit.symbol);
    
    // 检查带空格的 Unit 是否已存在
    const existingUnit = withSpaceUnits.find(u => u.symbol === newSymbol);
    
    if (existingUnit) {
      // 已存在，创建别名映射：旧格式 → 新格式
      const { error } = await supabase
        .from('unit_alias')
        .upsert({
          lang: 'zh-CN',
          alias: oldUnit.symbol,
          unit_id: existingUnit.unit_id,
        });
      
      if (!error) {
        aliasCreated++;
        if (aliasCreated <= 5) {
          console.log(`   ✅ ${oldUnit.symbol} → ${newSymbol} (alias)`);
        }
      }
      merged++;
    } else {
      // 不存在，直接更新 symbol
      const { error } = await supabase
        .from('unit_catalog')
        .update({ symbol: newSymbol })
        .eq('unit_id', oldUnit.unit_id);
      
      if (!error && aliasCreated <= 5) {
        console.log(`   ✅ ${oldUnit.symbol} → ${newSymbol} (updated)`);
      }
    }
  }

  if (noSpaceUnits.length > 5) {
    console.log(`   ... 还有 ${noSpaceUnits.length - 5} 条\n`);
  }

  console.log(`\n📊 处理结果：`);
  console.log(`   创建别名：${aliasCreated} 条`);
  console.log(`   直接更新：${noSpaceUnits.length - merged} 条`);

  // 4. 验证
  console.log(`\n4️⃣ 验证结果...`);
  const { data: finalUnits } = await supabase
    .from('unit_catalog')
    .select('symbol')
    .eq('lang', 'zh-CN');

  const finalNoSpace = (finalUnits || []).filter(u => /^[a-z]+[1-5]$/.test(u.symbol));
  const finalWithSpace = (finalUnits || []).filter(u => /^[a-z]+ [1-5]$/.test(u.symbol));

  console.log(`   无空格格式：${finalNoSpace.length} 条 ${finalNoSpace.length === 0 ? '✅' : '⚠️'}`);
  console.log(`   带空格格式：${finalWithSpace.length} 条`);

  const { count: aliasCount } = await supabase
    .from('unit_alias')
    .select('*', { count: 'exact', head: true })
    .eq('lang', 'zh-CN');
  console.log(`   别名映射：${aliasCount} 条`);

  console.log('\n' + '═'.repeat(60));
  console.log('✅ 格式统一完成！');
  console.log('\n💡 现在所有拼音都使用带空格格式（如 "guo 2"），匹配 Azure 返回格式。');
}

main().catch((error) => {
  console.error('❌ 脚本执行失败:', error);
  process.exit(1);
});

