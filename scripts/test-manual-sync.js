#!/usr/bin/env node

/**
 * 手动同步测试工具
 * 测试单个表的数据同步，验证数据流向
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

// 测试单个表同步
async function testTableSync(localClient, prodClient, tableName) {
  try {
    log(`\n🔧 测试表 ${tableName} 的同步`, 'blue');
    
    // 获取本地数据
    const localResult = await localClient.query(`SELECT COUNT(*) as count FROM "${tableName}"`);
    const localCount = parseInt(localResult.rows[0].count);
    log(`  本地数据行数: ${localCount}`, 'cyan');
    
    if (localCount === 0) {
      log(`  ⚠️ 本地表 ${tableName} 为空，跳过同步`, 'yellow');
      return { success: true, message: '本地表为空' };
    }
    
    // 获取远程数据（同步前）
    const prodBeforeResult = await prodClient.query(`SELECT COUNT(*) as count FROM "${tableName}"`);
    const prodBeforeCount = parseInt(prodBeforeResult.rows[0].count);
    log(`  远程数据行数（同步前）: ${prodBeforeCount}`, 'cyan');
    
    // 清空远程表
    await prodClient.query(`TRUNCATE TABLE "${tableName}" CASCADE`);
    log(`  🗑️ 清空远程表 ${tableName}`, 'yellow');
    
    // 获取表结构
    const columnsResult = await localClient.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = $1
      ORDER BY ordinal_position
    `, [tableName]);
    
    const columns = columnsResult.rows.map(row => row.column_name);
    const columnNames = columns.map(col => `"${col}"`).join(', ');
    const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ');
    
    // 获取本地数据
    const localDataResult = await localClient.query(`SELECT * FROM "${tableName}" LIMIT 5`);
    const localRows = localDataResult.rows;
    
    log(`  📋 准备同步 ${localRows.length} 行数据（前5行）`, 'cyan');
    
    // 插入数据
    const insertQuery = `INSERT INTO "${tableName}" (${columnNames}) VALUES (${placeholders})`;
    
    let successCount = 0;
    const errors = [];
    
    for (let i = 0; i < localRows.length; i++) {
      const row = localRows[i];
      try {
        const values = columns.map(col => row[col]);
        await prodClient.query(insertQuery, values);
        successCount++;
        log(`    ✅ 行 ${i + 1}: 插入成功`, 'green');
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        errors.push(`行 ${i + 1}: ${errorMsg}`);
        log(`    ❌ 行 ${i + 1}: ${errorMsg}`, 'red');
      }
    }
    
    // 检查远程数据（同步后）
    const prodAfterResult = await prodClient.query(`SELECT COUNT(*) as count FROM "${tableName}"`);
    const prodAfterCount = parseInt(prodAfterResult.rows[0].count);
    log(`  远程数据行数（同步后）: ${prodAfterCount}`, 'cyan');
    
    if (successCount === localRows.length) {
      log(`  ✅ 表 ${tableName} 同步成功: ${successCount}/${localRows.length} 行`, 'green');
      return { 
        success: true, 
        message: `同步成功: ${successCount}/${localRows.length} 行`,
        synced: successCount,
        total: localRows.length
      };
    } else {
      log(`  ⚠️ 表 ${tableName} 同步部分成功: ${successCount}/${localRows.length} 行`, 'yellow');
      return { 
        success: false, 
        message: `部分成功: ${successCount}/${localRows.length} 行`,
        errors,
        synced: successCount,
        total: localRows.length
      };
    }
    
  } catch (error) {
    log(`  ❌ 表 ${tableName} 同步失败: ${error.message}`, 'red');
    return { 
      success: false, 
      message: `同步失败: ${error.message}`,
      error: error.message
    };
  }
}

// 主函数
async function main() {
  log('🧪 手动同步测试工具', 'green');
  log('================================', 'cyan');
  
  // 加载环境变量
  loadEnv();
  
  if (!process.env.LOCAL_DB_URL || !process.env.PROD_DB_URL) {
    log('❌ 缺少数据库连接字符串', 'red');
    process.exit(1);
  }
  
  const localClient = new Client({ connectionString: process.env.LOCAL_DB_URL });
  const prodClient = new Client({ connectionString: process.env.PROD_DB_URL });
  
  try {
    // 连接数据库
    await localClient.connect();
    await prodClient.connect();
    log('✅ 数据库连接成功', 'green');
    
    // 测试问题表
    const problemTables = [
      'article_drafts',
      'cloze_drafts', 
      'cloze_items',
      'shadowing_sessions',
      'shadowing_themes'
    ];
    
    const results = [];
    
    for (const tableName of problemTables) {
      const result = await testTableSync(localClient, prodClient, tableName);
      results.push({ table: tableName, ...result });
    }
    
    // 显示结果摘要
    log('\n📊 测试结果摘要', 'cyan');
    log('================================', 'cyan');
    
    let successCount = 0;
    let totalRows = 0;
    let syncedRows = 0;
    
    results.forEach(result => {
      const status = result.success ? '✅' : '❌';
      log(`${status} ${result.table}: ${result.message}`, result.success ? 'green' : 'red');
      
      if (result.success) successCount++;
      if (result.synced) syncedRows += result.synced;
      if (result.total) totalRows += result.total;
    });
    
    log(`\n📈 总体结果:`, 'blue');
    log(`  成功表数: ${successCount}/${results.length}`, 'white');
    log(`  同步行数: ${syncedRows}/${totalRows}`, 'white');
    
    if (successCount === results.length) {
      log('\n🎉 所有表同步测试成功！', 'green');
      log('💡 建议: 现在可以尝试完整的数据库同步', 'cyan');
    } else {
      log('\n⚠️ 部分表同步失败', 'yellow');
      log('💡 建议: 检查失败表的错误信息并修复', 'cyan');
    }
    
  } catch (error) {
    log(`❌ 测试过程中发生错误: ${error.message}`, 'red');
    console.error(error);
  } finally {
    await localClient.end();
    await prodClient.end();
    log('\n🔌 数据库连接已关闭', 'blue');
  }
}

// 运行主函数
if (require.main === module) {
  main().catch(console.error);
}

module.exports = { main, testTableSync };

