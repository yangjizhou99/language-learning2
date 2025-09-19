#!/usr/bin/env node

/**
 * 数据库同步问题诊断工具
 * 检查本地和远程数据库的连接状态和数据
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

// 检查数据库连接
async function checkDatabaseConnection(connectionString, name) {
  const client = new Client({ connectionString });
  
  try {
    await client.connect();
    log(`✅ ${name} 数据库连接成功`, 'green');
    
    // 获取数据库信息
    const versionResult = await client.query('SELECT version()');
    const version = versionResult.rows[0].version.split(' ')[0];
    
    // 获取表数量
    const tableResult = await client.query(`
      SELECT COUNT(*) as count 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
    `);
    
    const tableCount = parseInt(tableResult.rows[0].count);
    
    // 获取一些关键表的数据行数
    const keyTables = [
      'article_drafts', 'cloze_drafts', 'cloze_items', 
      'shadowing_sessions', 'shadowing_themes', 'voices'
    ];
    
    const tableStats = {};
    for (const tableName of keyTables) {
      try {
        const countResult = await client.query(`SELECT COUNT(*) as count FROM "${tableName}"`);
        tableStats[tableName] = parseInt(countResult.rows[0].count);
      } catch (error) {
        tableStats[tableName] = 'ERROR';
      }
    }
    
    await client.end();
    
    return {
      success: true,
      version,
      tableCount,
      tableStats
    };
  } catch (error) {
    log(`❌ ${name} 数据库连接失败: ${error.message}`, 'red');
    return {
      success: false,
      error: error.message
    };
  }
}

// 比较数据库状态
function compareDatabases(localInfo, prodInfo) {
  log('\n📊 数据库状态比较', 'cyan');
  log('================================', 'cyan');
  
  if (!localInfo.success || !prodInfo.success) {
    log('❌ 无法比较数据库状态 - 连接失败', 'red');
    return;
  }
  
  log(`📋 数据库版本:`, 'blue');
  log(`  本地: ${localInfo.version}`, 'white');
  log(`  远程: ${prodInfo.version}`, 'white');
  
  log(`\n📋 表数量:`, 'blue');
  log(`  本地: ${localInfo.tableCount}`, 'white');
  log(`  远程: ${prodInfo.tableCount}`, 'white');
  
  log(`\n📋 关键表数据行数:`, 'blue');
  const keyTables = Object.keys(localInfo.tableStats);
  
  for (const tableName of keyTables) {
    const localCount = localInfo.tableStats[tableName];
    const prodCount = prodInfo.tableStats[tableName];
    
    let status = '✅';
    let color = 'green';
    
    if (localCount === 'ERROR' || prodCount === 'ERROR') {
      status = '❌';
      color = 'red';
    } else if (localCount !== prodCount) {
      status = '⚠️';
      color = 'yellow';
    }
    
    log(`  ${status} ${tableName}:`, color);
    log(`    本地: ${localCount}`, 'white');
    log(`    远程: ${prodCount}`, 'white');
  }
  
  // 分析问题
  log('\n🔍 问题分析:', 'magenta');
  const issues = [];
  
  if (localInfo.tableCount !== prodInfo.tableCount) {
    issues.push('表数量不匹配');
  }
  
  for (const tableName of keyTables) {
    const localCount = localInfo.tableStats[tableName];
    const prodCount = prodInfo.tableStats[tableName];
    
    if (localCount !== 'ERROR' && prodCount !== 'ERROR' && localCount !== prodCount) {
      if (localCount > 0 && prodCount === 0) {
        issues.push(`${tableName} 表：本地有数据但远程为空`);
      } else if (localCount > prodCount) {
        issues.push(`${tableName} 表：本地数据比远程多`);
      }
    }
  }
  
  if (issues.length === 0) {
    log('✅ 数据库状态一致，没有发现问题', 'green');
  } else {
    log('⚠️ 发现以下问题:', 'yellow');
    issues.forEach((issue, i) => {
      log(`  ${i + 1}. ${issue}`, 'yellow');
    });
  }
  
  return issues;
}

// 检查环境变量
function checkEnvironmentVariables() {
  log('🔧 环境变量检查', 'blue');
  log('================================', 'cyan');
  
  const requiredVars = [
    'LOCAL_DB_URL',
    'PROD_DB_URL',
    'NEXT_PUBLIC_SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    'SUPABASE_SERVICE_ROLE_KEY'
  ];
  
  const missingVars = [];
  
  for (const varName of requiredVars) {
    const value = process.env[varName];
    if (!value) {
      missingVars.push(varName);
      log(`❌ ${varName}: 未设置`, 'red');
    } else {
      // 隐藏敏感信息
      const displayValue = varName.includes('KEY') || varName.includes('URL') 
        ? value.substring(0, 20) + '...' 
        : value;
      log(`✅ ${varName}: ${displayValue}`, 'green');
    }
  }
  
  if (missingVars.length > 0) {
    log(`\n⚠️ 缺少环境变量: ${missingVars.join(', ')}`, 'yellow');
    return false;
  }
  
  log('\n✅ 所有必需的环境变量都已设置', 'green');
  return true;
}

// 主函数
async function main() {
  log('🔍 数据库同步问题诊断工具', 'green');
  log('================================', 'cyan');
  
  // 加载环境变量
  loadEnv();
  
  // 检查环境变量
  const envOk = checkEnvironmentVariables();
  if (!envOk) {
    log('\n❌ 环境变量配置不完整，请检查 .env.local 文件', 'red');
    process.exit(1);
  }
  
  // 检查本地数据库
  log('\n🔍 检查本地数据库', 'blue');
  const localInfo = await checkDatabaseConnection(process.env.LOCAL_DB_URL, '本地');
  
  // 检查远程数据库
  log('\n🔍 检查远程数据库', 'blue');
  const prodInfo = await checkDatabaseConnection(process.env.PROD_DB_URL, '远程');
  
  // 比较数据库状态
  const issues = compareDatabases(localInfo, prodInfo);
  
  // 提供解决建议
  log('\n💡 解决建议:', 'yellow');
  log('================================', 'cyan');
  
  if (issues && issues.length > 0) {
    log('1. 检查同步日志中的错误信息', 'cyan');
    log('2. 确认远程数据库连接字符串正确', 'cyan');
    log('3. 检查远程数据库权限设置', 'cyan');
    log('4. 尝试重新运行同步', 'cyan');
    log('5. 检查网络连接和防火墙设置', 'cyan');
  } else {
    log('✅ 数据库状态正常，如果同步仍然失败，请检查:', 'green');
    log('1. 同步过程中的错误日志', 'cyan');
    log('2. 网络连接稳定性', 'cyan');
    log('3. 数据库事务回滚', 'cyan');
  }
  
  log('\n🔧 下一步操作:', 'magenta');
  log('1. 运行: node scripts/test-sync.js (测试同步)', 'cyan');
  log('2. 检查: 数据库同步页面的详细日志', 'cyan');
  log('3. 验证: 远程数据库的权限和连接', 'cyan');
}

// 运行主函数
if (require.main === module) {
  main().catch(console.error);
}

module.exports = { main, checkDatabaseConnection, compareDatabases };


