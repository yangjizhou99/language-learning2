#!/usr/bin/env node

/**
 * 简单的数据库性能测试脚本
 * 不需要额外依赖，直接使用 Node.js 内置模块
 */

const https = require('https');
const http = require('http');

// 配置
const config = {
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
  supabaseKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
  testRounds: 3,
  warmupRounds: 1,
};

if (!config.supabaseUrl || !config.supabaseKey) {
  console.error('❌ 请设置环境变量:');
  console.error('NEXT_PUBLIC_SUPABASE_URL');
  console.error('SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

// 解析 Supabase URL
const url = new URL(config.supabaseUrl);
const isHttps = url.protocol === 'https:';
const client = isHttps ? https : http;

// 测试用例
const testCases = [
  {
    name: 'Shadowing题目查询 (lang + level)',
    table: 'shadowing_items',
    query: {
      lang: 'eq.en',
      level: 'eq.2',
      order: 'created_at.desc',
      limit: '10'
    }
  },
  {
    name: 'Cloze题目查询 (lang + level)',
    table: 'cloze_items',
    query: {
      lang: 'eq.en',
      level: 'eq.2',
      order: 'created_at.desc',
      limit: '10'
    }
  },
  {
    name: '用户练习记录查询',
    table: 'shadowing_attempts',
    query: {
      lang: 'eq.en',
      order: 'created_at.desc',
      limit: '20'
    }
  },
  {
    name: '文章草稿状态查询',
    table: 'article_drafts',
    query: {
      status: 'eq.approved',
      order: 'created_at.desc',
      limit: '10'
    }
  }
];

// 构建查询 URL
function buildQueryUrl(table, query) {
  const params = new URLSearchParams();
  Object.entries(query).forEach(([key, value]) => {
    params.append(key, value);
  });
  return `/rest/v1/${table}?${params.toString()}`;
}

// 发送 HTTP 请求
function makeRequest(path, method = 'GET') {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: url.hostname,
      port: url.port || (isHttps ? 443 : 80),
      path: path,
      method: method,
      headers: {
        'apikey': config.supabaseKey,
        'Authorization': `Bearer ${config.supabaseKey}`,
        'Content-Type': 'application/json',
        'User-Agent': 'Performance-Test/1.0'
      },
      timeout: 10000
    };
    
    const req = client.request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          const jsonData = JSON.parse(data);
          resolve({
            statusCode: res.statusCode,
            data: jsonData,
            size: data.length
          });
        } catch (error) {
          resolve({
            statusCode: res.statusCode,
            data: data,
            size: data.length,
            parseError: error.message
          });
        }
      });
    });
    
    req.on('error', (error) => {
      reject(error);
    });
    
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });
    
    req.end();
  });
}

// 测试单个查询
async function testQuery(testCase) {
  console.log(`📊 测试: ${testCase.name}`);
  
  const queryPath = buildQueryUrl(testCase.table, testCase.query);
  const times = [];
  const errors = [];
  
  // 预热
  for (let i = 0; i < config.warmupRounds; i++) {
    try {
      await makeRequest(queryPath);
    } catch (error) {
      console.log(`   ⚠️  预热轮次 ${i + 1} 失败: ${error.message}`);
    }
  }
  
  // 正式测试
  for (let i = 0; i < config.testRounds; i++) {
    const start = performance.now();
    try {
      const response = await makeRequest(queryPath);
      const end = performance.now();
      const duration = end - start;
      
      times.push(duration);
      const recordCount = Array.isArray(response.data) ? response.data.length : 0;
      console.log(`   轮次 ${i + 1}: ${duration.toFixed(2)}ms (${recordCount} 条记录, 状态: ${response.statusCode})`);
      
      if (response.statusCode >= 400) {
        errors.push(`HTTP ${response.statusCode}`);
      }
    } catch (error) {
      errors.push(error.message);
      console.log(`   ❌ 轮次 ${i + 1} 失败: ${error.message}`);
    }
  }
  
  if (times.length > 0) {
    const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
    const minTime = Math.min(...times);
    const maxTime = Math.max(...times);
    
    console.log(`   📈 平均: ${avgTime.toFixed(2)}ms, 最小: ${minTime.toFixed(2)}ms, 最大: ${maxTime.toFixed(2)}ms`);
    if (errors.length > 0) {
      console.log(`   ⚠️  错误: ${errors.join(', ')}`);
    }
    console.log('');
    
    return {
      name: testCase.name,
      table: testCase.table,
      avgTime: avgTime,
      minTime: minTime,
      maxTime: maxTime,
      times: times,
      errors: errors,
      successRate: (times.length / config.testRounds) * 100
    };
  }
  
  return null;
}

