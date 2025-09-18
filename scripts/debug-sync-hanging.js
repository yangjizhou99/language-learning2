#!/usr/bin/env node

/**
 * 调试同步卡住问题
 * 检查同步过程中的具体错误和超时问题
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

// 测试单个表的同步（带超时）
async function testTableSyncWithTimeout(tableName, timeoutMs = 30000) {
  const localClient = new Client({ connectionString: process.env.LOCAL_DB_URL });
  const prodClient = new Client({ connectionString: process.env.PROD_DB_URL });
  
  return new Promise(async (resolve) => {
    const timeout = setTimeout(() => {
      log(`⏰ 表 ${tableName} 同步超时 (${timeoutMs}ms)`, 'red');
      resolve({ success: false, error: '超时', duration: timeoutMs });
    }, timeoutMs);
    
    try {
      const startTime = Date.now();
      await localClient.connect();
      await prodClient.connect();
      
      log(`🔍 开始同步表: ${tableName}`, 'cyan');
      
      // 获取本地数据
      const localResult = await localClient.query(`SELECT * FROM "${tableName}"`);
      const localRows = localResult.rows;
      
      if (localRows.length === 0) {
        clearTimeout(timeout);
        await localClient.end();
        await prodClient.end();
        resolve({ success: true, message: '本地表为空', duration: Date.now() - startTime });
        return;
      }
      
      log(`📊 本地数据行数: ${localRows.length}`, 'blue');
      
      // 获取表结构信息
      const columnInfos = await localClient.query(`
        SELECT column_name, data_type, udt_name
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = $1
        ORDER BY ordinal_position
      `, [tableName]);
      
      const columnMap = new Map(columnInfos.rows.map(col => [col.column_name, col]));
      
      // 开始事务
      await prodClient.query('BEGIN');
      
      try {
        // 临时禁用外键检查
        await prodClient.query('SET session_replication_role = replica');
        
        // 清空目标表
        await prodClient.query(`TRUNCATE TABLE "${tableName}" CASCADE`);
        
        // 插入数据
        const columns = Object.keys(localRows[0]);
        const columnNames = columns.map(col => `"${col}"`).join(', ');
        const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ');
        const insertQuery = `INSERT INTO "${tableName}" (${columnNames}) VALUES (${placeholders})`;
        
        let successCount = 0;
        for (let i = 0; i < localRows.length; i++) {
          const row = localRows[i];
          try {
            // 处理列值
            const values = columns.map(col => {
              const value = row[col];
              const columnInfo = columnMap.get(col);
              
              // 处理数组类型
              if (columnInfo.udt_name === 'uuid' && Array.isArray(value)) {
                return value;
              }
              
              // 处理JSONB类型
              if (columnInfo.data_type === 'jsonb') {
                if (typeof value === 'object' && value !== null) {
                  return JSON.stringify(value);
                }
                return value;
              }
              
              // 处理其他对象类型
              if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
                if (value instanceof Date) {
                  return value.toISOString();
                }
                return String(value);
              }
              
              return value;
            });
            
            await prodClient.query(insertQuery, values);
            successCount++;
            
            if (i % 100 === 0) {
              log(`  📝 已处理 ${i + 1}/${localRows.length} 行`, 'white');
            }
          } catch (error) {
            log(`  ❌ 行 ${i + 1} 插入失败: ${error.message}`, 'red');
            // 继续处理下一行
          }
        }
        
        // 恢复外键检查
        await prodClient.query('SET session_replication_role = DEFAULT');
        
        // 提交事务
        await prodClient.query('COMMIT');
        
        // 验证同步结果
        const prodCount = await prodClient.query(`SELECT COUNT(*) as count FROM "${tableName}"`);
        const finalCount = parseInt(prodCount.rows[0].count);
        
        clearTimeout(timeout);
        await localClient.end();
        await prodClient.end();
        
        resolve({
          success: true,
          message: `同步成功: ${successCount}/${localRows.length} 行`,
          duration: Date.now() - startTime,
          rowsProcessed: finalCount
        });
        
      } catch (error) {
        await prodClient.query('ROLLBACK');
        await prodClient.query('SET session_replication_role = DEFAULT');
        clearTimeout(timeout);
        await localClient.end();
        await prodClient.end();
        resolve({ success: false, error: error.message, duration: Date.now() - startTime });
      }
      
    } catch (error) {
      clearTimeout(timeout);
      await localClient.end();
      await prodClient.end();
      resolve({ success: false, error: error.message, duration: Date.now() - startTime });
    }
  });
}

// 主函数
async function main() {
  log('🔍 调试同步卡住问题', 'green');
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
  
  log(`\n🧪 测试 ${problemTables.length} 个有问题的表`, 'yellow');
  log('每个表超时时间: 30秒', 'yellow');
  
  for (const tableName of problemTables) {
    log(`\n${'='.repeat(50)}`, 'cyan');
    const result = await testTableSyncWithTimeout(tableName, 30000);
    
    if (result.success) {
      log(`✅ ${tableName}: ${result.message} (${result.duration}ms)`, 'green');
    } else {
      log(`❌ ${tableName}: ${result.error} (${result.duration}ms)`, 'red');
    }
  }
  
  log(`\n🎉 调试完成`, 'green');
}

// 运行主函数
if (require.main === module) {
  main().catch(console.error);
}

module.exports = { testTableSyncWithTimeout };
