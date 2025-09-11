#!/usr/bin/env node

/**
 * 并发测试脚本
 * 用于测试音频合并API的并发处理能力
 */

const https = require('https');
const http = require('http');

// 配置
const CONFIG = {
  baseUrl: 'http://localhost:3001', // 你的API地址
  endpoint: '/api/admin/shadowing/merge-audio',
  testCases: [
    { name: '轻度测试', concurrent: 3, requests: 6 },
    { name: '中度测试', concurrent: 5, requests: 10 },
    { name: '重度测试', concurrent: 8, requests: 16 },
    { name: '极限测试', concurrent: 12, requests: 24 }
  ],
  // 模拟音频URL（使用真实的Supabase URL）
  mockAudioUrls: [
    'https://yyfyieqfuwwyqrlewswu.supabase.co/storage/v1/object/sign/tts/zh/test1.mp3?token=mock1',
    'https://yyfyieqfuwwyqrlewswu.supabase.co/storage/v1/object/sign/tts/zh/test2.mp3?token=mock2',
    'https://yyfyieqfuwwyqrlewswu.supabase.co/storage/v1/object/sign/tts/zh/test3.mp3?token=mock3',
    'https://yyfyieqfuwwyqrlewswu.supabase.co/storage/v1/object/sign/tts/zh/test4.mp3?token=mock4',
    'https://yyfyieqfuwwyqrlewswu.supabase.co/storage/v1/object/sign/tts/zh/test5.mp3?token=mock5'
  ]
};

// 颜色输出
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

// 发送单个请求
function sendRequest(audioUrls, requestId) {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();
    const data = JSON.stringify({ audioUrls });
    
    const options = {
      hostname: 'localhost',
      port: 3001,
      path: CONFIG.endpoint,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data),
        'Authorization': 'Bearer your-token-here' // 需要替换为真实token
      }
    };

    const req = http.request(options, (res) => {
      let responseData = '';
      
      res.on('data', (chunk) => {
        responseData += chunk;
      });
      
      res.on('end', () => {
        const endTime = Date.now();
        const duration = endTime - startTime;
        
        resolve({
          requestId,
          status: res.statusCode,
          duration,
          success: res.statusCode === 200,
          response: responseData
        });
      });
    });

    req.on('error', (error) => {
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      reject({
        requestId,
        error: error.message,
        duration,
        success: false
      });
    });

    req.write(data);
    req.end();
  });
}

// 并发测试函数
async function runConcurrencyTest(testCase) {
  log(`\n🚀 开始 ${testCase.name}`, 'cyan');
  log(`并发数: ${testCase.concurrent}, 总请求数: ${testCase.requests}`, 'blue');
  
  const results = [];
  const startTime = Date.now();
  
  // 创建并发批次
  for (let i = 0; i < testCase.requests; i += testCase.concurrent) {
    const batch = [];
    const batchSize = Math.min(testCase.concurrent, testCase.requests - i);
    
    log(`\n📦 批次 ${Math.floor(i / testCase.concurrent) + 1}: 发送 ${batchSize} 个并发请求`, 'yellow');
    
    // 创建并发请求
    for (let j = 0; j < batchSize; j++) {
      const requestId = i + j + 1;
      const audioUrls = CONFIG.mockAudioUrls.slice(0, 3 + Math.floor(Math.random() * 3)); // 随机3-5个音频
      
      batch.push(
        sendRequest(audioUrls, requestId)
          .then(result => {
            log(`✅ 请求 ${requestId}: ${result.status} (${result.duration}ms)`, 'green');
            return result;
          })
          .catch(error => {
            log(`❌ 请求 ${requestId}: ${error.error || 'Unknown error'} (${error.duration}ms)`, 'red');
            return error;
          })
      );
    }
    
    // 等待当前批次完成
    const batchResults = await Promise.all(batch);
    results.push(...batchResults);
    
    // 批次间延迟
    if (i + testCase.concurrent < testCase.requests) {
      log(`⏳ 等待 2 秒后继续下一批次...`, 'yellow');
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }
  
  const endTime = Date.now();
  const totalDuration = endTime - startTime;
  
  // 分析结果
  const successCount = results.filter(r => r.success).length;
  const errorCount = results.length - successCount;
  const avgDuration = results.reduce((sum, r) => sum + r.duration, 0) / results.length;
  const successRate = (successCount / results.length) * 100;
  
  log(`\n📊 ${testCase.name} 结果:`, 'magenta');
  log(`总请求数: ${results.length}`, 'blue');
  log(`成功: ${successCount}`, 'green');
  log(`失败: ${errorCount}`, 'red');
  log(`成功率: ${successRate.toFixed(2)}%`, successRate > 90 ? 'green' : 'yellow');
  log(`平均响应时间: ${avgDuration.toFixed(2)}ms`, 'blue');
  log(`总耗时: ${totalDuration}ms`, 'blue');
  
  return {
    testCase: testCase.name,
    totalRequests: results.length,
    successCount,
    errorCount,
    successRate,
    avgDuration,
    totalDuration,
    results
  };
}

// 主测试函数
async function runAllTests() {
  log('🎯 开始并发测试', 'cyan');
  log('=' * 50, 'cyan');
  
  const allResults = [];
  
  for (const testCase of CONFIG.testCases) {
    try {
      const result = await runConcurrencyTest(testCase);
      allResults.push(result);
      
      // 测试间休息
      if (testCase !== CONFIG.testCases[CONFIG.testCases.length - 1]) {
        log('\n⏸️  测试间休息 5 秒...', 'yellow');
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
    } catch (error) {
      log(`❌ ${testCase.name} 测试失败: ${error.message}`, 'red');
    }
  }
  
  // 生成总结报告
  log('\n📋 测试总结报告', 'magenta');
  log('=' * 50, 'magenta');
  
  allResults.forEach(result => {
    log(`\n${result.testCase}:`, 'cyan');
    log(`  成功率: ${result.successRate.toFixed(2)}%`, result.successRate > 90 ? 'green' : 'yellow');
    log(`  平均响应: ${result.avgDuration.toFixed(2)}ms`, 'blue');
    log(`  总耗时: ${result.totalDuration}ms`, 'blue');
  });
  
  // 推荐最佳并发数
  const bestResult = allResults.reduce((best, current) => {
    if (current.successRate >= 95 && current.avgDuration < best.avgDuration) {
      return current;
    }
    return best;
  }, allResults[0]);
  
  log(`\n🏆 推荐最佳并发数: ${bestResult.testCase}`, 'green');
  log(`成功率: ${bestResult.successRate.toFixed(2)}%`, 'green');
  log(`平均响应时间: ${bestResult.avgDuration.toFixed(2)}ms`, 'green');
}

// 运行测试
if (require.main === module) {
  runAllTests().catch(error => {
    log(`❌ 测试运行失败: ${error.message}`, 'red');
    process.exit(1);
  });
}

module.exports = { runConcurrencyTest, runAllTests };
