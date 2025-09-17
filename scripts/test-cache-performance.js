#!/usr/bin/env node

/**
 * 缓存性能测试脚本
 * 验证三层缓存 + 304 条件请求的效果
 */

const https = require('https');
const http = require('http');

// 配置
const baseUrl = process.env.TEST_URL || 'http://localhost:3000';
const testEndpoints = [
  '/api/shadowing/next?lang=en&level=2',
  '/api/cloze/next?lang=en&level=3',
  '/api/tts/voices?lang=en&kind=Neural2'
];

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function log(message, color = colors.reset) {
  console.log(color + message + colors.reset);
}

// 执行 HTTP 请求
function makeRequest(url, headers = {}) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const client = urlObj.protocol === 'https:' ? https : http;
    
    const options = {
      hostname: urlObj.hostname,
      port: urlObj.port || (urlObj.protocol === 'https:' ? 443 : 80),
      path: urlObj.pathname + urlObj.search,
      method: 'GET',
      headers: {
        'User-Agent': 'Cache-Test-Script/1.0',
        ...headers
      }
    };

    const startTime = Date.now();
    
    const req = client.request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        const duration = Date.now() - startTime;
        resolve({
          status: res.statusCode,
          headers: res.headers,
          data: data,
          duration,
          size: Buffer.byteLength(data, 'utf8')
        });
      });
    });

    req.on('error', reject);
    req.setTimeout(10000, () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });
    
    req.end();
  });
}

// 测试单个端点的缓存效果
async function testEndpointCaching(endpoint) {
  log(`\n=== 测试端点: ${endpoint} ===`, colors.blue);
  
  try {
    // 第一次请求 - 应该是冷缓存
    log('1. 第一次请求 (冷缓存)...', colors.yellow);
    const firstResponse = await makeRequest(baseUrl + endpoint);
    
    log(`   状态码: ${firstResponse.status}`, 
        firstResponse.status === 200 ? colors.green : colors.red);
    log(`   响应时间: ${firstResponse.duration}ms`);
    log(`   响应大小: ${firstResponse.size} bytes`);
    
    const etag = firstResponse.headers.etag;
    const cacheControl = firstResponse.headers['cache-control'];
    
    if (etag) {
      log(`   ETag: ${etag}`, colors.cyan);
    } else {
      log('   ⚠️  缺少 ETag 头', colors.yellow);
    }
    
    if (cacheControl) {
      log(`   Cache-Control: ${cacheControl}`, colors.cyan);
    } else {
      log('   ⚠️  缺少 Cache-Control 头', colors.yellow);
    }

    // 第二次请求 - 应该命中缓存或返回相同结果
    log('\n2. 第二次请求 (热缓存)...', colors.yellow);
    const secondResponse = await makeRequest(baseUrl + endpoint);
    
    log(`   状态码: ${secondResponse.status}`, 
        secondResponse.status === 200 ? colors.green : colors.red);
    log(`   响应时间: ${secondResponse.duration}ms`);
    
    // 比较响应时间
    const speedImprovement = ((firstResponse.duration - secondResponse.duration) / firstResponse.duration * 100).toFixed(1);
    if (secondResponse.duration < firstResponse.duration) {
      log(`   ✅ 响应时间提升: ${speedImprovement}%`, colors.green);
    } else {
      log(`   ⚠️  响应时间未改善`, colors.yellow);
    }

    // 第三次请求 - 带 ETag 条件请求
    if (etag) {
      log('\n3. 条件请求 (If-None-Match)...', colors.yellow);
      const conditionalResponse = await makeRequest(baseUrl + endpoint, {
        'If-None-Match': etag
      });
      
      if (conditionalResponse.status === 304) {
        log(`   ✅ 返回 304 Not Modified`, colors.green);
        log(`   响应时间: ${conditionalResponse.duration}ms`);
        log(`   响应大小: ${conditionalResponse.size} bytes (应该为0)`);
        
        const bandwidthSaving = ((firstResponse.size - conditionalResponse.size) / firstResponse.size * 100).toFixed(1);
        log(`   💾 带宽节省: ${bandwidthSaving}%`, colors.green);
      } else {
        log(`   ⚠️  未返回 304，状态码: ${conditionalResponse.status}`, colors.yellow);
      }
    }

    // 计算缓存效果评分
    let score = 0;
    let maxScore = 0;

    // ETag 支持 (30分)
    maxScore += 30;
    if (etag) score += 30;

    // Cache-Control 支持 (20分)
    maxScore += 20;
    if (cacheControl) score += 20;

    // 响应时间改善 (25分)
    maxScore += 25;
    if (secondResponse.duration < firstResponse.duration) {
      score += Math.min(25, speedImprovement / 2);
    }

    // 304 支持 (25分)
    maxScore += 25;
    if (etag) {
      const conditionalResponse = await makeRequest(baseUrl + endpoint, {
        'If-None-Match': etag
      });
      if (conditionalResponse.status === 304) score += 25;
    }

    const finalScore = Math.round((score / maxScore) * 100);
    log(`\n📊 缓存效果评分: ${finalScore}/100`, 
        finalScore >= 80 ? colors.green : finalScore >= 60 ? colors.yellow : colors.red);

    return {
      endpoint,
      score: finalScore,
      hasETag: !!etag,
      hasCacheControl: !!cacheControl,
      speedImprovement: speedImprovement,
      supportsConditional: etag ? (await makeRequest(baseUrl + endpoint, {
        'If-None-Match': etag
      })).status === 304 : false
    };

  } catch (error) {
    log(`❌ 测试失败: ${error.message}`, colors.red);
    return {
      endpoint,
      score: 0,
      error: error.message
    };
  }
}

