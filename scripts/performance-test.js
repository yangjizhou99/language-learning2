#!/usr/bin/env node

/**
 * 性能测试脚本
 * 用于测试数据库索引优化后的性能提升
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// 配置
const config = {
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
  supabaseKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
  testRounds: 5, // 测试轮数
  warmupRounds: 2, // 预热轮数
};

if (!config.supabaseUrl || !config.supabaseKey) {
  console.error('❌ 请设置环境变量:');
  console.error('NEXT_PUBLIC_SUPABASE_URL');
  console.error('SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(config.supabaseUrl, config.supabaseKey);

// 测试用例
const testCases = [
  {
    name: 'Shadowing题目查询 (lang + level)',
    query: async () => {
      const { data, error } = await supabase
        .from('shadowing_items')
        .select('*')
        .eq('lang', 'en')
        .eq('level', 2)
        .order('created_at', { ascending: false })
        .limit(10);
      if (error) throw error;
      return data;
    }
  },
  {
    name: 'Cloze题目查询 (lang + level)',
    query: async () => {
      const { data, error } = await supabase
        .from('cloze_items')
        .select('*')
        .eq('lang', 'en')
        .eq('level', 2)
        .order('created_at', { ascending: false })
        .limit(10);
      if (error) throw error;
      return data;
    }
  },
  {
    name: '用户练习记录查询',
    query: async () => {
      const { data, error } = await supabase
        .from('shadowing_attempts')
        .select('*')
        .eq('lang', 'en')
        .order('created_at', { ascending: false })
        .limit(20);
      if (error) throw error;
      return data;
    }
  },
  {
    name: '词汇表全文搜索',
    query: async () => {
      const { data, error } = await supabase
        .from('vocab_entries')
        .select('*')
        .textSearch('term', 'learn')
        .limit(10);
      if (error) throw error;
      return data;
    }
  },
  {
    name: '文章草稿状态查询',
    query: async () => {
      const { data, error } = await supabase
        .from('article_drafts')
        .select('*')
        .eq('status', 'approved')
        .order('created_at', { ascending: false })
        .limit(10);
      if (error) throw error;
      return data;
    }
  }
];

// 性能测试函数
async function runPerformanceTest() {
  console.log('🚀 开始性能测试...\n');
  
  const results = [];
  
  for (const testCase of testCases) {
    console.log(`📊 测试: ${testCase.name}`);
    
    // 预热
    for (let i = 0; i < config.warmupRounds; i++) {
      try {
        await testCase.query();
      } catch (error) {
        console.log(`⚠️  预热轮次 ${i + 1} 失败: ${error.message}`);
      }
    }
    
    // 正式测试
    const times = [];
    for (let i = 0; i < config.testRounds; i++) {
      const start = performance.now();
      try {
        const data = await testCase.query();
        const end = performance.now();
        const duration = end - start;
        times.push(duration);
        console.log(`  轮次 ${i + 1}: ${duration.toFixed(2)}ms (${data?.length || 0} 条记录)`);
      } catch (error) {
        console.log(`  ❌ 轮次 ${i + 1} 失败: ${error.message}`);
      }
    }
    
    if (times.length > 0) {
      const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
      const minTime = Math.min(...times);
      const maxTime = Math.max(...times);
      
      results.push({
        name: testCase.name,
        avgTime: avgTime,
        minTime: minTime,
        maxTime: maxTime,
        times: times
      });
      
      console.log(`  📈 平均: ${avgTime.toFixed(2)}ms, 最小: ${minTime.toFixed(2)}ms, 最大: ${maxTime.toFixed(2)}ms\n`);
    }
  }
  
  return results;
}

// 生成报告
function generateReport(results) {
  const timestamp = new Date().toISOString();
  const report = {
    timestamp,
    config,
    results,
    summary: {
      totalTests: results.length,
      avgOverallTime: results.reduce((sum, r) => sum + r.avgTime, 0) / results.length,
      fastestTest: results.reduce((min, r) => r.avgTime < min.avgTime ? r : min),
      slowestTest: results.reduce((max, r) => r.avgTime > max.avgTime ? r : max)
    }
  };
  
  // 保存到文件
  const reportPath = path.join(__dirname, `performance-report-${Date.now()}.json`);
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  
  // 控制台输出
  console.log('📋 性能测试报告');
  console.log('='.repeat(50));
  console.log(`测试时间: ${timestamp}`);
  console.log(`测试轮数: ${config.testRounds}`);
  console.log(`预热轮数: ${config.warmupRounds}`);
  console.log('');
  
  console.log('📊 详细结果:');
  results.forEach((result, index) => {
    console.log(`${index + 1}. ${result.name}`);
    console.log(`   平均: ${result.avgTime.toFixed(2)}ms`);
    console.log(`   范围: ${result.minTime.toFixed(2)}ms - ${result.maxTime.toFixed(2)}ms`);
    console.log('');
  });
  
  console.log('📈 总结:');
  console.log(`总测试数: ${report.summary.totalTests}`);
  console.log(`整体平均: ${report.summary.avgOverallTime.toFixed(2)}ms`);
  console.log(`最快测试: ${report.summary.fastestTest.name} (${report.summary.fastestTest.avgTime.toFixed(2)}ms)`);
  console.log(`最慢测试: ${report.summary.slowestTest.name} (${report.summary.slowestTest.avgTime.toFixed(2)}ms)`);
  console.log('');
  console.log(`📄 详细报告已保存到: ${reportPath}`);
  
  return report;
}

// 索引使用情况检查
async function checkIndexUsage() {
  console.log('🔍 检查索引使用情况...\n');
  
  const indexQueries = [
    {
      name: 'Shadowing Items 索引',
      query: `
        SELECT 
          indexname,
          idx_scan,
          idx_tup_read,
          idx_tup_fetch
        FROM pg_stat_user_indexes 
        WHERE tablename = 'shadowing_items'
        ORDER BY idx_scan DESC;
      `
    },
    {
      name: 'Cloze Items 索引',
      query: `
        SELECT 
          indexname,
          idx_scan,
          idx_tup_read,
          idx_tup_fetch
        FROM pg_stat_user_indexes 
        WHERE tablename = 'cloze_items'
        ORDER BY idx_scan DESC;
      `
    },
    {
      name: '所有性能索引',
      query: `
        SELECT 
          schemaname,
          tablename,
          indexname,
          idx_scan,
          idx_tup_read,
          idx_tup_fetch
        FROM pg_stat_user_indexes 
        WHERE schemaname = 'public' 
        AND indexname LIKE 'idx_%'
        ORDER BY idx_scan DESC
        LIMIT 20;
      `
    }
  ];
  
  for (const { name, query } of indexQueries) {
    console.log(`📊 ${name}:`);
    try {
      const { data, error } = await supabase.rpc('exec_sql', { sql: query });
      if (error) {
        console.log(`   ❌ 查询失败: ${error.message}`);
      } else {
        console.log(`   ✅ 查询成功，返回 ${data?.length || 0} 条记录`);
        if (data && data.length > 0) {
          data.forEach(row => {
            console.log(`     ${row.indexname}: 扫描 ${row.idx_scan} 次, 读取 ${row.idx_tup_read} 行`);
          });
        }
      }
    } catch (error) {
      console.log(`   ❌ 执行失败: ${error.message}`);
    }
    console.log('');
  }
}

// 主函数
async function main() {
  try {
    // 检查索引使用情况
    await checkIndexUsage();
    
    // 运行性能测试
    const results = await runPerformanceTest();
    
    // 生成报告
    generateReport(results);
    
    console.log('✅ 性能测试完成！');
    
  } catch (error) {
    console.error('❌ 测试失败:', error);
    process.exit(1);
  }
}

// 运行测试
if (require.main === module) {
  main();
}

module.exports = { runPerformanceTest, generateReport, checkIndexUsage };
