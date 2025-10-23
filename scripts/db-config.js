/**
 * 本地数据库配置
 * 
 * 用于统一管理本地数据库连接字符串
 * 避免脚本中硬编码连接信息
 */

// 从环境变量读取，如果没有则使用默认的本地配置
const LOCAL_DB_URL = process.env.LOCAL_DB_URL || 'postgres://postgres:postgres@127.0.0.1:54340/postgres';
const PROD_DB_URL = process.env.PROD_DB_URL;

// 解析连接字符串
function parseDbUrl(url) {
  try {
    const parsed = new URL(url);
    return {
      user: parsed.username || 'postgres',
      password: parsed.password || 'postgres',
      host: parsed.hostname || '127.0.0.1',
      port: parseInt(parsed.port) || 5432,
      database: parsed.pathname.slice(1) || 'postgres',
      full: url,
    };
  } catch (error) {
    console.error('无法解析数据库URL:', error.message);
    return null;
  }
}

// 导出配置
module.exports = {
  LOCAL_DB_URL,
  PROD_DB_URL,
  local: parseDbUrl(LOCAL_DB_URL),
  prod: PROD_DB_URL ? parseDbUrl(PROD_DB_URL) : null,
  
  // 辅助函数：检测本地数据库连接
  async testConnection(url = LOCAL_DB_URL) {
    const { Client } = require('pg');
    const client = new Client(url);
    
    try {
      await client.connect();
      const result = await client.query('SELECT version()');
      console.log('✅ 数据库连接成功');
      console.log('📊 PostgreSQL版本:', result.rows[0].version.split(' ').slice(0, 2).join(' '));
      await client.end();
      return true;
    } catch (error) {
      console.error('❌ 数据库连接失败:', error.message);
      console.error('🔧 请检查：');
      console.error('   1. Supabase 是否正在运行: supabase status');
      console.error('   2. 端口是否正确: ' + url);
      console.error('   3. 如果端口不对，请更新 .env.local 中的 LOCAL_DB_URL');
      await client.end();
      return false;
    }
  },
  
  // 辅助函数：自动检测端口
  async detectPort() {
    const commonPorts = [54340, 54322, 5432];
    console.log('🔍 自动检测本地数据库端口...\n');
    
    for (const port of commonPorts) {
      const testUrl = `postgres://postgres:postgres@127.0.0.1:${port}/postgres`;
      const { Client } = require('pg');
      const client = new Client(testUrl);
      
      try {
        await client.connect();
        await client.query('SELECT 1');
        await client.end();
        console.log(`✅ 找到数据库！端口: ${port}`);
        console.log(`   连接字符串: ${testUrl}\n`);
        return { port, url: testUrl };
      } catch (error) {
        console.log(`   端口 ${port}: 未响应`);
        await client.end();
      }
    }
    
    console.log('\n❌ 未找到运行中的本地数据库');
    console.log('💡 请先启动 Supabase: supabase start');
    return null;
  }
};

// 如果直接运行此脚本，执行测试
if (require.main === module) {
  (async () => {
    console.log('====================================');
    console.log('  本地数据库连接测试');
    console.log('====================================\n');
    
    // 先尝试检测端口
    const detected = await module.exports.detectPort();
    
    if (detected) {
      console.log('====================================');
      console.log('  配置建议');
      console.log('====================================\n');
      console.log('在 .env.local 中添加：');
      console.log(`LOCAL_DB_URL=${detected.url}\n`);
    }
  })();
}

