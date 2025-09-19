#!/usr/bin/env node

/**
 * 调试同步问题
 * 测试单个表的同步过程，查看详细的错误信息
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

// 测试单个表的同步
async function testSingleTableSync(tableName) {
  const localClient = new Client({ connectionString: process.env.LOCAL_DB_URL });
  const prodClient = new Client({ connectionString: process.env.PROD_DB_URL });
  
  try {
    await localClient.connect();
    await prodClient.connect();
    
    log(`\n🔍 测试表: ${tableName}`, 'cyan');
    log('================================', 'cyan');
    
    // 1. 检查本地数据
    const localResult = await localClient.query(`SELECT * FROM "${tableName}" LIMIT 5`);
    const localRows = localResult.rows;
    log(`📊 本地数据行数: ${localRows.length}`, 'blue');
    
    if (localRows.length === 0) {
      log('⚠️ 本地表为空，跳过测试', 'yellow');
      return;
    }
    
    // 2. 检查表结构
    const columns = await localClient.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = $1
      ORDER BY ordinal_position
    `, [tableName]);
    
    log(`📋 表结构:`, 'blue');
    columns.rows.forEach(col => {
      log(`  ${col.column_name}: ${col.data_type} (${col.is_nullable === 'YES' ? 'nullable' : 'NOT NULL'})`, 'white');
    });
    
    // 3. 检查JSONB列
    const jsonbColumns = columns.rows.filter(col => col.data_type === 'jsonb');
    if (jsonbColumns.length > 0) {
      log(`\n🔍 JSONB列:`, 'magenta');
      jsonbColumns.forEach(col => {
        log(`  ${col.column_name}`, 'white');
      });
    }
    
    // 4. 测试第一行数据的插入
    if (localRows.length > 0) {
      const firstRow = localRows[0];
      log(`\n🧪 测试第一行数据插入:`, 'yellow');
      
      // 开始事务
      await prodClient.query('BEGIN');
      
      try {
        // 临时禁用外键检查
        await prodClient.query('SET session_replication_role = replica');
        
        // 清空目标表
        await prodClient.query(`TRUNCATE TABLE "${tableName}" CASCADE`);
        
        // 准备插入数据
        const columnNames = Object.keys(firstRow).map(col => `"${col}"`).join(', ');
        const placeholders = Object.keys(firstRow).map((_, i) => `$${i + 1}`).join(', ');
        const insertQuery = `INSERT INTO "${tableName}" (${columnNames}) VALUES (${placeholders})`;
        
        // 处理JSONB数据
        const values = Object.keys(firstRow).map(col => {
          const value = firstRow[col];
          if (typeof value === 'object' && value !== null) {
            return JSON.stringify(value);
          }
          return value;
        });
        
        log(`📝 插入查询: ${insertQuery}`, 'white');
        log(`📝 数据值:`, 'white');
        Object.keys(firstRow).forEach((col, i) => {
          const value = firstRow[col];
          const processedValue = values[i];
          log(`  ${col}: ${typeof value} -> ${typeof processedValue}`, 'white');
          if (typeof value === 'object' && value !== null) {
            log(`    原始: ${JSON.stringify(value, null, 2).substring(0, 100)}...`, 'white');
            log(`    处理: ${processedValue.substring(0, 100)}...`, 'white');
          }
        });
        
        // 执行插入
        await prodClient.query(insertQuery, values);
        log(`✅ 第一行插入成功`, 'green');
        
        // 验证插入结果
        const countResult = await prodClient.query(`SELECT COUNT(*) as count FROM "${tableName}"`);
        const count = parseInt(countResult.rows[0].count);
        log(`📊 插入后行数: ${count}`, 'green');
        
        // 提交事务
        await prodClient.query('COMMIT');
        
        // 恢复外键检查
        await prodClient.query('SET session_replication_role = DEFAULT');
        
      } catch (error) {
        await prodClient.query('ROLLBACK');
        await prodClient.query('SET session_replication_role = DEFAULT');
        log(`❌ 插入失败: ${error.message}`, 'red');
        log(`📝 错误详情: ${error.stack}`, 'red');
        throw error;
      }
    }
    
  } catch (error) {
    log(`❌ 测试失败: ${error.message}`, 'red');
    throw error;
  } finally {
    await localClient.end();
    await prodClient.end();
  }
}

// 主函数
async function main() {
  log('🔍 调试同步问题', 'green');
  log('================================', 'cyan');
  
  // 加载环境变量
  loadEnv();
  
  if (!process.env.LOCAL_DB_URL || !process.env.PROD_DB_URL) {
    log('❌ 缺少数据库连接字符串', 'red');
    process.exit(1);
  }
  
  // 测试有问题的表
  const problemTables = [
    'article_drafts',
    'cloze_drafts', 
    'cloze_items',
    'shadowing_sessions',
    'shadowing_themes',
    'shadowing_drafts',
    'shadowing_items'
  ];
  
  for (const tableName of problemTables) {
    try {
      await testSingleTableSync(tableName);
    } catch (error) {
      log(`❌ 表 ${tableName} 测试失败: ${error.message}`, 'red');
    }
  }
}

// 运行主函数
if (require.main === module) {
  main().catch(console.error);
}

module.exports = { testSingleTableSync };