// 检查索引使用情况
async function checkIndexUsage() {
  console.log('🔍 检查索引使用情况...\n');
  
  const indexQueries = [
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
        LIMIT 10;
      `
    }
  ];
  
  for (const { name, query } of indexQueries) {
    console.log(`📊 ${name}:`);
    try {
      // 使用 Supabase 的 RPC 功能执行 SQL
      const rpcPath = '/rest/v1/rpc/exec_sql';
      const response = await makeRequest(rpcPath, 'POST');
      
      if (response.statusCode === 200) {
        console.log(`   ✅ 查询成功，返回 ${response.data?.length || 0} 条记录`);
        if (response.data && response.data.length > 0) {
          response.data.forEach(row => {
            console.log(`     ${row.indexname}: 扫描 ${row.idx_scan} 次, 读取 ${row.idx_tup_read} 行`);
          });
        }
      } else {
        console.log(`   ❌ 查询失败: HTTP ${response.statusCode}`);
      }
    } catch (error) {
      console.log(`   ❌ 执行失败: ${error.message}`);
    }
    console.log('');
  }
}

// 主函数
async function main() {
  console.log('🚀 开始简单数据库性能测试...\n');
  console.log(`Supabase URL: ${config.supabaseUrl}`);
  console.log(`测试轮数: ${config.testRounds}`);
  console.log(`预热轮数: ${config.warmupRounds}`);
  console.log('');
  
  try {
    // 检查索引使用情况
    await checkIndexUsage();
    
    // 运行查询测试
    const results = [];
    for (const testCase of testCases) {
      const result = await testQuery(testCase);
      if (result) {
        results.push(result);
      }
    }
    
    // 生成简单报告
    if (results.length > 0) {
      console.log('📋 性能测试报告');
      console.log('='.repeat(50));
      console.log(`测试时间: ${new Date().toISOString()}`);
      console.log(`测试轮数: ${config.testRounds}`);
      console.log('');
      
      console.log('📊 详细结果:');
      results.forEach((result, index) => {
        console.log(`${index + 1}. ${result.name}`);
        console.log(`   表: ${result.table}`);
        console.log(`   平均: ${result.avgTime.toFixed(2)}ms`);
        console.log(`   范围: ${result.minTime.toFixed(2)}ms - ${result.maxTime.toFixed(2)}ms`);
        console.log(`   成功率: ${result.successRate.toFixed(1)}%`);
        console.log('');
      });
      
      const avgOverallTime = results.reduce((sum, r) => sum + r.avgTime, 0) / results.length;
      const fastestTest = results.reduce((min, r) => r.avgTime < min.avgTime ? r : min);
      const slowestTest = results.reduce((max, r) => r.avgTime > max.avgTime ? r : max);
      
      console.log('📈 总结:');
      console.log(`总测试数: ${results.length}`);
      console.log(`整体平均: ${avgOverallTime.toFixed(2)}ms`);
      console.log(`最快测试: ${fastestTest.name} (${fastestTest.avgTime.toFixed(2)}ms)`);
      console.log(`最慢测试: ${slowestTest.name} (${slowestTest.avgTime.toFixed(2)}ms)`);
      console.log('');
      
      // 性能评估
      console.log('💡 性能评估:');
      results.forEach(result => {
        let status = '✅ 优秀';
        if (result.avgTime > 100) status = '⚠️  需要优化';
        else if (result.avgTime > 50) status = '🟡 良好';
        console.log(`   ${result.name}: ${status} (${result.avgTime.toFixed(2)}ms)`);
      });
    }
    
    console.log('✅ 简单数据库性能测试完成！');
    
  } catch (error) {
    console.error('❌ 测试失败:', error);
    process.exit(1);
  }
}

// 运行测试
if (require.main === module) {
  main();
}

module.exports = { testQuery, checkIndexUsage };
