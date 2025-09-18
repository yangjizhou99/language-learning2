#!/usr/bin/env node

/**
 * 简单数据库同步脚本
 * 将本地数据库数据覆盖到云端数据库
 */

const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

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
    console.log(`❌ 缺少必需的环境变量: ${missing.join(', ')}`);
    console.log('请在 .env.local 文件中设置以下变量:');
    console.log('LOCAL_DB_URL=postgres://postgres:postgres@127.0.0.1:54322/postgres');
    console.log('PROD_DB_URL=postgres://postgres:<密码>@<主机>:5432/postgres');
    process.exit(1);
  }
  
  console.log('✅ 环境变量检查通过');
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

// 同步单个表
async function syncTable(localClient, prodClient, tableName) {
  console.log(`\n🔄 开始同步表: ${tableName}`);
  
  try {
    // 获取本地数据
    const localResult = await localClient.query(`SELECT * FROM "${tableName}"`);
    const localRows = localResult.rows;
    
    console.log(`📊 本地表 ${tableName} 有 ${localRows.length} 行数据`);
    
    if (localRows.length === 0) {
      console.log(`⚠️  本地表 ${tableName} 为空，跳过同步`);
      return { success: true, rowsProcessed: 0 };
    }
    
    // 开始事务
    await prodClient.query('BEGIN');
    
    try {
      // 清空目标表
      console.log(`🗑️  清空云端表 ${tableName}...`);
      await prodClient.query(`TRUNCATE TABLE "${tableName}" CASCADE`);
      
      // 插入数据
      console.log(`📤 插入数据到云端表 ${tableName}...`);
      
      if (localRows.length > 0) {
        // 获取列名
        const columns = Object.keys(localRows[0]);
        const columnNames = columns.map(col => `"${col}"`).join(', ');
        const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ');
        
        // 批量插入
        const insertQuery = `INSERT INTO "${tableName}" (${columnNames}) VALUES (${placeholders})`;
        
        for (const row of localRows) {
          const values = columns.map(col => row[col]);
          await prodClient.query(insertQuery, values);
        }
      }
      
      // 提交事务
      await prodClient.query('COMMIT');
      
      // 验证同步结果
      const prodResult = await prodClient.query(`SELECT COUNT(*) as count FROM "${tableName}"`);
      const prodCount = parseInt(prodResult.rows[0].count);
      
      if (prodCount === localRows.length) {
        console.log(`✅ 表 ${tableName} 同步成功: ${prodCount} 行`);
        return { success: true, rowsProcessed: prodCount };
      } else {
        console.log(`❌ 表 ${tableName} 同步失败: 期望 ${localRows.length} 行，实际 ${prodCount} 行`);
        return { success: false, rowsProcessed: prodCount };
      }
      
    } catch (error) {
      await prodClient.query('ROLLBACK');
      throw error;
    }
    
  } catch (error) {
    console.log(`❌ 同步表 ${tableName} 失败: ${error.message}`);
    return { success: false, rowsProcessed: 0 };
  }
}

// 主函数
async function main() {
  console.log('🚀 数据库同步工具启动');
  console.log('================================');
  
  // 加载环境变量
  loadEnv();
  checkEnv();
  
  const localClient = new Client({ connectionString: process.env.LOCAL_DB_URL });
  const prodClient = new Client({ connectionString: process.env.PROD_DB_URL });
  
  try {
    // 连接数据库
    console.log('🔌 连接数据库...');
    await localClient.connect();
    await prodClient.connect();
    console.log('✅ 数据库连接成功');
    
    // 获取所有表
    const tables = await getAllTables(localClient);
    console.log(`📋 发现 ${tables.length} 个表: ${tables.join(', ')}`);
    
    // 询问用户确认
    console.log('\n⚠️  警告: 这将清空云端数据库中的所有表并覆盖为本地数据!');
    console.log('请确保您已经备份了云端数据库的重要数据。');
    
    // 开始同步
    const results = [];
    const startTime = Date.now();
    
    for (const tableName of tables) {
      const result = await syncTable(localClient, prodClient, tableName);
      results.push({ table: tableName, ...result });
    }
    
    const duration = Date.now() - startTime;
    
    // 显示结果摘要
    console.log('\n📊 同步结果摘要');
    console.log('================================');
    
    const successful = results.filter(r => r.success);
    const failed = results.filter(r => !r.success);
    
    console.log(`✅ 成功: ${successful.length} 个表`);
    console.log(`❌ 失败: ${failed.length} 个表`);
    console.log(`⏱️  耗时: ${(duration / 1000).toFixed(2)} 秒`);
    
    if (successful.length > 0) {
      console.log('\n✅ 成功同步的表:');
      successful.forEach(r => {
        console.log(`  - ${r.table}: ${r.rowsProcessed} 行`);
      });
    }
    
    if (failed.length > 0) {
      console.log('\n❌ 同步失败的表:');
      failed.forEach(r => {
        console.log(`  - ${r.table}`);
      });
    }
    
  } catch (error) {
    console.log(`❌ 同步过程中发生错误: ${error.message}`);
    console.error(error);
  } finally {
    // 关闭连接
    await localClient.end();
    await prodClient.end();
    console.log('\n🔌 数据库连接已关闭');
  }
}

// 运行主函数
if (require.main === module) {
  main().catch(console.error);
}

module.exports = { main, syncTable, getAllTables };
