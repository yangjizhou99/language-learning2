#!/usr/bin/env node

/**
 * 真实并发测试脚本
 * 使用真实的音频URL测试并发处理能力
 */

const http = require('http');

// 真实的音频URL（从你的日志中获取）
const REAL_AUDIO_URLS = [
  'https://yyfyieqfuwwyqrlewswu.supabase.co/storage/v1/object/sign/tts/zh/1757568600196-yx2dfhao47.mp3?token=eyJraWQiOiJzdG9yYWdlLXVybC1zaWduaW5nLWtleV85M2VkZDZkOC01Y2ZmLTRmMTMtYWIyNS1iYWJiMjk3MWU3YzEiLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJ0dHMvemgvMTc1NzU2ODYwMDE5Ni15eDJkZmhhbzQ3Lm1wMyIsImlhdCI6MTc1NzU2ODYwNCwiZXhwIjoxNzYwMTYwNjA0fQ.IaHPfniar6FqAT71b-_oeFeAPSrju8iCXsacWDIYHf4',
  'https://yyfyieqfuwwyqrlewswu.supabase.co/storage/v1/object/sign/tts/zh/1757568600283-ab3116yrcpe.mp3?token=eyJraWQiOiJzdG9yYWdlLXVybC1zaWduaW5nLWtleV85M2VkZDZkOC01Y2ZmLTRmMTMtYWIyNS1iYWJiMjk3MWU3YzEiLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJ0dHMvemgvMTc1NzU2ODYwMDI4My1hYjMxMTZ5cmNwZS5tcDMiLCJpYXQiOjE3NTc1Njg2MDQsImV4cCI6MTc2MDE2MDYwNH0.xzbDkANV93XL4m_NBJD-zRtIc7-YBt48wQKI3pfL6oE',
  'https://yyfyieqfuwwyqrlewswu.supabase.co/storage/v1/object/sign/tts/zh/1757568601142-yz2vakbcb18.mp3?token=eyJraWQiOiJzdG9yYWdlLXVybC1zaWduaW5nLWtleV85M2VkZDZkOC01Y2ZmLTRmMTMtYWIyNS1iYWJiMjk3MWU3YzEiLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJ0dHMvemgvMTc1NzU2ODYwMTE0Mi15ejJ2YWtiY2IxOC5tcDMiLCJpYXQiOjE3NTc1Njg2MDUsImV4cCI6MTc2MDE2MDYwNX0.R1OcmdP7NqQ-5VO_TVofGlhcSWN2cFrcIhUf6C9IioA'
];

// 发送请求
function sendRequest(requestId, audioUrls) {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();
    const data = JSON.stringify({ audioUrls });
    
    const options = {
      hostname: 'localhost',
      port: 3001,
      path: '/api/admin/shadowing/merge-audio',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data)
      }
    };

    const req = http.request(options, (res) => {
      let responseData = '';
      res.on('data', chunk => responseData += chunk);
      res.on('end', () => {
        const duration = Date.now() - startTime;
        resolve({
          id: requestId,
          status: res.statusCode,
          duration,
          success: res.statusCode === 200,
          response: responseData
        });
      });
    });

    req.on('error', (error) => {
      const duration = Date.now() - startTime;
      reject({
        id: requestId,
        error: error.message,
        duration,
        success: false
      });
    });

    req.write(data);
    req.end();
  });
}

