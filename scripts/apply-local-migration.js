#!/usr/bin/env node
/**
 * 便捷脚本：应用数据库迁移到本地数据库
 * 
 * 使用方法：
 *   node scripts/apply-local-migration.js <迁移文件路径>
 * 
 * 示例：
 *   node scripts/apply-local-migration.js apply_vocab_optimization.sql
 *   node scripts/apply-local-migration.js supabase/migrations/20251023120000_optimize_vocab_performance.sql
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const dbConfig = require('./db-config');

async function applyMigration(filePath) {
  console.log('====================================');
  console.log('  应用数据库迁移到本地');
  console.log('====================================\n');
  
  // 检查文件是否存在
  if (!fs.existsSync(filePath)) {
    console.error(`❌ 迁移文件不存在: ${filePath}`);
    process.exit(1);
  }
  
  console.log(`📄 迁移文件: ${filePath}`);
  
  // 检测数据库连接
  console.log('\n🔍 检测本地数据库...\n');
  const detected = await dbConfig.detectPort();
  
  if (!detected) {
    console.error('\n❌ 无法连接到本地数据库');
    console.error('💡 请先运行: supabase start');
    process.exit(1);
  }
  
  const dbUrl = detected.url;
  
  // 应用迁移
  console.log('\n🚀 开始应用迁移...\n');
  console.log('─'.repeat(50));
  
  try {
    // 设置客户端编码为UTF8避免中文乱码
    const command = `psql "${dbUrl}" -v ON_ERROR_STOP=1 -f "${filePath}"`;
    execSync(command, {
      stdio: 'inherit',
      env: {
        ...process.env,
        PGCLIENTENCODING: 'UTF8'
      }
    });
    
    console.log('─'.repeat(50));
    console.log('\n✅ 迁移应用成功！\n');
    
    // 验证
    console.log('🔍 验证迁移结果...');
    await verifyMigration(dbUrl, filePath);
    
  } catch (error) {
    console.log('─'.repeat(50));
    console.error('\n❌ 迁移应用失败');
    console.error('错误信息:', error.message);
    process.exit(1);
  }
}

async function verifyMigration(dbUrl, filePath) {
  const { Client } = require('pg');
  const client = new Client(dbUrl);
  
  try {
    await client.connect();
    
    // 根据文件名判断验证内容
    if (filePath.includes('vocab_optimization') || filePath.includes('optimize_vocab_performance')) {
      // 验证 vocab 优化
      const funcResult = await client.query(`
        SELECT routine_name 
        FROM information_schema.routines 
        WHERE routine_name = 'get_vocab_stats'
      `);
      
      const indexResult = await client.query(`
        SELECT COUNT(*) as count
        FROM pg_indexes
        WHERE tablename = 'vocab_entries'
        AND indexname LIKE 'idx_vocab_entries_user%'
      `);
      
      if (funcResult.rows.length > 0) {
        console.log('  ✅ 函数 get_vocab_stats 已创建');
      } else {
        console.log('  ⚠️  函数 get_vocab_stats 未找到');
      }
      
      const indexCount = parseInt(indexResult.rows[0].count);
      console.log(`  ✅ 已创建 ${indexCount} 个优化索引`);
    } else {
      console.log('  ℹ️  通用迁移，跳过特定验证');
    }
    
    await client.end();
  } catch (error) {
    console.error('  ⚠️  验证过程出错:', error.message);
    await client.end();
  }
}

// 主程序
const args = process.argv.slice(2);

if (args.length === 0) {
  console.log('使用方法:');
  console.log('  node scripts/apply-local-migration.js <迁移文件路径>');
  console.log('');
  console.log('示例:');
  console.log('  node scripts/apply-local-migration.js apply_vocab_optimization.sql');
  console.log('  node scripts/apply-local-migration.js supabase/migrations/20251023120000_optimize_vocab_performance.sql');
  process.exit(0);
}

const migrationFile = args[0];
applyMigration(migrationFile).catch(error => {
  console.error('执行错误:', error);
  process.exit(1);
});

