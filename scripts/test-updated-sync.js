#!/usr/bin/env node

/**
 * 测试更新后的同步功能
 * 基于成功页面的连接池实现
 */

const { Pool } = require('pg');
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

// 创建连接池
function createPools() {
  const localPool = new Pool({
    connectionString: process.env.LOCAL_DB_URL,
    max: 5,
    idleTimeoutMillis: 30000,
  });

  const prodPool = new Pool({
    connectionString: process.env.PROD_DB_URL,
    max: 5,
    idleTimeoutMillis: 30000,
  });

  return { localPool, prodPool };
}

// 处理列值，根据数据类型进行适当的转换
function processColumnValue(value, columnInfo) {
  if (value === null || value === undefined) {
    return null;
  }
  
  // 处理数组类型
  if (columnInfo.udt_name === 'uuid' && Array.isArray(value)) {
    return value; // PostgreSQL 数组，直接返回
  }
  
  // 处理JSONB类型
  if (columnInfo.data_type === 'jsonb') {
    if (typeof value === 'object' && value !== null) {
      return JSON.stringify(value);
    }
    return value;
  }
  
  // 处理其他对象类型（如日期）
  if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
    // 检查是否是日期对象
    if (value instanceof Date) {
      return value.toISOString();
    }
    // 其他对象类型，尝试转换为字符串
    return String(value);
  }
  
  return value;
}

// 测试单个表的同步（使用连接池）
async function testTableSyncWithPool(tableName) {
  const { localPool, prodPool } = createPools();
  let localClient = null;
  let prodClient = null;
  
  try {
    // 获取连接
    localClient = await localPool.connect();
    prodClient = await prodPool.connect();
    
    log(`\n🔍 测试表: ${tableName}`, 'cyan');
    log('================================', 'cyan');
    
    // 获取本地数据
    const localResult = await localClient.query(`SELECT * FROM "${tableName}"`);
    const localRows = localResult.rows;
    const localCount = localRows.length;
    
    log(`📊 本地数据行数: ${localCount}`, 'blue');
    
    if (localCount === 0) {
      log('⚠️ 本地表为空，跳过测试', 'yellow');
      return { success: true, message: '本地表为空', localRows: 0, remoteRows: 0 };
    }
    
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
      
      // 插入数据（带进度显示）
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
            return processColumnValue(value, columnInfo);
          });
          
          await prodClient.query(insertQuery, values);
          successCount++;
        } catch (error) {
          log(`  ❌ 行 ${i + 1} 插入失败: ${error.message}`, 'red');
        }
        
        // 显示进度
        const progress = Math.round(((i + 1) / localRows.length) * 100);
        if (i % Math.max(1, Math.floor(localRows.length / 10)) === 0 || i === localRows.length - 1) {
          log(`  📈 进度: ${progress}% (${i + 1}/${localRows.length})`, 'yellow');
        }
      }
      
      // 恢复外键检查
      await prodClient.query('SET session_replication_role = DEFAULT');
      
      // 提交事务
      await prodClient.query('COMMIT');
      
      // 验证同步结果
      const prodCount = await prodClient.query(`SELECT COUNT(*) as count FROM "${tableName}"`);
      const remoteCount = parseInt(prodCount.rows[0].count);
      
      // 检查行数是否一致
      const isRowCountMatch = remoteCount === localCount;
      const success = isRowCountMatch && successCount === localCount;
      
      log(`📊 同步结果:`, 'blue');
      log(`  本地行数: ${localCount}`, 'white');
      log(`  远程行数: ${remoteCount}`, 'white');
      log(`  成功插入: ${successCount}`, 'white');
      log(`  行数匹配: ${isRowCountMatch ? '✅' : '❌'}`, isRowCountMatch ? 'green' : 'red');
      log(`  同步状态: ${success ? '✅ 成功' : '❌ 失败'}`, success ? 'green' : 'red');
      
      return {
        success,
        message: success ? '同步成功' : 
                 !isRowCountMatch ? `行数不匹配: 本地${localCount}行，远程${remoteCount}行` :
                 successCount < localCount ? `部分失败: 成功${successCount}/${localCount}行` : '同步失败',
        localRows: localCount,
        remoteRows: remoteCount,
        successCount
      };
      
    } catch (error) {
      await prodClient.query('ROLLBACK');
      await prodClient.query('SET session_replication_role = DEFAULT');
      throw error;
    }
    
  } catch (error) {
    log(`❌ 测试失败: ${error.message}`, 'red');
    return { success: false, error: error.message, localRows: localCount || 0, remoteRows: 0 };
  } finally {
    // 释放连接
    if (localClient) localClient.release();
    if (prodClient) prodClient.release();
    // 关闭连接池
    await localPool.end();
    await prodPool.end();
  }
}

// 主函数
async function main() {
  log('🔍 测试更新后的同步功能（使用连接池）', 'green');
  log('================================', 'cyan');
  
  // 加载环境变量
  loadEnv();
  
  if (!process.env.LOCAL_DB_URL || !process.env.PROD_DB_URL) {
    log('❌ 缺少数据库连接字符串', 'red');
    process.exit(1);
  }
  
  // 测试有问题的表
  const testTables = [
    'article_drafts',
    'cloze_drafts', 
    'cloze_items',
    'shadowing_sessions',
    'shadowing_themes',
    'shadowing_drafts',
    'shadowing_items'
  ];
  
  const results = [];
  
  for (const tableName of testTables) {
    const result = await testTableSyncWithPool(tableName);
    results.push({ table: tableName, ...result });
  }
  
  // 显示总结
  log(`\n📊 测试总结`, 'magenta');
  log('================================', 'cyan');
  
  const successful = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;
  const totalRows = results.reduce((sum, r) => sum + (r.localRows || 0), 0);
  const syncedRows = results.reduce((sum, r) => sum + (r.remoteRows || 0), 0);
  
  log(`总表数: ${results.length}`, 'white');
  log(`成功: ${successful}`, 'green');
  log(`失败: ${failed}`, 'red');
  log(`本地总行数: ${totalRows}`, 'white');
  log(`远程总行数: ${syncedRows}`, 'white');
  log(`同步率: ${totalRows > 0 ? Math.round((syncedRows / totalRows) * 100) : 0}%`, 'blue');
  
  // 显示失败的表
  const failedTables = results.filter(r => !r.success);
  if (failedTables.length > 0) {
    log(`\n❌ 失败的表:`, 'red');
    failedTables.forEach(table => {
      log(`  ${table.table}: ${table.message}`, 'red');
    });
  }
  
  log(`\n🎉 测试完成`, 'green');
}

// 运行主函数
if (require.main === module) {
  main().catch(console.error);
}

module.exports = { testTableSyncWithPool };