// 并发请求测试
async function testConcurrentRequests(endpoint, concurrency = 10) {
  log(`\n=== 并发测试: ${endpoint} (${concurrency} 个并发请求) ===`, colors.blue);
  
  const startTime = Date.now();
  const promises = Array(concurrency).fill().map(() => 
    makeRequest(baseUrl + endpoint)
  );
  
  try {
    const responses = await Promise.all(promises);
    const totalTime = Date.now() - startTime;
    const avgResponseTime = responses.reduce((sum, r) => sum + r.duration, 0) / responses.length;
    
    log(`✅ 所有请求完成`, colors.green);
    log(`   总耗时: ${totalTime}ms`);
    log(`   平均响应时间: ${avgResponseTime.toFixed(1)}ms`);
    log(`   成功率: ${responses.filter(r => r.status === 200).length}/${concurrency}`);
    
    // 检查响应一致性
    const firstResponseData = responses[0].data;
    const allIdentical = responses.every(r => r.data === firstResponseData);
    
    if (allIdentical) {
      log(`✅ 所有响应数据一致`, colors.green);
    } else {
      log(`⚠️  响应数据不一致`, colors.yellow);
    }

    return {
      totalTime,
      avgResponseTime,
      successRate: responses.filter(r => r.status === 200).length / concurrency,
      consistent: allIdentical
    };

  } catch (error) {
    log(`❌ 并发测试失败: ${error.message}`, colors.red);
    return { error: error.message };
  }
}

// 生成测试报告
function generateReport(results, concurrentResults) {
  log(`\n${'='.repeat(50)}`, colors.blue);
  log(`📋 缓存性能测试报告`, colors.blue);
  log(`${'='.repeat(50)}`, colors.blue);
  
  log(`\n📊 端点测试结果:`);
  results.forEach(result => {
    if (result.error) {
      log(`   ❌ ${result.endpoint}: 测试失败 (${result.error})`, colors.red);
    } else {
      log(`   ${result.score >= 80 ? '✅' : result.score >= 60 ? '⚠️ ' : '❌'} ${result.endpoint}: ${result.score}/100`, 
          result.score >= 80 ? colors.green : result.score >= 60 ? colors.yellow : colors.red);
      log(`      ETag: ${result.hasETag ? '✅' : '❌'} | Cache-Control: ${result.hasCacheControl ? '✅' : '❌'} | 304支持: ${result.supportsConditional ? '✅' : '❌'}`);
      if (result.speedImprovement !== undefined) {
        log(`      响应时间改善: ${result.speedImprovement}%`);
      }
    }
  });
  
  log(`\n🔄 并发测试结果:`);
  Object.entries(concurrentResults).forEach(([endpoint, result]) => {
    if (result.error) {
      log(`   ❌ ${endpoint}: ${result.error}`, colors.red);
    } else {
      log(`   ✅ ${endpoint}:`, colors.green);
      log(`      平均响应时间: ${result.avgResponseTime.toFixed(1)}ms`);
      log(`      成功率: ${(result.successRate * 100).toFixed(1)}%`);
      log(`      数据一致性: ${result.consistent ? '✅' : '❌'}`);
    }
  });

  // 总体评分
  const validResults = results.filter(r => !r.error);
  const avgScore = validResults.length > 0 
    ? validResults.reduce((sum, r) => sum + r.score, 0) / validResults.length 
    : 0;
  
  log(`\n🎯 总体缓存效果评分: ${avgScore.toFixed(1)}/100`, 
      avgScore >= 80 ? colors.green : avgScore >= 60 ? colors.yellow : colors.red);
  
  if (avgScore >= 80) {
    log(`✅ 缓存系统表现优秀！`, colors.green);
  } else if (avgScore >= 60) {
    log(`⚠️  缓存系统需要优化`, colors.yellow);
  } else {
    log(`❌ 缓存系统需要重大改进`, colors.red);
  }

  // 建议
  log(`\n💡 优化建议:`);
  const missingETag = validResults.filter(r => !r.hasETag);
  const missingCacheControl = validResults.filter(r => !r.hasCacheControl);
  const noConditional = validResults.filter(r => !r.supportsConditional);
  
  if (missingETag.length > 0) {
    log(`   📝 ${missingETag.length} 个端点缺少 ETag 支持`);
  }
  if (missingCacheControl.length > 0) {
    log(`   📝 ${missingCacheControl.length} 个端点缺少 Cache-Control 头`);
  }
  if (noConditional.length > 0) {
    log(`   📝 ${noConditional.length} 个端点不支持条件请求`);
  }
  
  log(`\n测试完成时间: ${new Date().toLocaleString()}`);
}

// 主测试函数
async function main() {
  log(`🚀 开始缓存性能测试`, colors.blue);
  log(`测试目标: ${baseUrl}`);
  
  // 测试各个端点
  const results = [];
  for (const endpoint of testEndpoints) {
    const result = await testEndpointCaching(endpoint);
    results.push(result);
    
    // 稍微延迟避免过快请求
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  // 并发测试
  const concurrentResults = {};
  for (const endpoint of testEndpoints.slice(0, 2)) { // 只测试前两个端点
    concurrentResults[endpoint] = await testConcurrentRequests(endpoint, 5);
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  
  // 生成报告
  generateReport(results, concurrentResults);
}

// 错误处理
process.on('unhandledRejection', (error) => {
  log(`❌ 未处理的错误: ${error.message}`, colors.red);
  process.exit(1);
});

if (require.main === module) {
  main().catch(error => {
    log(`❌ 测试失败: ${error.message}`, colors.red);
    process.exit(1);
  });
}

module.exports = { testEndpointCaching, testConcurrentRequests };
