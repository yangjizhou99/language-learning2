#!/usr/bin/env node

/**
 * 修复剩余JSON数据工具
 * 专门修复shadowing_sessions表的notes列问题
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

// 主函数
async function main() {
  log('🔧 修复剩余JSON数据工具', 'green');
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
    
    // 修复shadowing_sessions表的notes列
    log('\n🔧 修复 shadowing_sessions 表的 notes 列', 'blue');
    
    // 获取有问题的数据
    const problemData = await client.query(`
      SELECT id, notes::text as notes_data
      FROM shadowing_sessions
      WHERE notes IS NOT NULL
      AND notes::text !~ '^[{}]'
    `);
    
    if (problemData.rows.length === 0) {
      log('✅ 没有发现需要修复的数据', 'green');
    } else {
      log(`📋 发现 ${problemData.rows.length} 行需要修复`, 'cyan');
      
      let fixed = 0;
      let errors = 0;
      
      for (const row of problemData.rows) {
        try {
          const notesData = row.notes_data;
          let fixedNotes;
          
          // 处理空字符串或无效JSON
          if (!notesData || notesData.trim() === '' || notesData === '""') {
            fixedNotes = '{}';
          } else {
            // 尝试修复JSON
            try {
              JSON.parse(notesData);
              fixedNotes = notesData; // 已经是有效的
            } catch {
              // 如果解析失败，设置为空对象
              fixedNotes = '{}';
            }
          }
          
          // 更新数据
          await client.query(`
            UPDATE shadowing_sessions 
            SET notes = $1::jsonb 
            WHERE id = $2
          `, [fixedNotes, row.id]);
          
          fixed++;
          log(`  ✅ 修复行 ${row.id}: "${notesData}" -> "${fixedNotes}"`, 'green');
        } catch (error) {
          errors++;
          log(`  ❌ 修复行 ${row.id} 失败: ${error.message}`, 'red');
        }
      }
      
      log(`\n📊 修复结果: 成功 ${fixed} 行，失败 ${errors} 行`, 'cyan');
    }
    
    // 验证修复结果
    log('\n🔍 验证修复结果', 'blue');
    const validationResult = await client.query(`
      SELECT 
        COUNT(*) as total_rows,
        COUNT(CASE WHEN notes::text ~ '^[{}]' THEN 1 END) as valid_json_rows
      FROM shadowing_sessions
      WHERE notes IS NOT NULL
    `);
    
    const stats = validationResult.rows[0];
    log(`📊 验证结果:`, 'cyan');
    log(`  总行数: ${stats.total_rows}`, 'white');
    log(`  有效JSON行数: ${stats.valid_json_rows}`, 'white');
    
    if (parseInt(stats.valid_json_rows) === parseInt(stats.total_rows)) {
      log('\n🎉 所有JSON数据修复成功！', 'green');
      log('💡 建议:', 'yellow');
      log('1. 现在可以安全地进行数据库同步', 'cyan');
      log('2. 使用高级同步模式', 'cyan');
      log('3. 预期100%同步成功', 'cyan');
    } else {
      log('\n⚠️  仍有部分数据未修复', 'yellow');
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

module.exports = { main };


