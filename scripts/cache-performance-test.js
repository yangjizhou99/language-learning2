#!/usr/bin/env node

/**
 * 缓存性能测试脚本
 * 测试缓存系统的性能提升效果
 */

const https = require('https');
const http = require('http');

// 配置
const config = {
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
  supabaseKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
  baseUrl: process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000',
  testRounds: 5,
  warmupRounds: 2,
};

if (!config.supabaseUrl || !config.supabaseKey) {
  console.error('❌ 请设置环境变量:');
  console.error('NEXT_PUBLIC_SUPABASE_URL');
  console.error('SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const url = new URL(config.supabaseUrl);
const isHttps = url.protocol === 'https:';
const client = isHttps ? https : http;

// 发送请求
function makeRequest(url, method = 'GET', headers = {}) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const isHttps = urlObj.protocol === 'https:';
    const client = isHttps ? https : http;
    
    const options = {
      hostname: urlObj.hostname,
      port: urlObj.port || (isHttps ? 443 : 80),
      path: urlObj.pathname + urlObj.search,
      method: method,
      headers: {
        'User-Agent': 'Cache-Performance-Test/1.0',
        ...headers
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

// 测试缓存效果
async function testCacheEffect() {
  console.log('🚀 测试缓存效果...\n');
  
  const testCases = [
    {
      name: 'Shadowing 下一题 API (缓存测试)',
      url: `${config.baseUrl}/api/shadowing/next?lang=en&level=2`,
      expectedCache: true
    },
    {
      name: 'Cloze 下一题 API (缓存测试)',
      url: `${config.baseUrl}/api/cloze/next?lang=en&level=2`,
      expectedCache: true
    },
    {
      name: 'Shadowing 目录 API (缓存测试)',
      url: `${config.baseUrl}/api/shadowing/catalog?lang=en&level=2`,
      expectedCache: true
    }
  ];
  
  const results = [];
  
  for (const testCase of testCases) {
    console.log(`📊 测试: ${testCase.name}`);
    
    const times = [];
    const errors = [];
    
    // 预热
    for (let i = 0; i < config.warmupRounds; i++) {
      try {
        await makeRequest(testCase.url);
      } catch (error) {
        console.log(`   ⚠️  预热轮次 ${i + 1} 失败: ${error.message}`);
      }
    }
    
    // 正式测试
    for (let i = 0; i < config.testRounds; i++) {
      const start = performance.now();
      try {
        const response = await makeRequest(testCase.url);
        const end = performance.now();
        const duration = end - start;
        
        times.push(duration);
        console.log(`   轮次 ${i + 1}: ${duration.toFixed(2)}ms (状态: ${response.statusCode}, 大小: ${response.size} bytes)`);
        
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
      
      // 分析缓存效果
      const firstHalf = times.slice(0, Math.ceil(times.length / 2));
      const secondHalf = times.slice(Math.ceil(times.length / 2));
      const firstHalfAvg = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
      const secondHalfAvg = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;
      const cacheImprovement = ((firstHalfAvg - secondHalfAvg) / firstHalfAvg) * 100;
      
      results.push({
        name: testCase.name,
        avgTime: avgTime,
        minTime: minTime,
        maxTime: maxTime,
        times: times,
        errors: errors,
        successRate: (times.length / config.testRounds) * 100,
        firstHalfAvg: firstHalfAvg,
        secondHalfAvg: secondHalfAvg,
        cacheImprovement: cacheImprovement
      });
      
      console.log(`   📈 平均: ${avgTime.toFixed(2)}ms, 最小: ${minTime.toFixed(2)}ms, 最大: ${maxTime.toFixed(2)}ms`);
      console.log(`   🔄 缓存效果: ${cacheImprovement > 0 ? '✅' : '❌'} ${Math.abs(cacheImprovement).toFixed(1)}% ${cacheImprovement > 0 ? '提升' : '下降'}`);
      if (errors.length > 0) {
        console.log(`   ⚠️  错误: ${errors.join(', ')}`);
      }
      console.log('');
    }
  }
  
  return results;
}

// 测试数据库查询缓存
async function testDatabaseCache() {
  console.log('🗄️  测试数据库查询缓存...\n');
  
  const testCases = [
    {
      name: 'Shadowing题目查询 (数据库)',
      table: 'shadowing_items',
      query: {
        lang: 'eq.en',
        level: 'eq.2',
        order: 'created_at.desc',
        limit: '10'
      }
    },
    {
      name: 'Cloze题目查询 (数据库)',
      table: 'cloze_items',
      query: {
        lang: 'eq.en',
        level: 'eq.2',
        order: 'created_at.desc',
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
    const queryPath = `/rest/v1/${testCase.table}?${params.toString()}`;
    
    const times = [];
    
    // 预热
    for (let i = 0; i < config.warmupRounds; i++) {
      try {
        await makeRequest(`${config.supabaseUrl}${queryPath}`, 'GET', {
          'apikey': config.supabaseKey,
          'Authorization': `Bearer ${config.supabaseKey}`
        });
      } catch (error) {
        console.log(`   ⚠️  预热轮次 ${i + 1} 失败: ${error.message}`);
      }
    }
    
    // 正式测试
    for (let i = 0; i < config.testRounds; i++) {
      const start = performance.now();
      try {
        const response = await makeRequest(`${config.supabaseUrl}${queryPath}`, 'GET', {
          'apikey': config.supabaseKey,
          'Authorization': `Bearer ${config.supabaseKey}`
        });
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
        times: times
      });
      
      console.log(`   📈 平均: ${avgTime.toFixed(2)}ms, 最小: ${minTime.toFixed(2)}ms, 最大: ${maxTime.toFixed(2)}ms\n`);
    }
  }
  
  return results;
}

// 生成缓存性能报告
function generateCacheReport(apiResults, dbResults) {
  const timestamp = new Date().toISOString();
  const report = {
    timestamp,
    config,
    apiResults,
    dbResults,
    summary: {
      totalApiTests: apiResults.length,
      totalDbTests: dbResults.length,
      avgApiTime: apiResults.reduce((sum, r) => sum + r.avgTime, 0) / apiResults.length,
      avgDbTime: dbResults.reduce((sum, r) => sum + r.avgTime, 0) / dbResults.length,
      avgCacheImprovement: apiResults.reduce((sum, r) => sum + r.cacheImprovement, 0) / apiResults.length,
      bestCacheImprovement: apiResults.reduce((max, r) => r.cacheImprovement > max.cacheImprovement ? r : max),
      worstCacheImprovement: apiResults.reduce((min, r) => r.cacheImprovement < min.cacheImprovement ? r : min)
    }
  };
  
  // 控制台输出
  console.log('📋 缓存性能测试报告');
  console.log('='.repeat(60));
  console.log(`测试时间: ${timestamp}`);
  console.log(`测试轮数: ${config.testRounds}`);
  console.log(`预热轮数: ${config.warmupRounds}`);
  console.log('');
  
  if (apiResults.length > 0) {
    console.log('🌐 API 缓存测试结果:');
    apiResults.forEach((result, index) => {
      console.log(`${index + 1}. ${result.name}`);
      console.log(`   平均响应时间: ${result.avgTime.toFixed(2)}ms`);
      console.log(`   缓存效果: ${result.cacheImprovement > 0 ? '✅' : '❌'} ${Math.abs(result.cacheImprovement).toFixed(1)}% ${result.cacheImprovement > 0 ? '提升' : '下降'}`);
      console.log(`   成功率: ${result.successRate.toFixed(1)}%`);
      console.log('');
    });
  }
  
  if (dbResults.length > 0) {
    console.log('🗄️  数据库查询测试结果:');
    dbResults.forEach((result, index) => {
      console.log(`${index + 1}. ${result.name}`);
      console.log(`   平均查询时间: ${result.avgTime.toFixed(2)}ms`);
      console.log(`   范围: ${result.minTime.toFixed(2)}ms - ${result.maxTime.toFixed(2)}ms`);
      console.log('');
    });
  }
  
  console.log('📈 总结:');
  if (apiResults.length > 0) {
    console.log(`API 测试数量: ${report.summary.totalApiTests}`);
    console.log(`API 平均响应时间: ${report.summary.avgApiTime.toFixed(2)}ms`);
    console.log(`平均缓存提升: ${report.summary.avgCacheImprovement.toFixed(1)}%`);
    console.log(`最佳缓存效果: ${report.summary.bestCacheImprovement.name} (${report.summary.bestCacheImprovement.cacheImprovement.toFixed(1)}%)`);
  }
  if (dbResults.length > 0) {
    console.log(`数据库测试数量: ${report.summary.totalDbTests}`);
    console.log(`数据库平均查询时间: ${report.summary.avgDbTime.toFixed(2)}ms`);
  }
  
  console.log('');
  console.log('💡 缓存优化建议:');
  if (report.summary.avgCacheImprovement > 20) {
    console.log('✅ 缓存效果良好，建议继续使用');
  } else if (report.summary.avgCacheImprovement > 0) {
    console.log('🟡 缓存有一定效果，建议优化缓存策略');
  } else {
    console.log('❌ 缓存效果不明显，建议检查缓存配置');
  }
  
  return report;
}

// 主函数
async function main() {
  console.log('🚀 开始缓存性能测试...\n');
  
  try {
    // 测试 API 缓存效果
    const apiResults = await testCacheEffect();
    
    // 测试数据库查询性能
    const dbResults = await testDatabaseCache();
    
    // 生成报告
    generateCacheReport(apiResults, dbResults);
    
    console.log('✅ 缓存性能测试完成！');
    
  } catch (error) {
    console.error('❌ 测试失败:', error);
    process.exit(1);
  }
}

// 运行测试
if (require.main === module) {
  main();
}

module.exports = { testCacheEffect, testDatabaseCache, generateCacheReport };
