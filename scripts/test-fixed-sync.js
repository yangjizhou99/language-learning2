#!/usr/bin/env node

/**
 * 测试修复后的同步功能
 * 验证数组类型和JSONB类型的正确处理
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

// 测试修复后的同步
async function testFixedSync() {
  const localClient = new Client({ connectionString: process.env.LOCAL_DB_URL });
  const prodClient = new Client({ connectionString: process.env.PROD_DB_URL });
  
  try {
    await localClient.connect();
    await prodClient.connect();
    
    log('🔍 测试修复后的同步功能', 'cyan');
    log('================================', 'cyan');
    
    // 测试有问题的表
    const problemTables = [
      'shadowing_sessions', // 有数组类型问题
      'article_drafts',     // 有JSONB类型
      'cloze_drafts',       // 有JSONB类型
      'shadowing_drafts',   // 有JSONB类型
      'shadowing_items'     // 有JSONB类型
    ];
    
    for (const tableName of problemTables) {
      log(`\n🧪 测试表: ${tableName}`, 'yellow');
      
      try {
        // 获取表结构
        const columns = await localClient.query(`
          SELECT column_name, data_type, udt_name
          FROM information_schema.columns 
          WHERE table_schema = 'public' 
          AND table_name = $1
          ORDER BY ordinal_position
        `, [tableName]);
        
        log(`📋 表结构:`, 'blue');
        columns.rows.forEach(col => {
          const typeInfo = col.udt_name === 'uuid' && col.data_type === 'ARRAY' ? 
            `${col.data_type}(${col.udt_name})` : 
            col.data_type;
          log(`  ${col.column_name}: ${typeInfo}`, 'white');
        });
        
        // 获取本地数据（只取第一行）
        const localResult = await localClient.query(`SELECT * FROM "${tableName}" LIMIT 1`);
        if (localResult.rows.length === 0) {
          log(`⚠️ 本地表为空，跳过测试`, 'yellow');
          continue;
        }
        
        const localRow = localResult.rows[0];
        log(`📊 本地数据行数: 1`, 'blue');
        
        // 开始事务测试
        await prodClient.query('BEGIN');
        
        try {
          // 清空目标表
          await prodClient.query(`TRUNCATE TABLE "${tableName}" CASCADE`);
          
          // 准备插入数据
          const columnNames = Object.keys(localRow).map(col => `"${col}"`).join(', ');
          const placeholders = Object.keys(localRow).map((_, i) => `$${i + 1}`).join(', ');
          const insertQuery = `INSERT INTO "${tableName}" (${columnNames}) VALUES (${placeholders})`;
          
          // 处理列值
          const columnMap = new Map(columns.rows.map(col => [col.column_name, col]));
          const values = Object.keys(localRow).map(col => {
            const value = localRow[col];
            const columnInfo = columnMap.get(col);
            
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
              if (value instanceof Date) {
                return value.toISOString();
              }
              return String(value);
            }
            
            return value;
          });
          
          // 执行插入
          await prodClient.query(insertQuery, values);
          log(`✅ 插入成功`, 'green');
          
          // 验证插入结果
          const countResult = await prodClient.query(`SELECT COUNT(*) as count FROM "${tableName}"`);
          const count = parseInt(countResult.rows[0].count);
          log(`📊 插入后行数: ${count}`, 'green');
          
          // 提交事务
          await prodClient.query('COMMIT');
          
        } catch (error) {
          await prodClient.query('ROLLBACK');
          log(`❌ 插入失败: ${error.message}`, 'red');
          throw error;
        }
        
      } catch (error) {
        log(`❌ 表 ${tableName} 测试失败: ${error.message}`, 'red');
      }
    }
    
    log(`\n🎉 所有测试完成`, 'green');
    
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
  log('🔍 测试修复后的同步功能', 'green');
  log('================================', 'cyan');
  
  // 加载环境变量
  loadEnv();
  
  if (!process.env.LOCAL_DB_URL || !process.env.PROD_DB_URL) {
    log('❌ 缺少数据库连接字符串', 'red');
    process.exit(1);
  }
  
  try {
    await testFixedSync();
  } catch (error) {
    log(`❌ 测试失败: ${error.message}`, 'red');
    process.exit(1);
  }
}

// 运行主函数
if (require.main === module) {
  main().catch(console.error);
}

module.exports = { testFixedSync };
