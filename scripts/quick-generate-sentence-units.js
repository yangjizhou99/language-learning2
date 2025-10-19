#!/usr/bin/env node

/**
 * 快速生成 sentence_units 数据
 * 直接读取环境变量或使用默认值
 */

const { createClient } = require('@supabase/supabase-js');
const pinyin = require('pinyin');

// 从环境变量或使用默认值
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://127.0.0.1:54321';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_SERVICE_KEY) {
  console.log('\n⚠️  未检测到 SUPABASE_SERVICE_ROLE_KEY 环境变量');
  console.log('');
  console.log('请运行以下命令之一：');
  console.log('');
  console.log('选项 1 - 使用本地 Supabase (开发环境):');
  console.log('  $env:SUPABASE_SERVICE_ROLE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU"; node scripts/quick-generate-sentence-units.js');
  console.log('');
  console.log('选项 2 - 使用生产环境（请替换为实际密钥）:');
  console.log('  $env:SUPABASE_SERVICE_ROLE_KEY="你的实际密钥"; node scripts/quick-generate-sentence-units.js');
  console.log('');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

console.log('📍 连接到:', SUPABASE_URL);
console.log('');

// 拼音转换为带空格格式
function normalizePinyin(py) {
  const match = py.match(/^([a-z]+)([1-5])$/);
  if (match) {
    return `${match[1]} ${match[2]}`;
  }
  return py;
}

// 提取句子中的拼音音节
async function extractPinyinFromSentence(text) {
  const result = pinyin(text, {
    style: pinyin.STYLE_TONE2,
    heteronym: false,
    segment: true,
  });

  const pinyinList = result.map(item => {
    if (item && item[0]) {
      return normalizePinyin(item[0].toLowerCase());
    }
    return null;
  }).filter(Boolean);

  const countMap = new Map();
  for (const py of pinyinList) {
    countMap.set(py, (countMap.get(py) || 0) + 1);
  }

  return countMap;
}

async function main() {
  console.log('🚀 开始生成 sentence_units 数据\n');

  // 1. 清理旧数据
  console.log('🧹 清理旧数据...');
  const { error: deleteError } = await supabase
    .from('sentence_units')
    .delete()
    .neq('sentence_id', 0);

  if (deleteError) {
    console.log('   ⚠️  清理失败（可能表为空）:', deleteError.message);
  } else {
    console.log('   ✅ 清理完成');
  }

  // 2. 获取所有句子
  console.log('\n📚 加载句子列表...');
  const { data: sentences, error: sentencesError } = await supabase
    .from('pron_sentences')
    .select('sentence_id, text, lang')
    .eq('lang', 'zh-CN')
    .order('sentence_id');

  if (sentencesError) {
    console.error('❌ 加载句子失败:', sentencesError.message);
    process.exit(1);
  }

  console.log(`   找到 ${sentences.length} 个中文句子`);

  // 3. 预加载所有音节
  console.log('\n📖 加载音节字典...');
  const { data: units, error: unitsError } = await supabase
    .from('unit_catalog')
    .select('unit_id, symbol')
    .eq('lang', 'zh-CN');

  if (unitsError) {
    console.error('❌ 加载音节失败:', unitsError.message);
    process.exit(1);
  }

  const unitIdMap = new Map();
  for (const unit of units || []) {
    unitIdMap.set(unit.symbol, unit.unit_id);
  }

  console.log(`   加载了 ${unitIdMap.size} 个音节`);

  // 4. 逐句处理
  console.log('\n⚙️  开始处理句子...');
  console.log('═'.repeat(60));

  let totalFound = 0;
  let totalNotFound = 0;
  let successCount = 0;

  for (const sentence of sentences) {
    console.log(`\n📝 处理句子 ${sentence.sentence_id}: "${sentence.text}"`);

    const pinyinMap = await extractPinyinFromSentence(sentence.text);
    console.log(`   提取到 ${pinyinMap.size} 个不同的音节`);

    const insertData = [];
    let foundCount = 0;
    let notFoundCount = 0;

    for (const [symbol, count] of pinyinMap.entries()) {
      const unitId = unitIdMap.get(symbol);
      
      if (unitId) {
        insertData.push({
          sentence_id: sentence.sentence_id,
          unit_id: unitId,
          count: count,
        });
        foundCount++;
      } else {
        console.log(`   ⚠️  未找到音节：${symbol}`);
        notFoundCount++;
      }
    }

    if (insertData.length > 0) {
      const { error } = await supabase
        .from('sentence_units')
        .upsert(insertData, {
          onConflict: 'sentence_id,unit_id',
          ignoreDuplicates: false,
        });

      if (error) {
        console.error(`   ❌ 插入失败:`, error.message);
      } else {
        console.log(`   ✅ 成功插入 ${insertData.length} 条关联记录`);
        successCount++;
        totalFound += foundCount;
        totalNotFound += notFoundCount;
      }
    }
  }

  // 5. 统计结果
  console.log('\n═'.repeat(60));
  console.log('📊 生成完成！统计结果：');
  console.log('═'.repeat(60));
  console.log(`✅ 成功处理句子：${successCount} / ${sentences.length}`);
  console.log(`✅ 找到的音节：${totalFound}`);
  console.log(`⚠️  未找到的音节：${totalNotFound}`);

  const { count: finalCount } = await supabase
    .from('sentence_units')
    .select('*', { count: 'exact', head: true });

  console.log(`\n📈 sentence_units 表总记录数：${finalCount}`);

  if (finalCount && sentences.length > 0) {
    const avgPerSentence = finalCount / sentences.length;
    console.log(`📊 平均每句覆盖：${avgPerSentence.toFixed(1)} 个音节`);

    if (avgPerSentence >= 8) {
      console.log('🎉 目标达成！平均覆盖 ≥ 8 个音节/句');
    }
  }

  // 6. 显示一些示例
  console.log('\n📋 示例关联（前5条）:');
  const { data: samples } = await supabase
    .from('sentence_units')
    .select(`
      sentence_id,
      count,
      unit_catalog!inner(symbol),
      pron_sentences!inner(text)
    `)
    .limit(5);

  if (samples) {
    for (const sample of samples) {
      console.log(`   句子 ${sample.sentence_id}: "${sample.pron_sentences.text}" → ${sample.unit_catalog.symbol} (${sample.count}次)`);
    }
  }

  console.log('\n✨ 全部完成！');
  console.log('');
  console.log('现在刷新发音验证页面，应该能看到正确的验证句子了。');
}

main().catch(error => {
  console.error('\n💥 脚本执行出错:', error);
  process.exit(1);
});

