#!/usr/bin/env node

/**
 * 发音评测系统 - sentence_units 数据生成脚本
 * 使用 pinyin 库自动生成句子与音节的关联
 * 目标：覆盖率从 40% 提升到 80%+
 */

const { createClient } = require('@supabase/supabase-js');
const pinyin = require('pinyin');

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://127.0.0.1:54321';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_SERVICE_KEY) {
  console.error('❌ 错误：未设置 SUPABASE_SERVICE_ROLE_KEY 环境变量');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// 拼音转换为带空格格式（如 "guo2" -> "guo 2"）
function normalizePinyin(py) {
  // 匹配拼音字母部分和数字部分
  const match = py.match(/^([a-z]+)([1-5])$/);
  if (match) {
    return `${match[1]} ${match[2]}`;
  }
  return py;
}

// 提取句子中的拼音音节
async function extractPinyinFromSentence(text) {
  // 使用 pinyin 库，返回带声调数字的拼音
  const result = pinyin(text, {
    style: pinyin.STYLE_TONE2, // 返回如 "guo2" 的格式
    heteronym: false, // 不返回多音字
    segment: true, // 开启分词
  });

  // result 是一个二维数组，每个汉字对应一个数组
  const pinyinList = result.map(item => {
    if (item && item[0]) {
      // 转换为带空格格式
      return normalizePinyin(item[0].toLowerCase());
    }
    return null;
  }).filter(Boolean);

  // 统计每个音节出现的次数
  const countMap = new Map();
  for (const py of pinyinList) {
    countMap.set(py, (countMap.get(py) || 0) + 1);
  }

  return countMap;
}

// 查找音节对应的 unit_id
async function findUnitId(symbol) {
  const { data, error } = await supabase
    .from('unit_catalog')
    .select('unit_id')
    .eq('lang', 'zh-CN')
    .eq('symbol', symbol)
    .maybeSingle();

  if (error) {
    console.error(`查询 unit_id 失败 (${symbol}):`, error.message);
    return null;
  }

  return data?.unit_id || null;
}

// 批量查找 unit_id（优化性能）
async function batchFindUnitIds(symbols) {
  const { data, error } = await supabase
    .from('unit_catalog')
    .select('unit_id, symbol')
    .eq('lang', 'zh-CN')
    .in('symbol', symbols);

  if (error) {
    console.error('批量查询 unit_id 失败:', error.message);
    return new Map();
  }

  const map = new Map();
  for (const row of data || []) {
    map.set(row.symbol, row.unit_id);
  }

  return map;
}

// 生成单个句子的 sentence_units
async function generateForSentence(sentence, unitIdMap) {
  console.log(`\n📝 处理句子 ${sentence.sentence_id}: "${sentence.text}"`);

  // 提取拼音
  const pinyinMap = await extractPinyinFromSentence(sentence.text);
  console.log(`   提取到 ${pinyinMap.size} 个不同的音节`);

  // 准备插入数据
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

  // 批量插入（使用 upsert 避免重复）
  if (insertData.length > 0) {
    const { error } = await supabase
      .from('sentence_units')
      .upsert(insertData, {
        onConflict: 'sentence_id,unit_id',
        ignoreDuplicates: false,
      });

    if (error) {
      console.error(`   ❌ 插入失败:`, error.message);
      return { success: false, found: 0, notFound: 0 };
    }

    console.log(`   ✅ 成功插入 ${insertData.length} 条关联记录`);
  }

  return { success: true, found: foundCount, notFound: notFoundCount };
}

// 主函数
async function main() {
  console.log('🚀 开始生成 sentence_units 数据\n');
  console.log('═'.repeat(60));

  // 1. 获取所有句子
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

  // 2. 预加载所有 unit_catalog（中文音节）
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

  // 3. 清理旧数据（可选）
  const shouldClean = process.argv.includes('--clean');
  if (shouldClean) {
    console.log('\n🧹 清理旧的 sentence_units 数据...');
    const { error: deleteError } = await supabase
      .from('sentence_units')
      .delete()
      .neq('sentence_id', 0); // 删除所有

    if (deleteError) {
      console.error('❌ 清理失败:', deleteError.message);
    } else {
      console.log('   ✅ 清理完成');
    }
  }

  // 4. 逐句处理
  console.log('\n⚙️  开始处理句子...');
  console.log('═'.repeat(60));

  let totalFound = 0;
  let totalNotFound = 0;
  let successCount = 0;

  for (const sentence of sentences) {
    const result = await generateForSentence(sentence, unitIdMap);
    
    if (result.success) {
      successCount++;
      totalFound += result.found;
      totalNotFound += result.notFound;
    }

    // 稍作延迟，避免请求过快
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  // 5. 统计结果
  console.log('\n═'.repeat(60));
  console.log('📊 生成完成！统计结果：');
  console.log('═'.repeat(60));
  console.log(`✅ 成功处理句子：${successCount} / ${sentences.length}`);
  console.log(`✅ 找到的音节：${totalFound}`);
  console.log(`⚠️  未找到的音节：${totalNotFound}`);

  // 6. 查询最终数据量
  const { count: finalCount } = await supabase
    .from('sentence_units')
    .select('*', { count: 'exact', head: true });

  console.log(`\n📈 sentence_units 表总记录数：${finalCount}`);

  // 7. 计算覆盖率
  if (finalCount && sentences.length > 0) {
    const avgPerSentence = finalCount / sentences.length;
    console.log(`📊 平均每句覆盖：${avgPerSentence.toFixed(1)} 个音节`);

    if (avgPerSentence >= 8) {
      console.log('🎉 目标达成！平均覆盖 ≥ 8 个音节/句');
    } else {
      console.log('⚠️  覆盖率略低，建议检查拼音转换逻辑或扩充音节库');
    }
  }

  // 8. 显示一些示例
  console.log('\n📋 示例关联（前10条）:');
  const { data: samples } = await supabase
    .from('sentence_units')
    .select(`
      sentence_id,
      count,
      unit_catalog!inner(symbol),
      pron_sentences!inner(text)
    `)
    .limit(10);

  if (samples) {
    for (const sample of samples) {
      console.log(`   句子 ${sample.sentence_id}: "${sample.pron_sentences.text.slice(0, 20)}..." → ${sample.unit_catalog.symbol} (${sample.count}次)`);
    }
  }

  console.log('\n✨ 全部完成！');
}

main().catch(error => {
  console.error('\n💥 脚本执行出错:', error);
  process.exit(1);
});

