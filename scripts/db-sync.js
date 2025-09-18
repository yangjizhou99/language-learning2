#!/usr/bin/env node

/**
 * 数据库同步工具
 * 将本地数据库数据覆盖到云端数据库
 * 
 * 使用方法:
 * node scripts/db-sync.js
 */

const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

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
    process.exit(1);
  }
  
  log('✅ 环境变量检查通过', 'green');
}

// 获取所有表名
async function getAllTables(client) {
  const result = await client.query(`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_type = 'BASE TABLE'
    ORDER BY table_name
  `);
  return result.rows.map(row => row.table_name);
}

// 获取表数据行数
async function getTableRowCount(client, tableName) {
  const result = await client.query(`SELECT COUNT(*) as count FROM "${tableName}"`);
  return parseInt(result.rows[0].count);
}

// 同步单个表
async function syncTable(localClient, prodClient, tableName) {
  log(`\n🔄 开始同步表: ${tableName}`, 'blue');
  
  try {
    // 获取本地数据
    const localResult = await localClient.query(`SELECT * FROM "${tableName}"`);
    const localRows = localResult.rows;
    
    log(`📊 本地表 ${tableName} 有 ${localRows.length} 行数据`, 'cyan');
    
    if (localRows.length === 0) {
      log(`⚠️  本地表 ${tableName} 为空，跳过同步`, 'yellow');
      return { success: true, rowsProcessed: 0 };
    }
    
    // 开始事务
    await prodClient.query('BEGIN');
    
    try {
      // 清空目标表
      log(`🗑️  清空云端表 ${tableName}...`, 'yellow');
      await prodClient.query(`TRUNCATE TABLE "${tableName}" CASCADE`);
      
      // 插入数据
      log(`📤 插入数据到云端表 ${tableName}...`, 'cyan');
      
      if (localRows.length > 0) {
        // 获取列名
        const columns = Object.keys(localRows[0]);
        const columnNames = columns.map(col => `"${col}"`).join(', ');
        const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ');
        
        // 批量插入
        const insertQuery = `INSERT INTO "${tableName}" (${columnNames}) VALUES (${placeholders})`;
        
        for (const row of localRows) {
          const values = columns.map(col => row[col]);
          await prodClient.query(insertQuery, values);
        }
      }
      
      // 提交事务
      await prodClient.query('COMMIT');
      
      // 验证同步结果
      const prodCount = await getTableRowCount(prodClient, tableName);
      
      if (prodCount === localRows.length) {
        log(`✅ 表 ${tableName} 同步成功: ${prodCount} 行`, 'green');
        return { success: true, rowsProcessed: prodCount };
      } else {
        log(`❌ 表 ${tableName} 同步失败: 期望 ${localRows.length} 行，实际 ${prodCount} 行`, 'red');
        return { success: false, rowsProcessed: prodCount };
      }
      
    } catch (error) {
      await prodClient.query('ROLLBACK');
      throw error;
    }
    
  } catch (error) {
    log(`❌ 同步表 ${tableName} 失败: ${error.message}`, 'red');
    return { success: false, rowsProcessed: 0 };
  }
}

// 询问用户确认
function askConfirmation(question) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.toLowerCase().trim());
    });
  });
}

// 主函数
async function main() {
  log('🚀 数据库同步工具启动', 'green');
  log('================================', 'cyan');
  
  // 加载环境变量
  loadEnv();
  checkEnv();
  
  const localClient = new Client({ connectionString: process.env.LOCAL_DB_URL });
  const prodClient = new Client({ connectionString: process.env.PROD_DB_URL });
  
  try {
    // 连接数据库
    log('🔌 连接数据库...', 'blue');
    await localClient.connect();
    await prodClient.connect();
    log('✅ 数据库连接成功', 'green');
    
    // 获取所有表
    const tables = await getAllTables(localClient);
    log(`📋 发现 ${tables.length} 个表: ${tables.join(', ')}`, 'cyan');
    
    // 询问用户确认
    log('\n⚠️  警告: 这将清空云端数据库中的所有表并覆盖为本地数据!', 'red');
    log('请确保您已经备份了云端数据库的重要数据。', 'yellow');
    
    const confirm = await askConfirmation('\n确定要继续吗？(yes/no): ');
    
    if (confirm !== 'yes' && confirm !== 'y') {
      log('❌ 操作已取消', 'yellow');
      return;
    }
    
    // 开始同步
    const results = [];
    const startTime = Date.now();
    
    for (const tableName of tables) {
      const result = await syncTable(localClient, prodClient, tableName);
      results.push({ table: tableName, ...result });
    }
    
    const duration = Date.now() - startTime;
    
    // 显示结果摘要
    log('\n📊 同步结果摘要', 'cyan');
    log('================================', 'cyan');
    
    const successful = results.filter(r => r.success);
    const failed = results.filter(r => !r.success);
    
    log(`✅ 成功: ${successful.length} 个表`, 'green');
    log(`❌ 失败: ${failed.length} 个表`, failed.length > 0 ? 'red' : 'green');
    log(`⏱️  耗时: ${(duration / 1000).toFixed(2)} 秒`, 'cyan');
    
    if (successful.length > 0) {
      log('\n✅ 成功同步的表:', 'green');
      successful.forEach(r => {
        log(`  - ${r.table}: ${r.rowsProcessed} 行`, 'green');
      });
    }
    
    if (failed.length > 0) {
      log('\n❌ 同步失败的表:', 'red');
      failed.forEach(r => {
        log(`  - ${r.table}`, 'red');
      });
    }
    
  } catch (error) {
    log(`❌ 同步过程中发生错误: ${error.message}`, 'red');
    console.error(error);
  } finally {
    // 关闭连接
    await localClient.end();
    await prodClient.end();
    log('\n🔌 数据库连接已关闭', 'blue');
  }
}

// 运行主函数
if (require.main === module) {
  main().catch(console.error);
}

module.exports = { main, syncTable, getAllTables };
