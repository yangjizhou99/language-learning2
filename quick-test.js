#!/usr/bin/env node

/**
 * 快速并发测试脚本
 * 用于快速测试音频合并API的并发处理能力
 */

const http = require('http');

// 配置
const API_URL = 'http://localhost:3001/api/admin/shadowing/merge-audio';
const MOCK_AUDIO_URLS = [
  'https://yyfyieqfuwwyqrlewswu.supabase.co/storage/v1/object/sign/tts/zh/test1.mp3?token=mock1',
  'https://yyfyieqfuwwyqrlewswu.supabase.co/storage/v1/object/sign/tts/zh/test2.mp3?token=mock2',
  'https://yyfyieqfuwwyqrlewswu.supabase.co/storage/v1/object/sign/tts/zh/test3.mp3?token=mock3'
];

// 发送请求
function sendRequest(requestId) {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();
    const data = JSON.stringify({ audioUrls: MOCK_AUDIO_URLS });
    
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
          success: res.statusCode === 200
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
      batch.push(
        sendRequest(requestId)
          .then(result => {
            console.log(`✅ 请求 ${result.id}: ${result.status} (${result.duration}ms)`);
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
      console.log('⏳ 等待 1 秒...');
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  
  const totalDuration = Date.now() - startTime;
  const successCount = results.filter(r => r.success).length;
  const avgDuration = results.reduce((sum, r) => sum + r.duration, 0) / results.length;
  
  console.log(`\n📊 结果:`);
  console.log(`成功: ${successCount}/${results.length} (${(successCount/results.length*100).toFixed(1)}%)`);
  console.log(`平均响应时间: ${avgDuration.toFixed(0)}ms`);
  console.log(`总耗时: ${totalDuration}ms`);
  
  return { successCount, total: results.length, avgDuration, totalDuration };
}

// 主函数
async function main() {
  console.log('🎯 快速并发测试开始');
  console.log('=' * 40);
  
  const tests = [
    { concurrent: 3, total: 6 },
    { concurrent: 5, total: 10 },
    { concurrent: 8, total: 16 },
    { concurrent: 12, total: 24 }
  ];
  
  for (const test of tests) {
    try {
      await testConcurrency(test.concurrent, test.total);
      console.log('\n⏸️  等待 3 秒后继续...');
      await new Promise(resolve => setTimeout(resolve, 3000));
    } catch (error) {
      console.log(`❌ 测试失败: ${error.message}`);
    }
  }
  
  console.log('\n🏁 测试完成！');
}

// 运行测试
main().catch(console.error);
