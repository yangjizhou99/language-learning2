#!/usr/bin/env node

/**
 * 分析慢查询的脚本
 * 专门分析 Shadowing 题目查询的性能
 */

const https = require('https');
const http = require('http');

// 配置
const config = {
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
  supabaseKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
};

if (!config.supabaseUrl || !config.supabaseKey) {
  console.error('❌ 请设置环境变量');
  process.exit(1);
}

const url = new URL(config.supabaseUrl);
const isHttps = url.protocol === 'https:';
const client = isHttps ? https : http;

// 发送请求
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
        'User-Agent': 'Query-Analyzer/1.0'
      },
      timeout: 10000
    };
    
    const req = client.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          resolve({
            statusCode: res.statusCode,
            data: JSON.parse(data),
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
    
    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });
    
    req.end();
  });
}

// 分析 Shadowing 查询
async function analyzeShadowingQuery() {
  console.log('🔍 分析 Shadowing 题目查询性能...\n');
  
  const testCases = [
    {
      name: '基础查询 (lang + level)',
      query: {
        lang: 'eq.en',
        level: 'eq.2',
        order: 'created_at.desc',
        limit: '10'
      }
    },
    {
      name: '只按语言查询',
      query: {
        lang: 'eq.en',
        order: 'created_at.desc',
        limit: '10'
      }
    },
    {
      name: '只按等级查询',
      query: {
        level: 'eq.2',
        order: 'created_at.desc',
        limit: '10'
      }
    },
    {
      name: '无过滤条件查询',
      query: {
        order: 'created_at.desc',
        limit: '10'
      }
    },
    {
      name: '按标题排序',
      query: {
        lang: 'eq.en',
        level: 'eq.2',
        order: 'title.asc',
        limit: '10'
      }
    }
  ];
  
  const results = [];
  
  for (const testCase of testCases) {
    console.log(`📊 测试: ${testCase.name}`);
    
    const params = new URLSearchParams();
    Object.entries(testCase.query).forEach(([key, value]) => {
      params.append(key, value);
    });
    const queryPath = `/rest/v1/shadowing_items?${params.toString()}`;
    
    const times = [];
    for (let i = 0; i < 3; i++) {
      const start = performance.now();
      try {
        const response = await makeRequest(queryPath);
        const end = performance.now();
        const duration = end - start;
        
        times.push(duration);
        const recordCount = Array.isArray(response.data) ? response.data.length : 0;
        console.log(`   轮次 ${i + 1}: ${duration.toFixed(2)}ms (${recordCount} 条记录)`);
      } catch (error) {
        console.log(`   ❌ 轮次 ${i + 1} 失败: ${error.message}`);
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
        query: testCase.query
      });
      
      console.log(`   📈 平均: ${avgTime.toFixed(2)}ms, 最小: ${minTime.toFixed(2)}ms, 最大: ${maxTime.toFixed(2)}ms\n`);
    }
  }
  
  return results;
}

// 检查表结构
async function checkTableStructure() {
  console.log('🔍 检查 shadowing_items 表结构...\n');
  
  try {
    // 获取表信息
    const response = await makeRequest('/rest/v1/shadowing_items?limit=1');
    if (response.statusCode === 200 && Array.isArray(response.data) && response.data.length > 0) {
      const sample = response.data[0];
      console.log('📋 表字段:');
      Object.keys(sample).forEach(key => {
        console.log(`   ${key}: ${typeof sample[key]}`);
      });
      console.log('');
    }
  } catch (error) {
    console.log(`❌ 获取表结构失败: ${error.message}\n`);
  }
}

// 检查数据量
async function checkDataVolume() {
  console.log('🔍 检查数据量...\n');
  
  try {
    // 获取总数据量
    const totalResponse = await makeRequest('/rest/v1/shadowing_items?select=count');
    console.log(`📊 总数据量: ${totalResponse.data?.length || 0} 条记录`);
    
    // 按语言分组统计
    const langResponse = await makeRequest('/rest/v1/shadowing_items?select=lang');
    if (Array.isArray(langResponse.data)) {
      const langCounts = {};
      langResponse.data.forEach(item => {
        langCounts[item.lang] = (langCounts[item.lang] || 0) + 1;
      });
      console.log('📊 按语言分组:');
      Object.entries(langCounts).forEach(([lang, count]) => {
        console.log(`   ${lang}: ${count} 条记录`);
      });
    }
    
    // 按等级分组统计
    const levelResponse = await makeRequest('/rest/v1/shadowing_items?select=level');
    if (Array.isArray(levelResponse.data)) {
      const levelCounts = {};
      levelResponse.data.forEach(item => {
        levelCounts[item.level] = (levelCounts[item.level] || 0) + 1;
      });
      console.log('📊 按等级分组:');
      Object.entries(levelCounts).forEach(([level, count]) => {
        console.log(`   等级 ${level}: ${count} 条记录`);
      });
    }
    
    console.log('');
  } catch (error) {
    console.log(`❌ 检查数据量失败: ${error.message}\n`);
  }
}

// 生成优化建议
function generateOptimizationSuggestions(results) {
  console.log('💡 优化建议:\n');
  
  const baseQuery = results.find(r => r.name === '基础查询 (lang + level)');
  const langOnlyQuery = results.find(r => r.name === '只按语言查询');
  const levelOnlyQuery = results.find(r => r.name === '只按等级查询');
  const noFilterQuery = results.find(r => r.name === '无过滤条件查询');
  
  if (baseQuery && baseQuery.avgTime > 50) {
    console.log('1. 🎯 基础查询较慢，建议优化:');
    console.log(`   当前: ${baseQuery.avgTime.toFixed(2)}ms`);
    
    if (langOnlyQuery && levelOnlyQuery) {
      if (langOnlyQuery.avgTime < levelOnlyQuery.avgTime) {
        console.log('   - 语言索引效果更好，考虑优化等级索引');
      } else {
        console.log('   - 等级索引效果更好，考虑优化语言索引');
      }
    }
    
    console.log('   - 检查复合索引 (lang, level, created_at) 是否正确创建');
    console.log('   - 考虑添加覆盖索引包含常用字段');
  }
  
  if (noFilterQuery && noFilterQuery.avgTime > 30) {
    console.log('2. 📊 无过滤查询较慢，建议:');
    console.log(`   当前: ${noFilterQuery.avgTime.toFixed(2)}ms`);
    console.log('   - 检查 created_at 索引');
    console.log('   - 考虑添加部分索引减少扫描范围');
  }
  
  console.log('3. 🔧 通用优化建议:');
  console.log('   - 定期运行 ANALYZE 更新统计信息');
  console.log('   - 监控索引使用情况');
  console.log('   - 考虑数据分区（如果数据量很大）');
  console.log('   - 优化查询条件，避免全表扫描');
  
  console.log('');
}

// 主函数
async function main() {
  console.log('🚀 开始分析慢查询...\n');
  
  try {
    // 检查表结构
    await checkTableStructure();
    
    // 检查数据量
    await checkDataVolume();
    
    // 分析查询性能
    const results = await analyzeShadowingQuery();
    
    // 生成优化建议
    generateOptimizationSuggestions(results);
    
    console.log('✅ 慢查询分析完成！');
    
  } catch (error) {
    console.error('❌ 分析失败:', error);
    process.exit(1);
  }
}

// 运行分析
if (require.main === module) {
  main();
}

module.exports = { analyzeShadowingQuery, checkTableStructure, checkDataVolume };
