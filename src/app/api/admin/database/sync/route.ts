import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin';
import { getLocal, getProd } from '@/lib/db';

export const dynamic = 'force-dynamic';

interface SyncResult {
  table: string;
  success: boolean;
  rowsProcessed: number;
  message: string;
  duration: number;
}

// 获取所有表名
async function getAllTables(client: any) {
  const result = await client.query(`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_type = 'BASE TABLE'
    ORDER BY table_name
  `);
  return result.rows.map((row: any) => row.table_name);
}

// 获取表数据行数
async function getTableRowCount(client: any, tableName: string) {
  const result = await client.query(`SELECT COUNT(*) as count FROM "${tableName}"`);
  return parseInt(result.rows[0].count);
}

// 获取表的列信息
async function getTableColumns(client: any, tableName: string) {
  const result = await client.query(`
    SELECT column_name, data_type, udt_name
    FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = $1
    ORDER BY ordinal_position
  `, [tableName]);
  
  return result.rows;
}

// 处理列值，根据数据类型进行适当的转换
function processColumnValue(value: any, columnInfo: any) {
  if (value === null || value === undefined) {
    return null;
  }
  
  // 处理数组类型
  if (columnInfo.udt_name === 'uuid' && Array.isArray(value)) {
    return value; // PostgreSQL 数组，直接返回
  }
  
  // 处理JSONB类型
  if (columnInfo.data_type === 'jsonb') {
    if (typeof value === 'object' && value !== null) {
      return JSON.stringify(value);
    }
    return value;
  }
  
  // 处理其他对象类型（如日期）
  if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
    // 检查是否是日期对象
    if (value instanceof Date) {
      return value.toISOString();
    }
    // 其他对象类型，尝试转换为字符串
    return String(value);
  }
  
  return value;
}

// 同步单个表
async function syncTable(localClient: any, prodClient: any, tableName: string): Promise<SyncResult> {
  const startTime = Date.now();
  
  try {
    // 获取本地数据
    const localResult = await localClient.query(`SELECT * FROM "${tableName}"`);
    const localRows = localResult.rows;
    
    if (localRows.length === 0) {
      return {
        table: tableName,
        success: true,
        rowsProcessed: 0,
        message: '本地表为空',
        duration: Date.now() - startTime
      };
    }
    
    // 获取表结构信息
    const columnInfos = await getTableColumns(localClient, tableName);
    const columnMap = new Map(columnInfos.map((col: any) => [col.column_name, col]));
    
    // 开始事务
    await prodClient.query('BEGIN');
    
    try {
      // 清空目标表
      await prodClient.query(`TRUNCATE TABLE "${tableName}" CASCADE`);
      
      // 插入数据
      if (localRows.length > 0) {
        // 获取列名
        const columns = Object.keys(localRows[0]);
        const columnNames = columns.map(col => `"${col}"`).join(', ');
        const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ');
        
        // 批量插入
        const insertQuery = `INSERT INTO "${tableName}" (${columnNames}) VALUES (${placeholders})`;
        
        for (const row of localRows) {
          const values = columns.map(col => {
            const value = row[col];
            const columnInfo = columnMap.get(col);
            return processColumnValue(value, columnInfo);
          });
          await prodClient.query(insertQuery, values);
        }
      }
      
      // 提交事务
      await prodClient.query('COMMIT');
      
      // 验证同步结果
      const prodCount = await getTableRowCount(prodClient, tableName);
      
      if (prodCount === localRows.length) {
        return {
          table: tableName,
          success: true,
          rowsProcessed: prodCount,
          message: '同步成功',
          duration: Date.now() - startTime
        };
      } else {
        return {
          table: tableName,
          success: false,
          rowsProcessed: prodCount,
          message: `行数不匹配: 期望 ${localRows.length}，实际 ${prodCount}`,
          duration: Date.now() - startTime
        };
      }
      
    } catch (error) {
      await prodClient.query('ROLLBACK');
      throw error;
    }
    
  } catch (error) {
    return {
      table: tableName,
      success: false,
      rowsProcessed: 0,
      message: error instanceof Error ? error.message : String(error),
      duration: Date.now() - startTime
    };
  }
}

