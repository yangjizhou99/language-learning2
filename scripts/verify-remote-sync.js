#!/usr/bin/env node

/**
 * 验证远程数据库同步状态
 * 实际检查远程数据库的行数来验证同步是否成功
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

// 检查数据库连接和表行数
async function checkDatabaseStatus(client, name) {
  try {
    await client.connect();
    log(`✅ ${name} 数据库连接成功`, 'green');
    
    // 获取所有表
    const tablesResult = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `);
    
    const allTables = tablesResult.rows.map(row => row.table_name);
    log(`📋 ${name} 数据库表数量: ${allTables.length}`, 'cyan');
    
    // 检查关键表的数据行数
    const keyTables = [
      'article_drafts', 'cloze_drafts', 'cloze_items', 
      'shadowing_sessions', 'shadowing_themes', 'shadowing_drafts', 'shadowing_items',
      'voices', 'profiles', 'sessions'
    ];
    
    const tableStats = {};
    
    for (const tableName of keyTables) {
      try {
        const countResult = await client.query(`SELECT COUNT(*) as count FROM "${tableName}"`);
        const count = parseInt(countResult.rows[0].count);
        tableStats[tableName] = count;
        log(`  📊 ${tableName}: ${count} 行`, count > 0 ? 'green' : 'yellow');
      } catch (error) {
        tableStats[tableName] = 'ERROR';
        log(`  ❌ ${tableName}: 错误 - ${error.message}`, 'red');
      }
    }
    
    await client.end();
    return { success: true, tableStats, allTables };
    
  } catch (error) {
    log(`❌ ${name} 数据库连接失败: ${error.message}`, 'red');
    return { success: false, error: error.message };
  }
}

// 比较本地和远程数据库状态
function compareDatabaseStatus(localStats, prodStats) {
  log('\n📊 数据库状态比较', 'cyan');
  log('================================', 'cyan');
  
  if (!localStats.success || !prodStats.success) {
    log('❌ 无法比较数据库状态 - 连接失败', 'red');
    return;
  }
  
  const keyTables = Object.keys(localStats.tableStats);
  let syncIssues = [];
  
  log(`\n📋 关键表数据行数比较:`, 'blue');
  
  for (const tableName of keyTables) {
    const localCount = localStats.tableStats[tableName];
    const prodCount = prodStats.tableStats[tableName];
    
    let status = '✅';
    let color = 'green';
    let message = '';
    
    if (localCount === 'ERROR' || prodCount === 'ERROR') {
      status = '❌';
      color = 'red';
      message = '连接错误';
    } else if (localCount === prodCount) {
      if (localCount > 0) {
        message = '同步成功';
      } else {
        message = '都为空';
        color = 'yellow';
      }
    } else if (localCount > 0 && prodCount === 0) {
      status = '❌';
      color = 'red';
      message = '本地有数据但远程为空';
      syncIssues.push(`${tableName}: 本地${localCount}行，远程0行`);
    } else if (localCount > prodCount) {
      status = '⚠️';
      color = 'yellow';
      message = `本地数据比远程多 (${localCount} vs ${prodCount})`;
      syncIssues.push(`${tableName}: 本地${localCount}行，远程${prodCount}行`);
    } else {
      status = '⚠️';
      color = 'yellow';
      message = `数据不匹配 (${localCount} vs ${prodCount})`;
      syncIssues.push(`${tableName}: 本地${localCount}行，远程${prodCount}行`);
    }
    
    log(`  ${status} ${tableName}:`, color);
    log(`    本地: ${localCount}`, 'white');
    log(`    远程: ${prodCount}`, 'white');
    log(`    状态: ${message}`, 'white');
  }
  
  // 分析同步问题
  log(`\n🔍 同步问题分析:`, 'magenta');
  
  if (syncIssues.length === 0) {
    log('✅ 所有关键表同步状态正常', 'green');
  } else {
    log('❌ 发现以下同步问题:', 'red');
    syncIssues.forEach((issue, i) => {
      log(`  ${i + 1}. ${issue}`, 'red');
    });
  }
  
  return syncIssues;
}

// 主函数
async function main() {
  log('🔍 验证远程数据库同步状态', 'green');
  log('================================', 'cyan');
  
  // 加载环境变量
  loadEnv();
  
  if (!process.env.LOCAL_DB_URL || !process.env.PROD_DB_URL) {
    log('❌ 缺少数据库连接字符串', 'red');
    process.exit(1);
  }
  
  // 检查本地数据库
  log('\n🔍 检查本地数据库', 'blue');
  const localClient = new Client({ connectionString: process.env.LOCAL_DB_URL });
  const localStats = await checkDatabaseStatus(localClient, '本地');
  
  // 检查远程数据库
  log('\n🔍 检查远程数据库', 'blue');
  const prodClient = new Client({ connectionString: process.env.PROD_DB_URL });
  const prodStats = await checkDatabaseStatus(prodClient, '远程');
  
  // 比较数据库状态
  const syncIssues = compareDatabaseStatus(localStats, prodStats);
  
  // 提供解决建议
  log('\n💡 解决建议:', 'yellow');
  log('================================', 'cyan');
  
  if (syncIssues && syncIssues.length > 0) {
    log('1. 重新运行数据库同步', 'cyan');
    log('2. 使用高级同步模式', 'cyan');
    log('3. 检查同步日志中的错误信息', 'cyan');
    log('4. 确认远程数据库权限设置', 'cyan');
  } else {
    log('✅ 数据库同步状态正常', 'green');
    log('💡 如果仍有问题，请检查具体的错误日志', 'cyan');
  }
  
  log('\n🔧 下一步操作:', 'magenta');
  log('1. 访问: http://localhost:3001/admin/database-sync', 'cyan');
  log('2. 启用高级同步模式', 'cyan');
  log('3. 重新同步有问题的表', 'cyan');
}

// 运行主函数
if (require.main === module) {
  main().catch(console.error);
}

module.exports = { main, checkDatabaseStatus, compareDatabaseStatus };

