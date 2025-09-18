#!/usr/bin/env node

/**
 * 数据库同步测试脚本
 * 测试数据库连接和基本功能
 */

const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

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

// 加载环境变量
function loadEnv() {
  const envPath = path.join(process.cwd(), '.env.local');
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    const lines = envContent.split('\n');
    
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        const [key, ...valueParts] = trimmed.split('=');
        const value = valueParts.join('=');
        if (key && value) {
          process.env[key] = value;
        }
      }
    }
  }
}

// 检查环境变量
function checkEnv() {
  const required = ['LOCAL_DB_URL', 'PROD_DB_URL'];
  const missing = required.filter(key => !process.env[key]);
  
  if (missing.length > 0) {
    log(`❌ 缺少必需的环境变量: ${missing.join(', ')}`, 'red');
    log('请在 .env.local 文件中设置以下变量:', 'yellow');
    log('LOCAL_DB_URL=postgres://postgres:postgres@127.0.0.1:54322/postgres', 'cyan');
    log('PROD_DB_URL=postgres://postgres:<密码>@<主机>:5432/postgres', 'cyan');
    return false;
  }
  
  log('✅ 环境变量检查通过', 'green');
  return true;
}

// 测试数据库连接
async function testConnection(connectionString, name) {
  const client = new Client({ connectionString });
  
  try {
    await client.connect();
    log(`✅ ${name} 数据库连接成功`, 'green');
    
    // 测试查询
    const result = await client.query('SELECT version()');
    log(`📊 ${name} 数据库版本: ${result.rows[0].version.split(' ')[0]}`, 'cyan');
    
    // 获取表数量
    const tableResult = await client.query(`
      SELECT COUNT(*) as count 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_type = 'BASE TABLE'
    `);
    const tableCount = parseInt(tableResult.rows[0].count);
    log(`📋 ${name} 数据库表数量: ${tableCount}`, 'cyan');
    
    return { success: true, tableCount };
  } catch (error) {
    log(`❌ ${name} 数据库连接失败: ${error.message}`, 'red');
    return { success: false, error: error.message };
  } finally {
    await client.end();
  }
}

// 获取表列表
async function getTableList(connectionString, name) {
  const client = new Client({ connectionString });
  
  try {
    await client.connect();
    
    const result = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `);
    
    const tables = result.rows.map(row => row.table_name);
    log(`📋 ${name} 数据库表列表:`, 'cyan');
    tables.forEach(table => {
      log(`  - ${table}`, 'white');
    });
    
    return tables;
  } catch (error) {
    log(`❌ 获取 ${name} 表列表失败: ${error.message}`, 'red');
    return [];
  } finally {
    await client.end();
  }
}

// 比较表结构
async function compareTableStructure(localUrl, prodUrl) {
  const localClient = new Client({ connectionString: localUrl });
  const prodClient = new Client({ connectionString: prodUrl });
  
  try {
    await localClient.connect();
    await prodClient.connect();
    
    // 获取本地表列表
    const localTables = await getTableList(localUrl, '本地');
    const prodTables = await getTableList(prodUrl, '云端');
    
    // 找出差异
    const onlyInLocal = localTables.filter(table => !prodTables.includes(table));
    const onlyInProd = prodTables.filter(table => !localTables.includes(table));
    const common = localTables.filter(table => prodTables.includes(table));
    
    log('\n📊 表结构比较:', 'blue');
    log(`✅ 共同表: ${common.length} 个`, 'green');
    log(`⚠️  仅在本地: ${onlyInLocal.length} 个`, onlyInLocal.length > 0 ? 'yellow' : 'green');
    log(`⚠️  仅在云端: ${onlyInProd.length} 个`, onlyInProd.length > 0 ? 'yellow' : 'green');
    
    if (onlyInLocal.length > 0) {
      log('仅在本地存在的表:', 'yellow');
      onlyInLocal.forEach(table => log(`  - ${table}`, 'yellow'));
    }
    
    if (onlyInProd.length > 0) {
      log('仅在云端存在的表:', 'yellow');
      onlyInProd.forEach(table => log(`  - ${table}`, 'yellow'));
    }
    
    return { common, onlyInLocal, onlyInProd };
  } catch (error) {
    log(`❌ 比较表结构失败: ${error.message}`, 'red');
    return { common: [], onlyInLocal: [], onlyInProd: [] };
  } finally {
    await localClient.end();
    await prodClient.end();
  }
}

// 主函数
async function main() {
  log('🧪 数据库同步测试工具', 'green');
  log('================================', 'cyan');
  
  // 加载环境变量
  loadEnv();
  
  if (!checkEnv()) {
    process.exit(1);
  }
  
  // 测试本地数据库连接
  log('\n🔌 测试本地数据库连接...', 'blue');
  const localResult = await testConnection(process.env.LOCAL_DB_URL, '本地');
  
  // 测试云端数据库连接
  log('\n🔌 测试云端数据库连接...', 'blue');
  const prodResult = await testConnection(process.env.PROD_DB_URL, '云端');
  
  if (!localResult.success || !prodResult.success) {
    log('\n❌ 数据库连接测试失败，请检查配置', 'red');
    process.exit(1);
  }
  
  // 比较表结构
  log('\n📊 比较数据库表结构...', 'blue');
  const comparison = await compareTableStructure(process.env.LOCAL_DB_URL, process.env.PROD_DB_URL);
  
  // 测试结果摘要
  log('\n📋 测试结果摘要', 'cyan');
  log('================================', 'cyan');
  log(`✅ 本地数据库: 连接成功, ${localResult.tableCount} 个表`, 'green');
  log(`✅ 云端数据库: 连接成功, ${prodResult.tableCount} 个表`, 'green');
  log(`📊 共同表: ${comparison.common.length} 个`, 'cyan');
  log(`⚠️  结构差异: ${comparison.onlyInLocal.length + comparison.onlyInProd.length} 个表`, 
      comparison.onlyInLocal.length + comparison.onlyInProd.length > 0 ? 'yellow' : 'green');
  
  if (comparison.common.length > 0) {
    log('\n✅ 可以同步的表:', 'green');
    comparison.common.forEach(table => log(`  - ${table}`, 'green'));
  }
  
  if (comparison.onlyInLocal.length > 0) {
    log('\n⚠️  仅在本地存在的表（同步时会被创建）:', 'yellow');
    comparison.onlyInLocal.forEach(table => log(`  - ${table}`, 'yellow'));
  }
  
  if (comparison.onlyInProd.length > 0) {
    log('\n⚠️  仅在云端存在的表（同步时不会被影响）:', 'yellow');
    comparison.onlyInProd.forEach(table => log(`  - ${table}`, 'yellow'));
  }
  
  log('\n🎉 测试完成！数据库连接正常，可以开始同步。', 'green');
  log('💡 建议: 使用 Web 界面 (http://localhost:3000/admin/database-sync) 进行同步', 'cyan');
}

// 运行主函数
if (require.main === module) {
  main().catch(console.error);
}

module.exports = { main, testConnection, compareTableStructure };
