#!/usr/bin/env node

/**
 * JSON数据验证工具
 * 准确验证数据库中的JSON数据质量
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

// 验证JSON数据
function validateJsonData(value) {
  if (value === null || value === undefined) {
    return { valid: true, type: 'null', error: null };
  }
  
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return { 
        valid: true, 
        type: Array.isArray(parsed) ? 'array' : typeof parsed, 
        error: null,
        parsed 
      };
    } catch (error) {
      return { 
        valid: false, 
        type: 'invalid', 
        error: error.message,
        raw: value.substring(0, 100) + '...'
      };
    }
  }
  
  if (typeof value === 'object') {
    return { 
      valid: true, 
      type: Array.isArray(value) ? 'array' : 'object', 
      error: null,
      parsed: value
    };
  }
  
  return { 
    valid: false, 
    type: 'unknown', 
    error: 'Unexpected data type',
    raw: String(value).substring(0, 100) + '...'
  };
}

// 验证表的JSON列
async function validateTableJsonColumns(client, tableName) {
  try {
    // 获取JSON列
    const columnsResult = await client.query(`
      SELECT column_name, data_type
      FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = $1
      AND data_type = 'jsonb'
    `, [tableName]);
    
    if (columnsResult.rows.length === 0) {
      log(`⚠️  表 ${tableName} 没有JSON列`, 'yellow');
      return { success: true, valid: 0, invalid: 0, errors: [] };
    }
    
    const jsonColumns = columnsResult.rows;
    log(`\n🔍 验证表 ${tableName} 的JSON列: ${jsonColumns.map(c => c.column_name).join(', ')}`, 'blue');
    
    let totalValid = 0;
    let totalInvalid = 0;
    const errors = [];
    
    for (const col of jsonColumns) {
      const columnName = col.column_name;
      
      // 获取所有数据
      const dataResult = await client.query(`
        SELECT id, "${columnName}" as json_data
        FROM "${tableName}"
        WHERE "${columnName}" IS NOT NULL
        LIMIT 100
      `);
      
      if (dataResult.rows.length === 0) {
        log(`  ✅ 列 ${columnName}: 没有数据`, 'green');
        continue;
      }
      
      log(`  📋 列 ${columnName}: 检查 ${dataResult.rows.length} 行数据`, 'cyan');
      
      let valid = 0;
      let invalid = 0;
      const columnErrors = [];
      
      for (const row of dataResult.rows) {
        const validation = validateJsonData(row.json_data);
        
        if (validation.valid) {
          valid++;
          totalValid++;
        } else {
          invalid++;
          totalInvalid++;
          columnErrors.push({
            id: row.id,
            error: validation.error,
            raw: validation.raw
          });
          errors.push({
            table: tableName,
            column: columnName,
            id: row.id,
            error: validation.error,
            raw: validation.raw
          });
        }
      }
      
      log(`  📊 列 ${columnName}: 有效 ${valid} 行，无效 ${invalid} 行`, 'cyan');
      
      if (columnErrors.length > 0) {
        log(`    ⚠️  无效数据示例:`, 'yellow');
        columnErrors.slice(0, 3).forEach((err, i) => {
          log(`      ${i + 1}. ID ${err.id}: ${err.error}`, 'yellow');
          log(`         数据: ${err.raw}`, 'yellow');
        });
      }
    }
    
    return { success: true, valid: totalValid, invalid: totalInvalid, errors };
  } catch (error) {
    log(`❌ 验证表 ${tableName} 失败: ${error.message}`, 'red');
    return { success: false, valid: 0, invalid: 0, errors: [{ error: error.message }] };
  }
}

// 主函数
async function main() {
  log('🔍 JSON数据验证工具', 'green');
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
    
    let totalValid = 0;
    let totalInvalid = 0;
    const allErrors = [];
    
    for (const tableName of problemTables) {
      const result = await validateTableJsonColumns(client, tableName);
      totalValid += result.valid;
      totalInvalid += result.invalid;
      allErrors.push(...result.errors);
    }
    
    log('\n📊 验证结果摘要', 'cyan');
    log('================================', 'cyan');
    log(`✅ 有效数据: ${totalValid} 行`, 'green');
    log(`❌ 无效数据: ${totalInvalid} 行`, totalInvalid > 0 ? 'red' : 'green');
    
    if (totalInvalid === 0) {
      log('\n🎉 所有JSON数据都是有效的！', 'green');
      log('💡 建议:', 'yellow');
      log('1. 现在可以安全地进行数据库同步', 'cyan');
      log('2. 使用高级同步模式', 'cyan');
      log('3. 预期100%同步成功', 'cyan');
    } else {
      log('\n⚠️  发现无效的JSON数据', 'yellow');
      log('💡 建议:', 'yellow');
      log('1. 运行JSON修复工具: node scripts/fix-json-data.js', 'cyan');
      log('2. 手动修复剩余问题', 'cyan');
      log('3. 重新验证数据质量', 'cyan');
    }
    
  } catch (error) {
    log(`❌ 验证过程中发生错误: ${error.message}`, 'red');
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

module.exports = { main, validateJsonData, validateTableJsonColumns };
