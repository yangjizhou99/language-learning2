const { Pool } = require('pg');
const dns = require('dns');
const net = require('net');
const { promisify } = require('util');

const lookup = promisify(dns.lookup);

async function diagnoseConnection() {
  console.log('🔍 详细诊断数据库连接问题...\n');

  // 1. DNS解析测试
  console.log('1. DNS解析测试...');
  try {
    const addresses = await lookup('db.yyfyieqfuwwyqrlewswu.supabase.co');
    console.log(
      `✅ DNS解析成功: ${addresses.address} (${addresses.family === 4 ? 'IPv4' : 'IPv6'})`,
    );
  } catch (error) {
    console.log(`❌ DNS解析失败: ${error.message}`);
    return;
  }

  // 2. 端口连接测试
  console.log('\n2. 端口连接测试...');
  const testConnection = (host, port) => {
    return new Promise((resolve) => {
      const socket = new net.Socket();
      const timeout = 10000;

      socket.setTimeout(timeout);

      socket.on('connect', () => {
        console.log(`✅ 端口 ${port} 连接成功`);
        socket.destroy();
        resolve(true);
      });

      socket.on('timeout', () => {
        console.log(`❌ 端口 ${port} 连接超时`);
        socket.destroy();
        resolve(false);
      });

      socket.on('error', (error) => {
        console.log(`❌ 端口 ${port} 连接失败: ${error.message}`);
        socket.destroy();
        resolve(false);
      });

      socket.connect(port, host);
    });
  };

  const addresses = await lookup('db.yyfyieqfuwwyqrlewswu.supabase.co');
  await testConnection(addresses.address, 5432);

  // 3. PostgreSQL连接测试
  console.log('\n3. PostgreSQL连接测试...');

  // 测试不同的连接字符串格式
  const connectionStrings = [
    `postgresql://postgres:[YOUR-PASSWORD]@db.yyfyieqfuwwyqrlewswu.supabase.co:5432/postgres`,
    `postgresql://postgres:[YOUR-PASSWORD]@${addresses.address}:5432/postgres`,
    `postgresql://postgres:%5BYOUR-PASSWORD%5D@db.yyfyieqfuwwyqrlewswu.supabase.co:5432/postgres`,
    `postgresql://postgres:%5BYOUR-PASSWORD%5D@${addresses.address}:5432/postgres`,
  ];

  for (let i = 0; i < connectionStrings.length; i++) {
    console.log(`\n测试连接字符串 ${i + 1}:`);
    console.log(
      `格式: ${connectionStrings[i].replace(/\[YOUR-PASSWORD\]|%5BYOUR-PASSWORD%5D/g, '***')}`,
    );

    const pool = new Pool({
      connectionString: connectionStrings[i],
      max: 1,
      idleTimeoutMillis: 10000,
      connectionTimeoutMillis: 10000,
    });

    try {
      const client = await pool.connect();
      console.log('✅ PostgreSQL连接成功！');

      // 测试查询
      const result = await client.query('SELECT version()');
      console.log(`✅ 数据库版本: ${result.rows[0].version.split(' ')[0]}`);

      // 检查表
      const tableResult = await client.query(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name LIKE 'shadowing%'
        ORDER BY table_name
      `);
      console.log(`✅ 找到表: ${tableResult.rows.map((r) => r.table_name).join(', ')}`);

      client.release();
      await pool.end();

      console.log('🎉 连接测试成功！');
      return;
    } catch (error) {
      console.log(`❌ 连接失败: ${error.message}`);
      if (error.code) {
        console.log(`   错误代码: ${error.code}`);
      }
      await pool.end();
    }
  }

  console.log('\n❌ 所有连接方式都失败了');
}

diagnoseConnection().catch(console.error);
