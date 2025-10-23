#!/usr/bin/env node

/**
 * 生词本性能测试脚本
 * 
 * 用途：测试优化前后的加载性能
 * 使用方法：node scripts/test-vocab-performance.js
 */

const https = require('https');
const http = require('http');

// 配置
const API_BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
const AUTH_TOKEN = process.env.TEST_AUTH_TOKEN; // 需要设置测试用户的 access_token

// 颜色输出
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  blue: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

// 发送HTTP请求
function makeRequest(url, token) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const protocol = urlObj.protocol === 'https:' ? https : http;
    
    const options = {
      hostname: urlObj.hostname,
      port: urlObj.port || (urlObj.protocol === 'https:' ? 443 : 80),
      path: urlObj.pathname + urlObj.search,
      method: 'GET',
      headers: token ? { 'Authorization': `Bearer ${token}` } : {}
    };

    const startTime = Date.now();

    const req = protocol.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        const endTime = Date.now();
        const duration = endTime - startTime;

        try {
          const json = JSON.parse(data);
          resolve({
            status: res.statusCode,
            duration,
            data: json
          });
        } catch (e) {
          reject(new Error('Invalid JSON response'));
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    req.setTimeout(30000, () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });

    req.end();
  });
}

// 性能测试
async function testVocabDashboardPerformance() {
  log('\n====================================', 'bright');
  log('  生词本性能测试', 'bright');
  log('====================================\n', 'bright');

  if (!AUTH_TOKEN) {
    log('⚠️  警告: 未设置 TEST_AUTH_TOKEN 环境变量', 'yellow');
    log('   将进行未认证测试（仅限公开端点）\n', 'yellow');
  }

  // 测试场景
  const testCases = [
    {
      name: '基础查询（10条记录）',
      url: `${API_BASE_URL}/api/vocab/dashboard?page=1&limit=10`
    },
    {
      name: '中等查询（50条记录）',
      url: `${API_BASE_URL}/api/vocab/dashboard?page=1&limit=50`
    },
    {
      name: '带语言筛选',
      url: `${API_BASE_URL}/api/vocab/dashboard?page=1&limit=10&lang=en`
    },
    {
      name: '带状态筛选',
      url: `${API_BASE_URL}/api/vocab/dashboard?page=1&limit=10&status=new`
    },
    {
      name: '带解释筛选（有解释）',
      url: `${API_BASE_URL}/api/vocab/dashboard?page=1&limit=10&explanation=has`
    },
    {
      name: '组合筛选',
      url: `${API_BASE_URL}/api/vocab/dashboard?page=1&limit=10&lang=en&status=starred`
    }
  ];

  const results = [];

  log('🚀 开始测试...\n', 'blue');

  for (const testCase of testCases) {
    log(`测试: ${testCase.name}`, 'bright');
    
    try {
      // 预热请求
      await makeRequest(testCase.url, AUTH_TOKEN);
      
      // 正式测试（运行3次取平均值）
      const times = [];
      for (let i = 0; i < 3; i++) {
        const result = await makeRequest(testCase.url, AUTH_TOKEN);
        times.push(result.duration);
        
        if (i === 0) {
          // 第一次请求时显示详细信息
          log(`  状态码: ${result.status}`, 'reset');
          if (result.data.entries) {
            log(`  返回记录数: ${result.data.entries.length}`, 'reset');
            log(`  总记录数: ${result.data.pagination?.total || 0}`, 'reset');
          }
        }
      }

      const avgTime = Math.round(times.reduce((a, b) => a + b, 0) / times.length);
      const minTime = Math.min(...times);
      const maxTime = Math.max(...times);

      log(`  平均响应时间: ${avgTime}ms`, avgTime < 200 ? 'green' : avgTime < 500 ? 'yellow' : 'red');
      log(`  最快: ${minTime}ms | 最慢: ${maxTime}ms\n`, 'reset');

      results.push({
        name: testCase.name,
        avgTime,
        minTime,
        maxTime
      });

    } catch (error) {
      log(`  ❌ 错误: ${error.message}\n`, 'red');
      results.push({
        name: testCase.name,
        error: error.message
      });
    }
  }

  // 输出汇总
  log('\n====================================', 'bright');
  log('  测试结果汇总', 'bright');
  log('====================================\n', 'bright');

  const successResults = results.filter(r => !r.error);
  
  if (successResults.length > 0) {
    const totalAvg = Math.round(
      successResults.reduce((sum, r) => sum + r.avgTime, 0) / successResults.length
    );

    log(`总体平均响应时间: ${totalAvg}ms`, totalAvg < 200 ? 'green' : totalAvg < 500 ? 'yellow' : 'red');
    log('', 'reset');

    // 性能评级
    if (totalAvg < 100) {
      log('✨ 优秀！性能表现卓越', 'green');
    } else if (totalAvg < 200) {
      log('✅ 良好！性能符合预期', 'green');
    } else if (totalAvg < 500) {
      log('⚠️  一般，建议进一步优化', 'yellow');
    } else {
      log('❌ 较慢，需要优化', 'red');
    }

    // 详细结果表格
    log('\n详细结果:', 'bright');
    log('─'.repeat(60), 'reset');
    successResults.forEach(r => {
      const status = r.avgTime < 200 ? '✓' : r.avgTime < 500 ? '~' : '✗';
      const color = r.avgTime < 200 ? 'green' : r.avgTime < 500 ? 'yellow' : 'red';
      log(`${status} ${r.name.padEnd(30)} ${r.avgTime}ms`, color);
    });
    log('─'.repeat(60), 'reset');
  }

  // 优化建议
  log('\n💡 性能优化建议:', 'blue');
  log('1. 确保已运行数据库迁移: supabase/migrations/20251023120000_optimize_vocab_performance.sql');
  log('2. 检查数据库索引是否生效');
  log('3. 如果响应时间仍然较长，考虑：');
  log('   - 增加数据库连接池大小');
  log('   - 实现Redis缓存');
  log('   - 使用CDN加速API请求');
  log('', 'reset');

  const errorResults = results.filter(r => r.error);
  if (errorResults.length > 0) {
    log('\n❌ 失败的测试:', 'red');
    errorResults.forEach(r => {
      log(`  - ${r.name}: ${r.error}`, 'red');
    });
  }

  log('\n测试完成！', 'bright');
}

// 运行测试
testVocabDashboardPerformance().catch(error => {
  log(`\n❌ 测试失败: ${error.message}`, 'red');
  process.exit(1);
});

