import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin';
import { getLocal, getProd } from '@/lib/db';

export const dynamic = 'force-dynamic';

interface ConnectionTestResult {
  name: string;
  success: boolean;
  version?: string;
  tableCount?: number;
  error?: string;
  duration: number;
}

// 测试数据库连接
async function testConnection(connectionString: string, name: string): Promise<ConnectionTestResult> {
  const startTime = Date.now();
  const client = getLocal(); // 根据名称选择客户端
  
  try {
    await client.connect();
    
    // 测试查询
    const versionResult = await client.query('SELECT version()');
    const version = versionResult.rows[0].version.split(' ')[0];
    
    // 获取表数量
    const tableResult = await client.query(`
      SELECT COUNT(*) as count 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_type = 'BASE TABLE'
    `);
    const tableCount = parseInt(tableResult.rows[0].count);
    
    return {
      name,
      success: true,
      version,
      tableCount,
      duration: Date.now() - startTime
    };
  } catch (error) {
    return {
      name,
      success: false,
      error: error instanceof Error ? error.message : String(error),
      duration: Date.now() - startTime
    };
  } finally {
    await client.end();
  }
}

// 获取表列表
async function getTableList(connectionString: string, name: string) {
  const client = name === '本地' ? getLocal() : getProd();
  
  try {
    await client.connect();
    
    const result = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `);
    
    return result.rows.map(row => row.table_name);
  } catch (error) {
    console.error(`获取 ${name} 表列表失败:`, error);
    return [];
  } finally {
    await client.end();
  }
}

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAdmin(req);
    if (!auth.ok) {
      return NextResponse.json({ error: 'forbidden' }, { status: 403 });
    }

    // 检查环境变量
    if (!process.env.LOCAL_DB_URL || !process.env.PROD_DB_URL) {
      return NextResponse.json({
        error: '缺少数据库连接配置',
        details: '请设置 LOCAL_DB_URL 和 PROD_DB_URL 环境变量'
      }, { status: 500 });
    }

    // 测试本地数据库连接
    const localResult = await testConnection(process.env.LOCAL_DB_URL, '本地');
    
    // 测试云端数据库连接
    const prodResult = await testConnection(process.env.PROD_DB_URL, '云端');

    // 如果连接成功，获取表列表进行比较
    let tableComparison = null;
    if (localResult.success && prodResult.success) {
      const localTables = await getTableList(process.env.LOCAL_DB_URL, '本地');
      const prodTables = await getTableList(process.env.PROD_DB_URL, '云端');
      
      const onlyInLocal = localTables.filter(table => !prodTables.includes(table));
      const onlyInProd = prodTables.filter(table => !localTables.includes(table));
      const common = localTables.filter(table => prodTables.includes(table));
      
      tableComparison = {
        localTables,
        prodTables,
        common,
        onlyInLocal,
        onlyInProd
      };
    }

    return NextResponse.json({
      success: true,
      connections: [localResult, prodResult],
      tableComparison,
      summary: {
        allConnected: localResult.success && prodResult.success,
        localConnected: localResult.success,
        prodConnected: prodResult.success,
        totalTables: localResult.tableCount || 0,
        prodTables: prodResult.tableCount || 0
      }
    });

  } catch (error) {
    console.error('数据库连接测试错误:', error);
    return NextResponse.json({
      error: '数据库连接测试失败',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}
