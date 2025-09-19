#!/usr/bin/env node

/**
 * 管理员页面测试脚本
 * 测试数据库同步页面是否可以正常访问
 */

const http = require('http');
const https = require('https');

// 颜色输出
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

// 测试页面访问
async function testPage(url, name) {
  return new Promise((resolve) => {
    const client = url.startsWith('https') ? https : http;
    
    const req = client.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode === 200) {
          log(`✅ ${name}: 页面可访问 (${res.statusCode})`, 'green');
          resolve({ success: true, statusCode: res.statusCode });
        } else {
          log(`⚠️  ${name}: 状态码 ${res.statusCode}`, 'yellow');
          resolve({ success: false, statusCode: res.statusCode });
        }
      });
    });
    
    req.on('error', (error) => {
      log(`❌ ${name}: 连接失败 - ${error.message}`, 'red');
      resolve({ success: false, error: error.message });
    });
    
    req.setTimeout(5000, () => {
      req.destroy();
      log(`❌ ${name}: 连接超时`, 'red');
      resolve({ success: false, error: 'timeout' });
    });
  });
}

// 主函数
async function main() {
  log('🧪 管理员页面测试工具', 'green');
  log('================================', 'cyan');
  
  const baseUrl = 'http://localhost:3000';
  const pages = [
    { url: `${baseUrl}/admin`, name: '管理员控制台' },
    { url: `${baseUrl}/admin/database-sync`, name: '数据库同步页面' },
    { url: `${baseUrl}/api/admin/database/test-connection`, name: '连接测试API' },
    { url: `${baseUrl}/api/admin/database/sync`, name: '同步API' },
  ];
  
  log('🔍 开始测试页面访问...', 'blue');
  log('');
  
  const results = [];
  
  for (const page of pages) {
    const result = await testPage(page.url, page.name);
    results.push({ ...page, ...result });
    
    // 等待一下避免请求过快
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  // 显示结果摘要
  log('\n📊 测试结果摘要', 'cyan');
  log('================================', 'cyan');
  
  const successful = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);
  
  log(`✅ 成功: ${successful.length} 个页面`, 'green');
  log(`❌ 失败: ${failed.length} 个页面`, failed.length > 0 ? 'red' : 'green');
  
  if (successful.length > 0) {
    log('\n✅ 成功访问的页面:', 'green');
    successful.forEach(r => {
      log(`  - ${r.name}: ${r.url}`, 'green');
    });
  }
  
  if (failed.length > 0) {
    log('\n❌ 访问失败的页面:', 'red');
    failed.forEach(r => {
      log(`  - ${r.name}: ${r.error || `状态码 ${r.statusCode}`}`, 'red');
    });
  }
  
  log('\n💡 提示:', 'yellow');
  log('1. 确保开发服务器正在运行: pnpm dev', 'cyan');
  log('2. 确保已登录管理员账户', 'cyan');
  log('3. 检查环境变量配置', 'cyan');
  
  if (failed.length === 0) {
    log('\n🎉 所有页面测试通过！', 'green');
  } else {
    log('\n⚠️  部分页面测试失败，请检查配置', 'yellow');
  }
}

// 运行主函数
if (require.main === module) {
  main().catch(console.error);
}

module.exports = { main, testPage };