// 并发测试
async function testConcurrency(concurrent, total) {
  console.log(`\n🚀 测试 ${concurrent} 个并发，总共 ${total} 个请求`);
  console.log(`使用真实音频URL: ${REAL_AUDIO_URLS.length} 个`);
  
  const results = [];
  const startTime = Date.now();
  
  // 分批发送请求
  for (let i = 0; i < total; i += concurrent) {
    const batch = [];
    const batchSize = Math.min(concurrent, total - i);
    
    console.log(`📦 发送批次 ${Math.floor(i / concurrent) + 1}: ${batchSize} 个请求`);
    
    // 创建并发请求
    for (let j = 0; j < batchSize; j++) {
      const requestId = i + j + 1;
      // 随机选择2-3个音频URL
      const audioUrls = REAL_AUDIO_URLS.slice(0, 2 + Math.floor(Math.random() * 2));
      
      batch.push(
        sendRequest(requestId, audioUrls)
          .then(result => {
            const status = result.success ? '✅' : '❌';
            console.log(`${status} 请求 ${result.id}: ${result.status} (${result.duration}ms)`);
            return result;
          })
          .catch(error => {
            console.log(`❌ 请求 ${error.id}: ${error.error} (${error.duration}ms)`);
            return error;
          })
      );
    }
    
    // 等待当前批次完成
    const batchResults = await Promise.all(batch);
    results.push(...batchResults);
    
    // 批次间延迟
    if (i + concurrent < total) {
      console.log('⏳ 等待 2 秒...');
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }
  
  const totalDuration = Date.now() - startTime;
  const successCount = results.filter(r => r.success).length;
  const errorCount = results.length - successCount;
  const avgDuration = results.reduce((sum, r) => sum + r.duration, 0) / results.length;
  const successRate = (successCount / results.length) * 100;
  
  console.log(`\n📊 结果:`);
  console.log(`总请求数: ${results.length}`);
  console.log(`成功: ${successCount} (${successRate.toFixed(1)}%)`);
  console.log(`失败: ${errorCount}`);
  console.log(`平均响应时间: ${avgDuration.toFixed(0)}ms`);
  console.log(`总耗时: ${totalDuration}ms`);
  
  // 显示错误详情
  const errors = results.filter(r => !r.success);
  if (errors.length > 0) {
    console.log(`\n❌ 错误详情:`);
    errors.forEach(error => {
      console.log(`  请求 ${error.id}: ${error.error || `HTTP ${error.status}`}`);
    });
  }
  
  return { successCount, total: results.length, avgDuration, totalDuration, successRate };
}

// 主函数
async function main() {
  console.log('🎯 真实并发测试开始');
  console.log('=' * 50);
  
  const tests = [
    { concurrent: 3, total: 6, name: '轻度测试' },
    { concurrent: 5, total: 10, name: '中度测试' },
    { concurrent: 8, total: 16, name: '重度测试' },
    { concurrent: 12, total: 24, name: '极限测试' }
  ];
  
  const allResults = [];
  
  for (const test of tests) {
    console.log(`\n🔍 ${test.name}`);
    console.log('=' * 30);
    
    try {
      const result = await testConcurrency(test.concurrent, test.total);
      allResults.push({ ...result, name: test.name, concurrent: test.concurrent });
      
      if (test !== tests[tests.length - 1]) {
        console.log('\n⏸️  等待 5 秒后继续...');
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
    } catch (error) {
      console.log(`❌ ${test.name} 测试失败: ${error.message}`);
    }
  }
  
  // 生成总结报告
  console.log('\n📋 测试总结报告');
  console.log('=' * 50);
  
  allResults.forEach(result => {
    console.log(`\n${result.name} (${result.concurrent}并发):`);
    console.log(`  成功率: ${result.successRate.toFixed(1)}%`);
    console.log(`  平均响应: ${result.avgDuration.toFixed(0)}ms`);
    console.log(`  总耗时: ${result.totalDuration}ms`);
  });
  
  // 推荐最佳并发数
  const bestResult = allResults.reduce((best, current) => {
    if (current.successRate >= 95 && current.avgDuration < best.avgDuration) {
      return current;
    }
    return best;
  }, allResults[0]);
  
  if (bestResult) {
    console.log(`\n🏆 推荐最佳并发数: ${bestResult.name} (${bestResult.concurrent}并发)`);
    console.log(`成功率: ${bestResult.successRate.toFixed(1)}%`);
    console.log(`平均响应时间: ${bestResult.avgDuration.toFixed(0)}ms`);
  }
  
  console.log('\n🏁 测试完成！');
}

// 运行测试
main().catch(console.error);
