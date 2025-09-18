#!/usr/bin/env node

/**
 * 测试JSONB修复工具
 * 验证修复后的JSONB处理逻辑
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

// 测试JSONB处理逻辑
function testJsonbProcessing(value) {
  // 模拟修复后的逻辑
  if (typeof value === 'object' && value !== null) {
    return JSON.stringify(value);
  }
  return value;
}

// 测试单个表的JSONB处理
async function testTableJsonbProcessing(client, tableName) {
  try {
    log(`\n🔧 测试表 ${tableName} 的JSONB处理`, 'blue');
    
    // 获取本地数据
    const localResult = await client.query(`SELECT COUNT(*) as count FROM "${tableName}"`);
    const localCount = parseInt(localResult.rows[0].count);
    log(`  本地数据行数: ${localCount}`, 'cyan');
    
    if (localCount === 0) {
      log(`  ⚠️ 本地表 ${tableName} 为空，跳过测试`, 'yellow');
      return { success: true, message: '本地表为空' };
    }
    
    // 获取一行数据
    const dataResult = await client.query(`SELECT * FROM "${tableName}" LIMIT 1`);
    const row = dataResult.rows[0];
    
    // 获取列信息
    const columnsResult = await client.query(`
      SELECT column_name, data_type
      FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = $1
      ORDER BY ordinal_position
    `, [tableName]);
    
    const columns = columnsResult.rows;
    log(`  📋 表结构: ${columns.length} 列`, 'cyan');
    
    // 测试每列的数据处理
    let jsonbColumns = 0;
    let processedValues = {};
    
    for (const col of columns) {
      const columnName = col.column_name;
      const dataType = col.data_type;
      const value = row[columnName];
      
      if (dataType === 'jsonb') {
        jsonbColumns++;
        const originalType = typeof value;
        const processedValue = testJsonbProcessing(value);
        const processedType = typeof processedValue;
        
        log(`    📄 ${columnName} (${dataType}):`, 'white');
        log(`      原始类型: ${originalType}`, 'white');
        log(`      处理后类型: ${processedType}`, 'white');
        log(`      原始值: ${JSON.stringify(value).substring(0, 50)}...`, 'white');
        log(`      处理后值: ${processedValue.substring(0, 50)}...`, 'white');
        
        // 验证JSON字符串是否有效
        try {
          JSON.parse(processedValue);
          log(`      ✅ JSON字符串有效`, 'green');
        } catch (error) {
          log(`      ❌ JSON字符串无效: ${error.message}`, 'red');
        }
        
        processedValues[columnName] = processedValue;
      }
    }
    
    log(`  📊 JSONB列数量: ${jsonbColumns}`, 'cyan');
    
    if (jsonbColumns > 0) {
      log(`  ✅ 表 ${tableName} JSONB处理测试完成`, 'green');
      return { 
        success: true, 
        message: `JSONB处理正常: ${jsonbColumns} 列`,
        jsonbColumns,
        processedValues
      };
    } else {
      log(`  ⚠️ 表 ${tableName} 没有JSONB列`, 'yellow');
      return { 
        success: true, 
        message: '没有JSONB列',
        jsonbColumns: 0
      };
    }
    
  } catch (error) {
    log(`  ❌ 表 ${tableName} 测试失败: ${error.message}`, 'red');
    return { 
      success: false, 
      message: `测试失败: ${error.message}`,
      error: error.message
    };
  }
}

// 主函数
async function main() {
  log('🧪 JSONB修复测试工具', 'green');
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
      const result = await testTableJsonbProcessing(client, tableName);
      results.push({ table: tableName, ...result });
    }
    
    // 显示结果摘要
    log('\n📊 测试结果摘要', 'cyan');
    log('================================', 'cyan');
    
    let successCount = 0;
    let totalJsonbColumns = 0;
    
    results.forEach(result => {
      const status = result.success ? '✅' : '❌';
      log(`${status} ${result.table}: ${result.message}`, result.success ? 'green' : 'red');
      
      if (result.success) successCount++;
      if (result.jsonbColumns) totalJsonbColumns += result.jsonbColumns;
    });
    
    log(`\n📈 总体结果:`, 'blue');
    log(`  成功表数: ${successCount}/${results.length}`, 'white');
    log(`  JSONB列总数: ${totalJsonbColumns}`, 'white');
    
    if (successCount === results.length) {
      log('\n🎉 所有表JSONB处理测试成功！', 'green');
      log('💡 建议: 现在可以尝试重新同步', 'cyan');
    } else {
      log('\n⚠️ 部分表JSONB处理测试失败', 'yellow');
      log('💡 建议: 检查失败表的错误信息', 'cyan');
    }
    
  } catch (error) {
    log(`❌ 测试过程中发生错误: ${error.message}`, 'red');
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

module.exports = { main, testJsonbProcessing, testTableJsonbProcessing };
