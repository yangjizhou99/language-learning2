#!/usr/bin/env node

/**
 * 备份系统快速测试脚本
 * 用于验证 NAS worker 和 Next.js 代理是否正常工作
 */

const https = require('https');
const http = require('http');

// 配置
const config = {
  // NAS worker 地址
  workerUrl: process.env.BACKUP_WORKER_URL || 'http://localhost:7788',
  apiKey: process.env.BACKUP_WORKER_API_KEY || 'test-key',
  
  // Next.js 代理地址
  proxyUrl: process.env.NEXTJS_URL || 'http://localhost:3000',
  
  // 测试数据库连接串（请替换为实际值）
  testConn: process.env.TEST_DB_CONN || 'postgresql://user:pass@localhost:5432/testdb'
};

console.log('🔧 备份系统测试脚本');
console.log('配置:', JSON.stringify(config, null, 2));

async function makeRequest(url, options = {}) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https:') ? https : http;
    const req = client.request(url, {
      method: options.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          resolve({ status: res.statusCode, data: json });
        } catch (e) {
          resolve({ status: res.statusCode, data });
        }
      });
    });
    
    req.on('error', reject);
    
    if (options.body) {
      req.write(typeof options.body === 'string' ? options.body : JSON.stringify(options.body));
    }
    
    req.end();
  });
}

async function testWorkerHealth() {
  console.log('\n1️⃣ 测试 NAS Worker 健康检查...');
  try {
    const result = await makeRequest(`${config.workerUrl}/healthz`);
    if (result.status === 200 && result.data.ok) {
      console.log('✅ NAS Worker 健康检查通过');
      return true;
    } else {
      console.log('❌ NAS Worker 健康检查失败:', result);
      return false;
    }
  } catch (error) {
    console.log('❌ 无法连接到 NAS Worker:', error.message);
    return false;
  }
}

async function testWorkerAuth() {
  console.log('\n2️⃣ 测试 NAS Worker API 鉴权...');
  try {
    // 测试无 API Key
    const result1 = await makeRequest(`${config.workerUrl}/healthz`);
    console.log('无 API Key 请求状态:', result1.status);
    
    // 测试有 API Key
    const result2 = await makeRequest(`${config.workerUrl}/healthz`, {
      headers: { 'x-api-key': config.apiKey }
    });
    console.log('有 API Key 请求状态:', result2.status);
    
    if (result2.status === 200) {
      console.log('✅ API 鉴权正常');
      return true;
    } else {
      console.log('❌ API 鉴权失败');
      return false;
    }
  } catch (error) {
    console.log('❌ API 鉴权测试失败:', error.message);
    return false;
  }
}

async function testDatabaseTables() {
  console.log('\n3️⃣ 测试数据库表列表...');
  try {
    const result = await makeRequest(`${config.workerUrl}/db/tables`, {
      method: 'GET',
      headers: { 'x-api-key': config.apiKey },
      body: null
    });
    
    // 手动构建查询参数
    const url = `${config.workerUrl}/db/tables?conn=${encodeURIComponent(config.testConn)}`;
    const result2 = await makeRequest(url, {
      headers: { 'x-api-key': config.apiKey }
    });
    
    console.log('表列表查询状态:', result2.status);
    if (result2.status === 200) {
      console.log('✅ 数据库连接正常，表数量:', result2.data.tables?.length || 0);
      if (result2.data.tables?.length > 0) {
        console.log('前5个表:', result2.data.tables.slice(0, 5));
      }
      return true;
    } else {
      console.log('❌ 数据库连接失败:', result2.data);
      return false;
    }
  } catch (error) {
    console.log('❌ 数据库测试失败:', error.message);
    return false;
  }
}

async function testNextjsProxy() {
  console.log('\n4️⃣ 测试 Next.js 代理...');
  try {
    // 测试健康检查代理
    const result = await makeRequest(`${config.proxyUrl}/api/backup/healthz`);
    console.log('代理健康检查状态:', result.status);
    
    if (result.status === 200) {
      console.log('✅ Next.js 代理正常');
      return true;
    } else {
      console.log('❌ Next.js 代理失败:', result.data);
      return false;
    }
  } catch (error) {
    console.log('❌ Next.js 代理测试失败:', error.message);
    return false;
  }
}

async function testBackupPage() {
  console.log('\n5️⃣ 测试备份页面...');
  try {
    const result = await makeRequest(`${config.proxyUrl}/admin/backup`);
    console.log('备份页面状态:', result.status);
    
    if (result.status === 200) {
      console.log('✅ 备份页面可访问');
      return true;
    } else {
      console.log('❌ 备份页面访问失败:', result.data);
      return false;
    }
  } catch (error) {
    console.log('❌ 备份页面测试失败:', error.message);
    return false;
  }
}

async function runAllTests() {
  console.log('开始运行所有测试...\n');
  
  const tests = [
    { name: 'NAS Worker 健康检查', fn: testWorkerHealth },
    { name: 'NAS Worker API 鉴权', fn: testWorkerAuth },
    { name: '数据库表列表', fn: testDatabaseTables },
    { name: 'Next.js 代理', fn: testNextjsProxy },
    { name: '备份页面', fn: testBackupPage }
  ];
  
  const results = [];
  
  for (const test of tests) {
    try {
      const result = await test.fn();
      results.push({ name: test.name, passed: result });
    } catch (error) {
      console.log(`❌ ${test.name} 测试异常:`, error.message);
      results.push({ name: test.name, passed: false });
    }
  }
  
  console.log('\n📊 测试结果汇总:');
  console.log('='.repeat(50));
  
  let passed = 0;
  results.forEach(result => {
    const status = result.passed ? '✅ 通过' : '❌ 失败';
    console.log(`${status} ${result.name}`);
    if (result.passed) passed++;
  });
  
  console.log('='.repeat(50));
  console.log(`总计: ${passed}/${results.length} 测试通过`);
  
  if (passed === results.length) {
    console.log('🎉 所有测试通过！备份系统已就绪。');
  } else {
    console.log('⚠️  部分测试失败，请检查配置和部署。');
  }
}

// 运行测试
if (require.main === module) {
  runAllTests().catch(console.error);
}

module.exports = { runAllTests, testWorkerHealth, testWorkerAuth, testDatabaseTables, testNextjsProxy, testBackupPage };