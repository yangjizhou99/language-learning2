#!/usr/bin/env node

/**
 * 调试问题表脚本
 * 分析同步失败的表的具体问题
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

// 检查JSON列的数据质量
async function checkJsonColumns(client, tableName) {
  try {
    const result = await client.query(`
      SELECT column_name, data_type
      FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = $1
      AND data_type = 'jsonb'
    `, [tableName]);
    
    const jsonColumns = result.rows;
    if (jsonColumns.length === 0) {
      return { hasJsonColumns: false, columns: [] };
    }
    
    log(`\n📊 表 ${tableName} 的JSON列分析:`, 'blue');
    
    for (const col of jsonColumns) {
      const columnName = col.column_name;
      
      // 检查数据质量
      const dataCheck = await client.query(`
        SELECT 
          COUNT(*) as total_rows,
          COUNT(CASE WHEN "${columnName}" IS NOT NULL THEN 1 END) as non_null_rows,
          COUNT(CASE WHEN "${columnName}"::text ~ '^[{}]' THEN 1 END) as valid_json_rows,
          COUNT(CASE WHEN "${columnName}"::text = '{}' THEN 1 END) as empty_object_rows,
          COUNT(CASE WHEN "${columnName}"::text = '[]' THEN 1 END) as empty_array_rows
        FROM "${tableName}"
      `);
      
      const stats = dataCheck.rows[0];
      log(`  📋 列 ${columnName}:`, 'cyan');
      log(`    总行数: ${stats.total_rows}`, 'white');
      log(`    非空行数: ${stats.non_null_rows}`, 'white');
      log(`    有效JSON行数: ${stats.valid_json_rows}`, 'white');
      log(`    空对象行数: ${stats.empty_object_rows}`, 'white');
      log(`    空数组行数: ${stats.empty_array_rows}`, 'white');
      
      // 检查有问题的数据
      const problemData = await client.query(`
        SELECT "${columnName}"::text as json_data
        FROM "${tableName}"
        WHERE "${columnName}" IS NOT NULL 
        AND "${columnName}"::text !~ '^[{}]'
        LIMIT 5
      `);
      
      if (problemData.rows.length > 0) {
        log(`    ⚠️  有问题的数据示例:`, 'yellow');
        problemData.rows.forEach((row, i) => {
          const data = row.json_data.substring(0, 100) + '...';
          log(`      ${i + 1}. ${data}`, 'yellow');
        });
      }
    }
    
    return { hasJsonColumns: true, columns: jsonColumns };
  } catch (error) {
    log(`❌ 检查表 ${tableName} 的JSON列失败: ${error.message}`, 'red');
    return { hasJsonColumns: false, columns: [], error: error.message };
  }
}

// 检查表结构
async function checkTableStructure(client, tableName) {
  try {
    const result = await client.query(`
      SELECT 
        column_name,
        data_type,
        is_nullable,
        column_default,
        character_maximum_length
      FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = $1
      ORDER BY ordinal_position
    `, [tableName]);
    
    log(`\n🏗️  表 ${tableName} 的结构:`, 'blue');
    result.rows.forEach(col => {
      const nullable = col.is_nullable === 'YES' ? 'NULL' : 'NOT NULL';
      const defaultVal = col.column_default ? ` DEFAULT ${col.column_default}` : '';
      const length = col.character_maximum_length ? `(${col.character_maximum_length})` : '';
      log(`  ${col.column_name}: ${col.data_type}${length} ${nullable}${defaultVal}`, 'white');
    });
    
    return result.rows;
  } catch (error) {
    log(`❌ 检查表 ${tableName} 结构失败: ${error.message}`, 'red');
    return [];
  }
}

// 检查外键约束
async function checkForeignKeyConstraints(client, tableName) {
  try {
    const result = await client.query(`
      SELECT
        tc.constraint_name,
        kcu.column_name,
        ccu.table_name AS foreign_table_name,
        ccu.column_name AS foreign_column_name
      FROM information_schema.table_constraints AS tc
      JOIN information_schema.key_column_usage AS kcu
        ON tc.constraint_name = kcu.constraint_name
        AND tc.table_schema = kcu.table_schema
      JOIN information_schema.constraint_column_usage AS ccu
        ON ccu.constraint_name = tc.constraint_name
        AND ccu.table_schema = tc.table_schema
      WHERE tc.constraint_type = 'FOREIGN KEY'
        AND tc.table_name = $1
    `, [tableName]);
    
    if (result.rows.length > 0) {
      log(`\n🔗 表 ${tableName} 的外键约束:`, 'blue');
      result.rows.forEach(fk => {
        log(`  ${fk.column_name} -> ${fk.foreign_table_name}.${fk.foreign_column_name}`, 'white');
      });
    } else {
      log(`\n✅ 表 ${tableName} 没有外键约束`, 'green');
    }
    
    return result.rows;
  } catch (error) {
    log(`❌ 检查表 ${tableName} 外键约束失败: ${error.message}`, 'red');
    return [];
  }
}

// 分析问题表
async function analyzeProblemTable(client, tableName) {
  log(`\n🔍 分析问题表: ${tableName}`, 'magenta');
  log('='.repeat(50), 'magenta');
  
  // 检查表结构
  await checkTableStructure(client, tableName);
  
  // 检查外键约束
  await checkForeignKeyConstraints(client, tableName);
  
  // 检查JSON列
  await checkJsonColumns(client, tableName);
  
  // 检查数据行数
  try {
    const countResult = await client.query(`SELECT COUNT(*) as count FROM "${tableName}"`);
    const count = parseInt(countResult.rows[0].count);
    log(`\n📊 数据行数: ${count}`, 'cyan');
  } catch (error) {
    log(`❌ 无法获取表 ${tableName} 的行数: ${error.message}`, 'red');
  }
}

// 主函数
async function main() {
  log('🔍 问题表调试工具', 'green');
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
    
    // 问题表列表
    const problemTables = [
      'article_drafts',
      'cloze_drafts', 
      'cloze_items',
      'shadowing_sessions',
      'shadowing_themes'
    ];
    
    for (const tableName of problemTables) {
      await analyzeProblemTable(client, tableName);
    }
    
    log('\n📋 调试完成！', 'green');
    log('💡 建议:', 'yellow');
    log('1. 检查JSON列的数据格式', 'cyan');
    log('2. 验证外键引用的表是否存在', 'cyan');
    log('3. 使用高级同步模式重新同步', 'cyan');
    
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

module.exports = { main, analyzeProblemTable, checkJsonColumns };


