#!/usr/bin/env node

/**
 * API 性能测试脚本
 * 测试优化后的 API 响应时间
 */

const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');

// 配置
const config = {
  baseUrl: process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000',
  testRounds: 3,
  warmupRounds: 1,
  timeout: 10000, // 10秒超时
};

// API 测试用例
const apiTests = [
  {
    name: 'Shadowing 下一题 API',
    path: '/api/shadowing/next?lang=en&level=2',
    method: 'GET',
  },
  {
    name: 'Cloze 下一题 API',
    path: '/api/cloze/next?lang=en&level=2',
    method: 'GET',
  },
  {
    name: 'Shadowing 目录 API',
    path: '/api/shadowing/catalog?lang=en&level=2',
    method: 'GET',
  },
  {
    name: '词汇表 API',
    path: '/api/vocab/list?lang=en',
    method: 'GET',
  },
];

// HTTP 请求函数
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
        'User-Agent': 'Performance-Test/1.0',
        ...headers,
      },
      timeout: config.timeout,
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
            headers: res.headers,
            data: jsonData,
            size: data.length,
          });
        } catch (error) {
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            data: data,
            size: data.length,
            parseError: error.message,
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

// 单个 API 测试
async function testApi(testCase) {
  console.log(`🌐 测试 API: ${testCase.name}`);
  console.log(`   路径: ${testCase.path}`);

  const url = `${config.baseUrl}${testCase.path}`;
  const times = [];
  const errors = [];

  // 预热
  for (let i = 0; i < config.warmupRounds; i++) {
    try {
      await makeRequest(url, testCase.method);
    } catch (error) {
      console.log(`   ⚠️  预热轮次 ${i + 1} 失败: ${error.message}`);
    }
  }

  // 正式测试
  for (let i = 0; i < config.testRounds; i++) {
    const start = performance.now();
    try {
      const response = await makeRequest(url, testCase.method);
      const end = performance.now();
      const duration = end - start;

      times.push(duration);
      console.log(
        `   轮次 ${i + 1}: ${duration.toFixed(2)}ms (状态: ${response.statusCode}, 大小: ${response.size} bytes)`,
      );

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

    console.log(
      `   📈 平均: ${avgTime.toFixed(2)}ms, 最小: ${minTime.toFixed(2)}ms, 最大: ${maxTime.toFixed(2)}ms`,
    );
    if (errors.length > 0) {
      console.log(`   ⚠️  错误: ${errors.join(', ')}`);
    }
    console.log('');

    return {
      name: testCase.name,
      path: testCase.path,
      avgTime: avgTime,
      minTime: minTime,
      maxTime: maxTime,
      times: times,
      errors: errors,
      successRate: (times.length / config.testRounds) * 100,
    };
  }

  return null;
}

// 运行所有 API 测试
async function runApiTests() {
  console.log('🚀 开始 API 性能测试...\n');
  console.log(`基础 URL: ${config.baseUrl}`);
  console.log(`测试轮数: ${config.testRounds}`);
  console.log(`预热轮数: ${config.warmupRounds}`);
  console.log('');

  const results = [];

  for (const testCase of apiTests) {
    const result = await testApi(testCase);
    if (result) {
      results.push(result);
    }
  }

  return results;
}

// 生成 API 测试报告
function generateApiReport(results) {
  const timestamp = new Date().toISOString();
  const report = {
    timestamp,
    config,
    results,
    summary: {
      totalTests: results.length,
      avgOverallTime: results.reduce((sum, r) => sum + r.avgTime, 0) / results.length,
      fastestApi: results.reduce((min, r) => (r.avgTime < min.avgTime ? r : min)),
      slowestApi: results.reduce((max, r) => (r.avgTime > max.avgTime ? r : max)),
      totalErrors: results.reduce((sum, r) => sum + r.errors.length, 0),
      avgSuccessRate: results.reduce((sum, r) => sum + r.successRate, 0) / results.length,
    },
  };

  // 保存到文件
  const reportPath = path.join(__dirname, `api-performance-report-${Date.now()}.json`);
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

  // 控制台输出
  console.log('📋 API 性能测试报告');
  console.log('='.repeat(50));
  console.log(`测试时间: ${timestamp}`);
  console.log(`基础 URL: ${config.baseUrl}`);
  console.log(`测试轮数: ${config.testRounds}`);
  console.log('');

  console.log('📊 详细结果:');
  results.forEach((result, index) => {
    console.log(`${index + 1}. ${result.name}`);
    console.log(`   路径: ${result.path}`);
    console.log(`   平均: ${result.avgTime.toFixed(2)}ms`);
    console.log(`   范围: ${result.minTime.toFixed(2)}ms - ${result.maxTime.toFixed(2)}ms`);
    console.log(`   成功率: ${result.successRate.toFixed(1)}%`);
    if (result.errors.length > 0) {
      console.log(`   错误: ${result.errors.join(', ')}`);
    }
    console.log('');
  });

  console.log('📈 总结:');
  console.log(`总测试数: ${report.summary.totalTests}`);
  console.log(`整体平均: ${report.summary.avgOverallTime.toFixed(2)}ms`);
  console.log(
    `最快 API: ${report.summary.fastestApi.name} (${report.summary.fastestApi.avgTime.toFixed(2)}ms)`,
  );
  console.log(
    `最慢 API: ${report.summary.slowestApi.name} (${report.summary.slowestApi.avgTime.toFixed(2)}ms)`,
  );
  console.log(`总错误数: ${report.summary.totalErrors}`);
  console.log(`平均成功率: ${report.summary.avgSuccessRate.toFixed(1)}%`);
  console.log('');
  console.log(`📄 详细报告已保存到: ${reportPath}`);

  return report;
}

// 主函数
async function main() {
  try {
    // 运行 API 测试
    const results = await runApiTests();

    // 生成报告
    generateApiReport(results);

    console.log('✅ API 性能测试完成！');
  } catch (error) {
    console.error('❌ 测试失败:', error);
    process.exit(1);
  }
}

// 运行测试
if (require.main === module) {
  main();
}

module.exports = { runApiTests, generateApiReport };
