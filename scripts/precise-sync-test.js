#!/usr/bin/env node

/**
 * 精确同步测试工具
 * 测试JSONB数据的精确同步过程
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

// 精确测试JSONB同步
async function testJsonbSync(localClient, prodClient, tableName, columnName) {
  try {
    log(`\n🔧 精确测试表 ${tableName} 的列 ${columnName}`, 'blue');
    
    // 获取本地数据
    const localResult = await localClient.query(`
      SELECT id, "${columnName}" as json_data
      FROM "${tableName}"
      WHERE "${columnName}" IS NOT NULL
      LIMIT 1
    `);
    
    if (localResult.rows.length === 0) {
      log(`  ⚠️ 没有数据`, 'yellow');
      return;
    }
    
    const localRow = localResult.rows[0];
    const localJsonData = localRow.json_data;
    
    log(`  📋 本地数据类型: ${typeof localJsonData}`, 'cyan');
    log(`  📋 本地数据内容: ${JSON.stringify(localJsonData).substring(0, 100)}...`, 'cyan');
    
    // 清空远程表
    await prodClient.query(`TRUNCATE TABLE "${tableName}" CASCADE`);
    
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
    
    // 准备数据
    const values = columns.map(col => {
      if (col === columnName) {
        // 对于JSONB列，将对象转换为JSON字符串
        return JSON.stringify(localJsonData);
      } else {
        return localRow[col];
      }
    });
    
    log(`  📋 准备插入数据:`, 'cyan');
    log(`    列: ${columnNames}`, 'white');
    log(`    值: ${values.map(v => typeof v === 'object' ? `[${typeof v}]` : v).join(', ')}`, 'white');
    
    // 插入数据
    const insertQuery = `INSERT INTO "${tableName}" (${columnNames}) VALUES (${placeholders})`;
    
    try {
      await prodClient.query(insertQuery, values);
      log(`  ✅ 插入成功！`, 'green');
      
      // 验证插入结果
      const verifyResult = await prodClient.query(`
        SELECT "${columnName}" as json_data
        FROM "${tableName}"
        WHERE id = $1
      `, [localRow.id]);
      
      if (verifyResult.rows.length > 0) {
        const remoteJsonData = verifyResult.rows[0].json_data;
        log(`  ✅ 验证成功！`, 'green');
        log(`    远程数据类型: ${typeof remoteJsonData}`, 'white');
        log(`    远程数据内容: ${JSON.stringify(remoteJsonData).substring(0, 100)}...`, 'white');
        
        // 比较数据
        const localStr = JSON.stringify(localJsonData);
        const remoteStr = JSON.stringify(remoteJsonData);
        
        if (localStr === remoteStr) {
          log(`  ✅ 数据完全一致！`, 'green');
          return { success: true, message: '同步成功' };
        } else {
          log(`  ⚠️ 数据不完全一致`, 'yellow');
          return { success: false, message: '数据不一致' };
        }
      } else {
        log(`  ❌ 验证失败：未找到插入的数据`, 'red');
        return { success: false, message: '验证失败' };
      }
      
    } catch (error) {
      log(`  ❌ 插入失败: ${error.message}`, 'red');
      return { success: false, message: error.message };
    }
    
  } catch (error) {
    log(`  ❌ 测试失败: ${error.message}`, 'red');
    return { success: false, message: error.message };
  }
}

// 主函数
async function main() {
  log('🧪 精确同步测试工具', 'green');
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
    const testCases = [
      { table: 'article_drafts', column: 'cloze_short' },
      { table: 'cloze_drafts', column: 'blanks' },
      { table: 'cloze_items', column: 'blanks' },
      { table: 'shadowing_sessions', column: 'recordings' },
      { table: 'shadowing_themes', column: 'coverage' }
    ];
    
    const results = [];
    
    for (const testCase of testCases) {
      const result = await testJsonbSync(localClient, prodClient, testCase.table, testCase.column);
      results.push({ table: testCase.table, column: testCase.column, ...result });
    }
    
    // 显示结果摘要
    log('\n📊 测试结果摘要', 'cyan');
    log('================================', 'cyan');
    
    let successCount = 0;
    
    results.forEach(result => {
      const status = result.success ? '✅' : '❌';
      log(`${status} ${result.table}.${result.column}: ${result.message}`, result.success ? 'green' : 'red');
      
      if (result.success) successCount++;
    });
    
    log(`\n📈 总体结果: ${successCount}/${results.length} 成功`, 'blue');
    
    if (successCount === results.length) {
      log('\n🎉 所有JSONB列同步测试成功！', 'green');
      log('💡 建议: 现在可以尝试完整的数据库同步', 'cyan');
    } else {
      log('\n⚠️ 部分JSONB列同步失败', 'yellow');
      log('💡 建议: 检查失败列的具体错误信息', 'cyan');
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

module.exports = { main, testJsonbSync };
