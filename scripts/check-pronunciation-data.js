#!/usr/bin/env node

/**
 * 发音评测系统 - 数据诊断脚本
 * 检查所有表的数据完整性和准确性
 */

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://127.0.0.1:54321';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_SERVICE_KEY) {
  console.error('❌ 错误：未设置 SUPABASE_SERVICE_ROLE_KEY 环境变量');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function checkTable(tableName, checks) {
  console.log(`\n📋 检查表：${tableName}`);
  console.log('═'.repeat(60));

  for (const check of checks) {
    try {
      const result = await check.fn();
      const status = check.validate ? check.validate(result) : '✅';
      console.log(`${status} ${check.name}: ${JSON.stringify(result).slice(0, 100)}`);
    } catch (error) {
      console.log(`❌ ${check.name}: ${error.message}`);
    }
  }
}

async function main() {
  console.log('🔍 AI发音纠正系统 - 数据诊断\n');

  // 1. 检查 unit_catalog
  await checkTable('unit_catalog', [
    {
      name: '总记录数',
      fn: async () => {
        const { count } = await supabase.from('unit_catalog').select('*', { count: 'exact', head: true });
        return count;
      },
      validate: (count) => count > 0 ? '✅' : '❌ (应该有数据)',
    },
    {
      name: '中文音节数量',
      fn: async () => {
        const { count } = await supabase
          .from('unit_catalog')
          .select('*', { count: 'exact', head: true })
          .eq('lang', 'zh-CN');
        return count;
      },
      validate: (count) => count >= 100 ? '✅' : '⚠️ (预期 200+)',
    },
    {
      name: '前5个中文音节',
      fn: async () => {
        const { data } = await supabase
          .from('unit_catalog')
          .select('unit_id, symbol, unit_type')
          .eq('lang', 'zh-CN')
          .limit(5);
        return data?.map(d => d.symbol) || [];
      },
    },
  ]);

  // 2. 检查 zh_pinyin_units
  await checkTable('zh_pinyin_units', [
    {
      name: '总记录数',
      fn: async () => {
        const { count } = await supabase.from('zh_pinyin_units').select('*', { count: 'exact', head: true });
        return count;
      },
      validate: (count) => count > 0 ? '✅' : '❌ (应该有数据)',
    },
    {
      name: '示例数据',
      fn: async () => {
        const { data } = await supabase
          .from('zh_pinyin_units')
          .select('symbol, shengmu, yunmu, tone')
          .limit(3);
        return data || [];
      },
    },
  ]);

  // 3. 检查 pron_sentences
  await checkTable('pron_sentences', [
    {
      name: '总句子数',
      fn: async () => {
        const { count } = await supabase.from('pron_sentences').select('*', { count: 'exact', head: true });
        return count;
      },
      validate: (count) => count >= 25 ? '✅' : '⚠️ (预期 25句)',
    },
    {
      name: '按级别分布',
      fn: async () => {
        const { data } = await supabase
          .from('pron_sentences')
          .select('level')
          .eq('lang', 'zh-CN');
        const dist = {};
        data?.forEach(d => {
          dist[d.level] = (dist[d.level] || 0) + 1;
        });
        return dist;
      },
    },
    {
      name: '前3个句子',
      fn: async () => {
        const { data } = await supabase
          .from('pron_sentences')
          .select('sentence_id, text, level')
          .eq('lang', 'zh-CN')
          .limit(3);
        return data || [];
      },
    },
  ]);

  // 4. 检查 sentence_units
  await checkTable('sentence_units', [
    {
      name: '总记录数',
      fn: async () => {
        const { count } = await supabase.from('sentence_units').select('*', { count: 'exact', head: true });
        return count;
      },
      validate: (count) => count > 0 ? '✅' : '⚠️ (当前为空，推荐算法未完全激活)',
    },
  ]);

  // 5. 检查 user_pron_attempts
  await checkTable('user_pron_attempts', [
    {
      name: '总评测记录数',
      fn: async () => {
        const { count } = await supabase.from('user_pron_attempts').select('*', { count: 'exact', head: true });
        return count;
      },
    },
    {
      name: '按用户分组',
      fn: async () => {
        const { data } = await supabase.rpc('exec_sql', {
          sql: `SELECT user_id, COUNT(*) as cnt FROM user_pron_attempts GROUP BY user_id ORDER BY cnt DESC LIMIT 5`,
        }).catch(() => null);
        
        // 如果没有 exec_sql 函数，直接查询
        if (!data) {
          const { data: attempts } = await supabase.from('user_pron_attempts').select('user_id');
          const userCounts = {};
          attempts?.forEach(a => {
            userCounts[a.user_id] = (userCounts[a.user_id] || 0) + 1;
          });
          return Object.entries(userCounts).slice(0, 5);
        }
        return data;
      },
    },
    {
      name: '有效样本比例',
      fn: async () => {
        const { data: all } = await supabase.from('user_pron_attempts').select('valid_flag');
        if (!all || all.length === 0) return '无数据';
        const validCount = all.filter(a => a.valid_flag).length;
        return `${validCount}/${all.length} (${((validCount / all.length) * 100).toFixed(1)}%)`;
      },
    },
    {
      name: '最近5条记录',
      fn: async () => {
        const { data } = await supabase
          .from('user_pron_attempts')
          .select('sentence_id, pron_score, valid_flag, audio_path, created_at')
          .order('created_at', { ascending: false })
          .limit(5);
        return data?.map(d => `[${d.sentence_id}] ${d.pron_score?.toFixed(1)} (${d.valid_flag ? '有效' : '无效'})`) || [];
      },
    },
  ]);

  // 6. 检查 user_unit_stats
  await checkTable('user_unit_stats', [
    {
      name: '总统计记录数',
      fn: async () => {
        const { count } = await supabase.from('user_unit_stats').select('*', { count: 'exact', head: true });
        return count;
      },
    },
    {
      name: '前10个音节统计',
      fn: async () => {
        const { data } = await supabase
          .from('user_unit_stats')
          .select(`
            unit_id,
            n,
            mean,
            ci_low,
            ci_high,
            unit_catalog!inner(symbol)
          `)
          .eq('lang', 'zh-CN')
          .order('mean', { ascending: true })
          .limit(10);
        return data?.map(d => `${d.unit_catalog.symbol}: n=${d.n}, mean=${d.mean?.toFixed(1)}`) || [];
      },
    },
    {
      name: '检查 Welford 数据一致性',
      fn: async () => {
        const { data } = await supabase
          .from('user_unit_stats')
          .select('n, mean, m2, ci_low, ci_high')
          .limit(5);
        
        if (!data || data.length === 0) return '无数据';
        
        const issues = [];
        data.forEach((stat, idx) => {
          if (stat.n < 0) issues.push(`记录${idx}: n<0`);
          if (stat.n > 0 && stat.mean < 0) issues.push(`记录${idx}: mean<0`);
          if (stat.n > 0 && stat.m2 < 0) issues.push(`记录${idx}: m2<0`);
          if (stat.n >= 2 && stat.ci_low !== null && stat.ci_low > stat.mean) {
            issues.push(`记录${idx}: ci_low > mean`);
          }
          if (stat.n >= 2 && stat.ci_high !== null && stat.ci_high < stat.mean) {
            issues.push(`记录${idx}: ci_high < mean`);
          }
        });
        
        return issues.length > 0 ? issues : '✅ 数据一致';
      },
    },
  ]);

  // 7. 检查 Storage
  console.log(`\n📦 检查 Storage: pronunciation-audio`);
  console.log('═'.repeat(60));
  
  try {
    const { data: buckets } = await supabase.storage.listBuckets();
    const hasBucket = buckets?.some(b => b.id === 'pronunciation-audio');
    console.log(`${hasBucket ? '✅' : '❌'} Bucket 是否存在: ${hasBucket}`);
    
    if (hasBucket) {
      const { data: files } = await supabase.storage.from('pronunciation-audio').list('', { limit: 100 });
      console.log(`✅ 音频文件数量: ${files?.length || 0}`);
      
      if (files && files.length > 0) {
        console.log(`✅ 示例文件: ${files.slice(0, 3).map(f => f.name).join(', ')}`);
      }
    }
  } catch (error) {
    console.log(`❌ Storage 检查失败: ${error.message}`);
  }

  // 8. 交叉验证
  console.log(`\n🔗 交叉验证`);
  console.log('═'.repeat(60));
  
  // 检查 attempts 中的 audio_path 是否都存在于 Storage
  try {
    const { data: attempts } = await supabase
      .from('user_pron_attempts')
      .select('audio_path')
      .not('audio_path', 'is', null)
      .limit(10);
    
    if (attempts && attempts.length > 0) {
      console.log(`✅ 有 ${attempts.length} 条记录包含 audio_path`);
      
      // 抽查前3个是否存在
      for (const attempt of attempts.slice(0, 3)) {
        try {
          const { data } = await supabase.storage
            .from('pronunciation-audio')
            .list(attempt.audio_path.split('/')[0], { limit: 1 });
          console.log(`  ${data ? '✅' : '❌'} ${attempt.audio_path.slice(0, 50)}...`);
        } catch (err) {
          console.log(`  ❌ ${attempt.audio_path}: ${err.message}`);
        }
      }
    } else {
      console.log(`⚠️ 暂无音频记录`);
    }
  } catch (error) {
    console.log(`❌ 交叉验证失败: ${error.message}`);
  }

  console.log('\n' + '═'.repeat(60));
  console.log('✅ 诊断完成！');
  console.log('\n💡 如果发现问题，请将输出结果发给开发人员分析。');
}

main().catch((error) => {
  console.error('❌ 脚本执行失败:', error);
  process.exit(1);
});

