#!/usr/bin/env node

/**
 * JSON内容调试工具
 * 详细检查JSON数据的具体内容和格式
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

// 检查JSON数据内容
async function debugJsonContent(client, tableName, columnName) {
  try {
    log(`\n🔍 调试表 ${tableName} 的列 ${columnName}`, 'blue');
    
    // 获取数据
    const result = await client.query(`
      SELECT id, "${columnName}" as json_data, pg_typeof("${columnName}") as data_type
      FROM "${tableName}"
      WHERE "${columnName}" IS NOT NULL
      LIMIT 3
    `);
    
    if (result.rows.length === 0) {
      log(`  ⚠️ 没有数据`, 'yellow');
      return;
    }
    
    log(`  📋 数据类型: ${result.rows[0].data_type}`, 'cyan');
    log(`  📋 数据行数: ${result.rows.length}`, 'cyan');
    
    for (let i = 0; i < result.rows.length; i++) {
      const row = result.rows[i];
      const jsonData = row.json_data;
      
      log(`\n  📄 行 ${i + 1} (ID: ${row.id}):`, 'white');
      log(`    类型: ${typeof jsonData}`, 'white');
      
      if (typeof jsonData === 'string') {
        log(`    字符串长度: ${jsonData.length}`, 'white');
        log(`    前100字符: ${jsonData.substring(0, 100)}...`, 'white');
        
        // 尝试解析JSON
        try {
          const parsed = JSON.parse(jsonData);
          log(`    ✅ JSON解析成功: ${typeof parsed}`, 'green');
          log(`    解析后类型: ${Array.isArray(parsed) ? 'array' : typeof parsed}`, 'green');
        } catch (error) {
          log(`    ❌ JSON解析失败: ${error.message}`, 'red');
        }
      } else if (typeof jsonData === 'object') {
        log(`    对象类型: ${Array.isArray(jsonData) ? 'array' : 'object'}`, 'white');
        log(`    内容: ${JSON.stringify(jsonData).substring(0, 100)}...`, 'white');
      } else {
        log(`    其他类型: ${jsonData}`, 'white');
      }
    }
    
  } catch (error) {
    log(`  ❌ 调试失败: ${error.message}`, 'red');
  }
}

// 测试JSON数据插入
async function testJsonInsert(client, tableName, columnName) {
  try {
    log(`\n🧪 测试表 ${tableName} 的列 ${columnName} 的JSON插入`, 'blue');
    
    // 获取列的数据类型
    const columnResult = await client.query(`
      SELECT data_type, column_default
      FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = $1
      AND column_name = $2
    `, [tableName, columnName]);
    
    if (columnResult.rows.length === 0) {
      log(`  ❌ 列 ${columnName} 不存在`, 'red');
      return;
    }
    
    const columnInfo = columnResult.rows[0];
    log(`  📋 列类型: ${columnInfo.data_type}`, 'cyan');
    log(`  📋 默认值: ${columnInfo.column_default || 'NULL'}`, 'cyan');
    
    // 测试不同的JSON值
    const testValues = [
      null,
      '{}',
      '[]',
      '{"test": "value"}',
      '[1, 2, 3]',
      '{"nested": {"key": "value"}}'
    ];
    
    for (let i = 0; i < testValues.length; i++) {
      const testValue = testValues[i];
      try {
        // 创建临时表进行测试
        const tempTableName = `temp_test_${Date.now()}`;
        
        await client.query(`
          CREATE TEMP TABLE "${tempTableName}" (
            id SERIAL PRIMARY KEY,
            test_column ${columnInfo.data_type}
          )
        `);
        
        // 尝试插入测试值
        await client.query(`
          INSERT INTO "${tempTableName}" (test_column) VALUES ($1)
        `, [testValue]);
        
        log(`    ✅ 测试值 ${i + 1}: ${testValue} - 插入成功`, 'green');
        
        // 清理临时表
        await client.query(`DROP TABLE "${tempTableName}"`);
        
      } catch (error) {
        log(`    ❌ 测试值 ${i + 1}: ${testValue} - 插入失败: ${error.message}`, 'red');
      }
    }
    
  } catch (error) {
    log(`  ❌ 测试失败: ${error.message}`, 'red');
  }
}

// 主函数
async function main() {
  log('🔍 JSON内容调试工具', 'green');
  log('================================', 'cyan');
  
  // 加载环境变量
  loadEnv();
  
  if (!process.env.LOCAL_DB_URL) {
    log('❌ 缺少 LOCAL_DB_URL 环境变量', 'red');
    process.exit(1);
  }
  
  const client = new Client({ connectionString: process.env.LOCAL_DB_URL });
  
  try {
    await client.connect();
    log('✅ 数据库连接成功', 'green');
    
    // 调试问题表
    const problemTables = [
      { table: 'article_drafts', columns: ['cloze_short', 'cloze_long'] },
      { table: 'cloze_drafts', columns: ['blanks'] },
      { table: 'cloze_items', columns: ['blanks'] },
      { table: 'shadowing_sessions', columns: ['recordings', 'picked_preview'] },
      { table: 'shadowing_themes', columns: ['coverage'] }
    ];
    
    for (const tableInfo of problemTables) {
      for (const columnName of tableInfo.columns) {
        await debugJsonContent(client, tableInfo.table, columnName);
        await testJsonInsert(client, tableInfo.table, columnName);
      }
    }
    
    log('\n💡 调试完成！', 'green');
    log('请检查上述输出，找出JSON数据的具体问题', 'cyan');
    
  } catch (error) {
    log(`❌ 调试过程中发生错误: ${error.message}`, 'red');
    console.error(error);
  } finally {
    await client.end();
    log('\n🔌 数据库连接已关闭', 'blue');
  }
}

// 运行主函数
if (require.main === module) {
  main().catch(console.error);
}

module.exports = { main, debugJsonContent, testJsonInsert };