// 预览同步（不实际执行）
async function previewSync(localClient: any, tables: string[]): Promise<SyncResult[]> {
  const results: SyncResult[] = [];
  
  for (const tableName of tables) {
    const startTime = Date.now();
    
    try {
      const localCount = await getTableRowCount(localClient, tableName);
      
      results.push({
        table: tableName,
        success: true,
        rowsProcessed: localCount,
        message: '预览模式',
        duration: Date.now() - startTime
      });
    } catch (error) {
      results.push({
        table: tableName,
        success: false,
        rowsProcessed: 0,
        message: error instanceof Error ? error.message : String(error),
        duration: Date.now() - startTime
      });
    }
  }
  
  return results;
}

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAdmin(req);
    if (!auth.ok) {
      return NextResponse.json({ error: 'forbidden' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const action = searchParams.get('action') || 'preview';
    const tablesParam = searchParams.get('tables');
    
    // 检查环境变量
    if (!process.env.LOCAL_DB_URL || !process.env.PROD_DB_URL) {
      return NextResponse.json({
        error: '缺少数据库连接配置',
        details: '请设置 LOCAL_DB_URL 和 PROD_DB_URL 环境变量'
      }, { status: 500 });
    }

    const localClient = getLocal();
    const prodClient = getProd();

    try {
      await localClient.connect();
      await prodClient.connect();

      // 获取所有表
      const allTables = await getAllTables(localClient);
      
      // 确定要同步的表
      let tablesToSync = allTables;
      if (tablesParam) {
        const requestedTables = tablesParam.split(',').map(t => t.trim());
        tablesToSync = requestedTables.filter(table => allTables.includes(table));
      }

      if (action === 'preview') {
        // 预览模式
        const results = await previewSync(localClient, tablesToSync);
        
        return NextResponse.json({
          success: true,
          action: 'preview',
          tables: tablesToSync,
          results,
          summary: {
            total: results.length,
            successful: results.filter(r => r.success).length,
            failed: results.filter(r => !r.success).length,
            totalRows: results.reduce((sum, r) => sum + r.rowsProcessed, 0)
          }
        });
      } else if (action === 'sync') {
        // 执行同步
        const results: SyncResult[] = [];
        const startTime = Date.now();
        
        for (const tableName of tablesToSync) {
          const result = await syncTable(localClient, prodClient, tableName);
          results.push(result);
        }
        
        const duration = Date.now() - startTime;
        
        return NextResponse.json({
          success: true,
          action: 'sync',
          tables: tablesToSync,
          results,
          summary: {
            total: results.length,
            successful: results.filter(r => r.success).length,
            failed: results.filter(r => !r.success).length,
            totalRows: results.reduce((sum, r) => sum + r.rowsProcessed, 0),
            duration
          }
        });
      } else {
        return NextResponse.json({
          error: '无效的操作',
          details: '支持的操作: preview, sync'
        }, { status: 400 });
      }

    } finally {
      await localClient.end();
      await prodClient.end();
    }

  } catch (error) {
    console.error('数据库同步错误:', error);
    return NextResponse.json({
      error: '数据库同步失败',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAdmin(req);
    if (!auth.ok) {
      return NextResponse.json({ error: 'forbidden' }, { status: 403 });
    }

    const body = await req.json();
    const { tables, action = 'sync' } = body;

    // 检查环境变量
    if (!process.env.LOCAL_DB_URL || !process.env.PROD_DB_URL) {
      return NextResponse.json({
        error: '缺少数据库连接配置',
        details: '请设置 LOCAL_DB_URL 和 PROD_DB_URL 环境变量'
      }, { status: 500 });
    }

    const localClient = getLocal();
    const prodClient = getProd();

    try {
      await localClient.connect();
      await prodClient.connect();

      // 获取所有表
      const allTables = await getAllTables(localClient);
      
      // 确定要同步的表
      let tablesToSync = allTables;
      if (tables && Array.isArray(tables)) {
        tablesToSync = tables.filter(table => allTables.includes(table));
      }

      if (action === 'preview') {
        // 预览模式
        const results = await previewSync(localClient, tablesToSync);
        
        return NextResponse.json({
          success: true,
          action: 'preview',
          tables: tablesToSync,
          results,
          summary: {
            total: results.length,
            successful: results.filter(r => r.success).length,
            failed: results.filter(r => !r.success).length,
            totalRows: results.reduce((sum, r) => sum + r.rowsProcessed, 0)
          }
        });
      } else if (action === 'sync') {
        // 执行同步
        const results: SyncResult[] = [];
        const startTime = Date.now();
        
        for (const tableName of tablesToSync) {
          const result = await syncTable(localClient, prodClient, tableName);
          results.push(result);
        }
        
        const duration = Date.now() - startTime;
        
        return NextResponse.json({
          success: true,
          action: 'sync',
          tables: tablesToSync,
          results,
          summary: {
            total: results.length,
            successful: results.filter(r => r.success).length,
            failed: results.filter(r => !r.success).length,
            totalRows: results.reduce((sum, r) => sum + r.rowsProcessed, 0),
            duration
          }
        });
      } else {
        return NextResponse.json({
          error: '无效的操作',
          details: '支持的操作: preview, sync'
        }, { status: 400 });
      }

    } finally {
      await localClient.end();
      await prodClient.end();
    }

  } catch (error) {
    console.error('数据库同步错误:', error);
    return NextResponse.json({
      error: '数据库同步失败',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}
