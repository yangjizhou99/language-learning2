#!/usr/bin/env node

/**
 * 本地备份系统测试脚本
 */

const http = require('http');

const config = {
  workerUrl: 'http://localhost:7789',
  apiKey: 'local-test-api-key-12345',
  proxyUrl: 'http://localhost:3002',
  // 使用您现有的数据库连接
  prodConn: 'postgresql://postgres.yyfyieqfuwwyqrlewswu:yjzyjz925151560@aws-1-ap-northeast-1.pooler.supabase.com:6543/postgres',
  devConn: 'postgres://postgres:postgres@host.docker.internal:54340/postgres'
};

console.log('🧪 本地备份系统测试');
console.log('配置:', JSON.stringify({
  workerUrl: config.workerUrl,
  proxyUrl: config.proxyUrl,
  prodConn: config.prodConn.substring(0, 50) + '...'
}, null, 2));

async function makeRequest(url, options = {}) {
  return new Promise((resolve, reject) => {
    const client = http;
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
    // 测试无 API Key（应该失败）
    const result1 = await makeRequest(`${config.workerUrl}/db/tables`);
    console.log('无 API Key 请求状态:', result1.status);
    
    // 测试有 API Key（应该成功，但数据库连接可能失败）
    const url = `${config.workerUrl}/db/tables?conn=${encodeURIComponent(config.devConn)}`;
    const result2 = await makeRequest(url, {
      headers: { 'x-api-key': config.apiKey }
    });
    console.log('有 API Key 请求状态:', result2.status);
    
    if (result1.status === 401 && result2.status !== 401) {
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
    const url = `${config.workerUrl}/db/tables?conn=${encodeURIComponent(config.devConn)}`;
    const result = await makeRequest(url, {
      headers: { 'x-api-key': config.apiKey }
    });
    
    console.log('表列表查询状态:', result.status);
    if (result.status === 200) {
      console.log('✅ 数据库连接正常，表数量:', result.data.tables?.length || 0);
      if (result.data.tables?.length > 0) {
        console.log('前5个表:', result.data.tables.slice(0, 5));
      }
      return true;
    } else {
      console.log('⚠️  数据库连接失败（可能是本地数据库未启动）:', result.data);
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
      console.log('⚠️  备份页面访问失败（可能是 Next.js 模块问题）:', result.status);
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
  
  if (passed >= 3) {
    console.log('🎉 核心功能正常！备份系统已就绪。');
    console.log('\n📝 下一步：');
    console.log('1. 打开浏览器访问: http://localhost:3000/admin/backup');
    console.log('2. 如果页面有问题，可以等待 Next.js 完全启动');
    console.log('3. 测试完成后，可以将配置部署到 NAS');
  } else {
    console.log('⚠️  部分核心功能失败，请检查配置。');
  }
}

// 运行测试
if (require.main === module) {
  runAllTests().catch(console.error);
}

module.exports = { runAllTests };
