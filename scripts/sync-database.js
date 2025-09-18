#!/usr/bin/env node

/**
 * 数据库同步脚本 - 将本地数据库数据覆盖到云端数据库
 * 
 * 使用方法:
 * node scripts/sync-database.js [选项]
 * 
 * 选项:
 * --tables=table1,table2,table3  指定要同步的表（逗号分隔）
 * --all                          同步所有表
 * --dry-run                      预览模式，不实际执行同步
 * --help                         显示帮助信息
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

// 检查环境变量
function checkEnv() {
  const required = ['LOCAL_DB_URL', 'PROD_DB_URL'];
  const missing = required.filter(key => !process.env[key]);
  
  if (missing.length > 0) {
    log(`❌ 缺少必需的环境变量: ${missing.join(', ')}`, 'red');
    log('请在 .env.local 文件中设置以下变量:', 'yellow');
    log('LOCAL_DB_URL=postgres://postgres:postgres@127.0.0.1:54322/postgres', 'cyan');
    log('PROD_DB_URL=postgres://postgres:<密码>@<主机>:5432/postgres', 'cyan');
    process.exit(1);
  }
  
  log('✅ 环境变量检查通过', 'green');
}

// 获取所有表名
async function getAllTables(client) {
  const result = await client.query(`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_type = 'BASE TABLE'
    ORDER BY table_name
  `);
  return result.rows.map(row => row.table_name);
}

// 获取表结构
async function getTableStructure(client, tableName) {
  const result = await client.query(`
    SELECT column_name, data_type, is_nullable, column_default
    FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = $1
    ORDER BY ordinal_position
  `, [tableName]);
  
  return result.rows;
}

// 获取表数据行数
async function getTableRowCount(client, tableName) {
  const result = await client.query(`SELECT COUNT(*) as count FROM "${tableName}"`);
  return parseInt(result.rows[0].count);
}

// 同步单个表
async function syncTable(localClient, prodClient, tableName, dryRun = false) {
  log(`\n🔄 开始同步表: ${tableName}`, 'blue');
  
  try {
    // 获取表结构
    const localStructure = await getTableStructure(localClient, tableName);
    const prodStructure = await getTableStructure(prodClient, tableName);
    
    // 检查表结构是否匹配
    if (localStructure.length !== prodStructure.length) {
      log(`⚠️  警告: 表 ${tableName} 的列数不匹配 (本地: ${localStructure.length}, 云端: ${prodStructure.length})`, 'yellow');
    }
    
    // 获取数据行数
    const localCount = await getTableRowCount(localClient, tableName);
    const prodCount = await getTableRowCount(prodClient, tableName);
    
    log(`📊 数据统计: 本地 ${localCount} 行, 云端 ${prodCount} 行`, 'cyan');
    
    if (localCount === 0) {
      log(`⚠️  本地表 ${tableName} 为空，跳过同步`, 'yellow');
      return { success: true, rowsProcessed: 0, message: '本地表为空' };
    }
    
    if (dryRun) {
      log(`🔍 预览模式: 将同步 ${localCount} 行数据到表 ${tableName}`, 'magenta');
      return { success: true, rowsProcessed: localCount, message: '预览模式' };
    }
    
    // 开始事务
    await prodClient.query('BEGIN');
    
    try {
      // 清空目标表
      log(`🗑️  清空云端表 ${tableName}...`, 'yellow');
      await prodClient.query(`TRUNCATE TABLE "${tableName}" CASCADE`);
      
      // 复制数据
      log(`📤 复制数据到云端表 ${tableName}...`, 'cyan');
      const copyQuery = `COPY "${tableName}" FROM STDIN WITH (FORMAT text)`;
      
      // 创建流式复制
      const copyStream = prodClient.query(copyTo(copyQuery));
      
      // 从本地数据库读取数据并写入流
      const localStream = localClient.query(copyFrom(`COPY "${tableName}" TO STDOUT WITH (FORMAT text)`));
      
      // 管道连接
      localStream.pipe(copyStream);
      
      // 等待完成
      await new Promise((resolve, reject) => {
        copyStream.on('finish', resolve);
        copyStream.on('error', reject);
        localStream.on('error', reject);
      });
      
      // 提交事务
      await prodClient.query('COMMIT');
      
      // 验证同步结果
      const newProdCount = await getTableRowCount(prodClient, tableName);
      
      if (newProdCount === localCount) {
        log(`✅ 表 ${tableName} 同步成功: ${newProdCount} 行`, 'green');
        return { success: true, rowsProcessed: newProdCount, message: '同步成功' };
      } else {
        log(`❌ 表 ${tableName} 同步失败: 期望 ${localCount} 行，实际 ${newProdCount} 行`, 'red');
        return { success: false, rowsProcessed: newProdCount, message: '行数不匹配' };
      }
      
    } catch (error) {
      await prodClient.query('ROLLBACK');
      throw error;
    }
    
  } catch (error) {
    log(`❌ 同步表 ${tableName} 失败: ${error.message}`, 'red');
    return { success: false, rowsProcessed: 0, message: error.message };
  }
}

// 主函数
async function main() {
  const args = process.argv.slice(2);
  const options = {
    tables: null,
    all: false,
    dryRun: false,
    help: false
  };
  
  // 解析命令行参数
  for (const arg of args) {
    if (arg === '--help') {
      options.help = true;
    } else if (arg === '--all') {
      options.all = true;
    } else if (arg === '--dry-run') {
      options.dryRun = true;
    } else if (arg.startsWith('--tables=')) {
      options.tables = arg.split('=')[1].split(',').map(t => t.trim());
    }
  }
  
  if (options.help) {
    log('数据库同步脚本使用说明:', 'cyan');
    log('');
    log('使用方法:', 'yellow');
    log('  node scripts/sync-database.js [选项]', 'white');
    log('');
    log('选项:', 'yellow');
    log('  --tables=table1,table2,table3  指定要同步的表（逗号分隔）', 'white');
    log('  --all                          同步所有表', 'white');
    log('  --dry-run                      预览模式，不实际执行同步', 'white');
    log('  --help                         显示帮助信息', 'white');
    log('');
    log('示例:', 'yellow');
    log('  node scripts/sync-database.js --all', 'white');
    log('  node scripts/sync-database.js --tables=users,posts --dry-run', 'white');
    return;
  }
  
  log('🚀 数据库同步工具启动', 'green');
  log('================================', 'cyan');
  
  // 加载环境变量
  loadEnv();
  checkEnv();
  
  if (options.dryRun) {
    log('🔍 预览模式 - 不会实际修改数据', 'magenta');
  }
  
  const localClient = new Client({ connectionString: process.env.LOCAL_DB_URL });
  const prodClient = new Client({ connectionString: process.env.PROD_DB_URL });
  
  try {
    // 连接数据库
    log('🔌 连接数据库...', 'blue');
    await localClient.connect();
    await prodClient.connect();
    log('✅ 数据库连接成功', 'green');
    
    // 确定要同步的表
    let tablesToSync = [];
    
    if (options.all) {
      tablesToSync = await getAllTables(localClient);
      log(`📋 发现 ${tablesToSync.length} 个表: ${tablesToSync.join(', ')}`, 'cyan');
    } else if (options.tables) {
      tablesToSync = options.tables;
      log(`📋 指定同步表: ${tablesToSync.join(', ')}`, 'cyan');
    } else {
      log('❌ 请指定要同步的表 (--tables=table1,table2 或 --all)', 'red');
      return;
    }
    
    // 验证表是否存在
    const existingTables = await getAllTables(localClient);
    const invalidTables = tablesToSync.filter(table => !existingTables.includes(table));
    
    if (invalidTables.length > 0) {
      log(`❌ 以下表在本地数据库中不存在: ${invalidTables.join(', ')}`, 'red');
      return;
    }
    
    // 开始同步
    const results = [];
    const startTime = Date.now();
    
    for (const tableName of tablesToSync) {
      const result = await syncTable(localClient, prodClient, tableName, options.dryRun);
      results.push({ table: tableName, ...result });
    }
    
    const duration = Date.now() - startTime;
    
    // 显示结果摘要
    log('\n📊 同步结果摘要', 'cyan');
    log('================================', 'cyan');
    
    const successful = results.filter(r => r.success);
    const failed = results.filter(r => !r.success);
    
    log(`✅ 成功: ${successful.length} 个表`, 'green');
    log(`❌ 失败: ${failed.length} 个表`, failed.length > 0 ? 'red' : 'green');
    log(`⏱️  耗时: ${(duration / 1000).toFixed(2)} 秒`, 'cyan');
    
    if (successful.length > 0) {
      log('\n✅ 成功同步的表:', 'green');
      successful.forEach(r => {
        log(`  - ${r.table}: ${r.rowsProcessed} 行 (${r.message})`, 'green');
      });
    }
    
    if (failed.length > 0) {
      log('\n❌ 同步失败的表:', 'red');
      failed.forEach(r => {
        log(`  - ${r.table}: ${r.message}`, 'red');
      });
    }
    
    if (options.dryRun) {
      log('\n🔍 这是预览模式，没有实际修改数据', 'magenta');
      log('要执行实际同步，请移除 --dry-run 参数', 'yellow');
    }
    
  } catch (error) {
    log(`❌ 同步过程中发生错误: ${error.message}`, 'red');
    console.error(error);
  } finally {
    // 关闭连接
    await localClient.end();
    await prodClient.end();
    log('\n🔌 数据库连接已关闭', 'blue');
  }
}

// 运行主函数
if (require.main === module) {
  main().catch(console.error);
}

module.exports = { main, syncTable, getAllTables };
