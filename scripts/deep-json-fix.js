#!/usr/bin/env node

/**
 * 深度JSON修复工具
 * 专门处理PostgreSQL JSONB类型的数据格式问题
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

// 深度修复JSON数据
function deepFixJsonData(value) {
  if (value === null || value === undefined) {
    return null;
  }
  
  if (typeof value === 'object') {
    // 如果已经是对象，直接返回
    return value;
  }
  
  if (typeof value !== 'string') {
    return value;
  }
  
  let fixed = value.trim();
  
  // 如果已经是有效的JSON，直接返回
  try {
    const parsed = JSON.parse(fixed);
    return parsed; // 返回解析后的对象，而不是字符串
  } catch {
    // 继续修复
  }
  
  // 处理空值
  if (fixed === '' || fixed === 'null' || fixed === 'NULL' || fixed === '""' || fixed === "''") {
    return null;
  }
  
  // 处理空对象和空数组
  if (fixed === '{}' || fixed === '[]') {
    return fixed === '{}' ? {} : [];
  }
  
  // 处理单引号
  fixed = fixed.replace(/'/g, '"');
  
  // 修复缺少引号的键名
  fixed = fixed.replace(/(\w+):/g, '"$1":');
  
  // 修复布尔值
  fixed = fixed.replace(/:\s*(true|false)\s*([,}])/g, ': $1$2');
  
  // 修复null值
  fixed = fixed.replace(/:\s*null\s*([,}])/g, ': null$1');
  
  // 修复数字值
  fixed = fixed.replace(/:\s*(\d+)\s*([,}])/g, ': $1$2');
  
  // 修复字符串值
  fixed = fixed.replace(/:\s*([^",{\[\s][^,}]*?)\s*([,}])/g, (match, val, ending) => {
    if (!val.startsWith('"') && !val.match(/^(true|false|null|\d+)$/)) {
      return `: "${val}"${ending}`;
    }
    return match;
  });
  
  // 修复数组格式
  fixed = fixed.replace(/\[([^\[\]]*)\]/g, (match, content) => {
    if (content.trim() === '') return '[]';
    
    // 如果数组内容不是有效的JSON格式，尝试修复
    const items = content.split(',').map(item => {
      const trimmed = item.trim();
      if (trimmed === '') return '';
      if (trimmed.startsWith('"') && trimmed.endsWith('"')) return trimmed;
      if (trimmed.match(/^(true|false|null|\d+)$/)) return trimmed;
      return `"${trimmed}"`;
    }).filter(item => item !== '');
    
    return `[${items.join(', ')}]`;
  });
  
  // 确保对象格式
  if (!fixed.startsWith('{') && !fixed.startsWith('[')) {
    fixed = `{${fixed}}`;
  }
  
  // 验证修复结果
  try {
    const parsed = JSON.parse(fixed);
    return parsed; // 返回解析后的对象
  } catch {
    // 如果还是无法修复，根据内容类型返回默认值
    if (fixed.includes('[') || fixed.includes(']')) {
      return [];
    } else {
      return {};
    }
  }
}

// 修复表中的JSON数据
async function fixTableJsonDataDeep(client, tableName) {
  try {
    // 获取JSON列
    const columnsResult = await client.query(`
      SELECT column_name
      FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = $1
      AND data_type = 'jsonb'
    `, [tableName]);
    
    if (columnsResult.rows.length === 0) {
      log(`⚠️  表 ${tableName} 没有JSON列`, 'yellow');
      return { success: true, fixed: 0, errors: 0 };
    }
    
    const jsonColumns = columnsResult.rows.map(row => row.column_name);
    log(`\n🔧 深度修复表 ${tableName} 的JSON列: ${jsonColumns.join(', ')}`, 'blue');
    
    let totalFixed = 0;
    let totalErrors = 0;
    
    for (const columnName of jsonColumns) {
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
      
      log(`  📋 列 ${columnName}: 处理 ${dataResult.rows.length} 行数据`, 'cyan');
      
      let fixed = 0;
      let errors = 0;
      
      for (const row of dataResult.rows) {
        try {
          const originalValue = row.json_data;
          const fixedValue = deepFixJsonData(originalValue);
          
          // 更新数据
          await client.query(`
            UPDATE "${tableName}" 
            SET "${columnName}" = $1::jsonb 
            WHERE id = $2
          `, [JSON.stringify(fixedValue), row.id]);
          
          fixed++;
          totalFixed++;
          
          if (fixed <= 3) { // 只显示前3个修复示例
            log(`    ✅ 修复行 ${row.id}: ${typeof originalValue} -> ${typeof fixedValue}`, 'green');
          }
        } catch (error) {
          errors++;
          totalErrors++;
          log(`    ❌ 修复行 ${row.id} 失败: ${error.message}`, 'red');
        }
      }
      
      log(`  📊 列 ${columnName}: 修复 ${fixed} 行，错误 ${errors} 行`, 'cyan');
    }
    
    return { success: true, fixed: totalFixed, errors: totalErrors };
  } catch (error) {
    log(`❌ 修复表 ${tableName} 失败: ${error.message}`, 'red');
    return { success: false, fixed: 0, errors: 1 };
  }
}

// 主函数
async function main() {
  log('🔧 深度JSON修复工具', 'green');
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
    
    let totalFixed = 0;
    let totalErrors = 0;
    
    for (const tableName of problemTables) {
      const result = await fixTableJsonDataDeep(client, tableName);
      totalFixed += result.fixed;
      totalErrors += result.errors;
    }
    
    log('\n📊 修复结果摘要', 'cyan');
    log('================================', 'cyan');
    log(`✅ 总共修复: ${totalFixed} 行`, 'green');
    log(`❌ 修复失败: ${totalErrors} 行`, totalErrors > 0 ? 'red' : 'green');
    
    if (totalFixed > 0) {
      log('\n💡 建议:', 'yellow');
      log('1. 重新运行手动同步测试', 'cyan');
      log('2. 验证数据格式是否正确', 'cyan');
      log('3. 尝试完整的数据库同步', 'cyan');
    }
    
  } catch (error) {
    log(`❌ 修复过程中发生错误: ${error.message}`, 'red');
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

module.exports = { main, deepFixJsonData, fixTableJsonDataDeep };
