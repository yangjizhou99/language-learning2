import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin';
import { Pool } from 'pg';

export const dynamic = 'force-dynamic';

interface SyncResult {
  table: string;
  success: boolean;
  rowsProcessed: number;
  message: string;
  duration: number;
  errors?: string[];
  localRows?: number;
  remoteRows?: number;
  progress?: number;
}

interface SyncSummary {
  total: number;
  successful: number;
  failed: number;
  totalRows: number;
  duration?: number;
}

// 获取表的外键依赖关系
async function getTableDependencies(client: any, tableName: string) {
  const result = await client.query(`
    SELECT
      tc.table_name,
      kcu.column_name,
      ccu.table_name AS foreign_table_name,
      ccu.column_name AS foreign_column_name
    FROM information_schema.table_constraints AS tc
    JOIN information_schema.key_column_usage AS kcu
      ON tc.constraint_name = kcu.constraint_name
      AND tc.table_schema = kcu.table_schema
    JOIN information_schema.constraint_column_usage AS ccu
      ON ccu.constraint_name = tc.constraint_name
      AND ccu.table_schema = tc.table_schema
    WHERE tc.constraint_type = 'FOREIGN KEY'
      AND tc.table_name = $1
  `, [tableName]);
  
  return result.rows;
}

// 获取所有表并按依赖关系排序
async function getTablesInOrder(client: any) {
  const result = await client.query(`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_type = 'BASE TABLE'
    ORDER BY table_name
  `);
  
  const tables = result.rows.map((row: any) => row.table_name);
  const sortedTables = [];
  const visited = new Set();
  
  // 简单的拓扑排序，优先处理没有外键依赖的表
  const tablesWithoutFK = [];
  const tablesWithFK = [];
  
  for (const table of tables) {
    const dependencies = await getTableDependencies(client, table);
    if (dependencies.length === 0) {
      tablesWithoutFK.push(table);
    } else {
      tablesWithFK.push(table);
    }
  }
  
  // 先添加没有外键的表
  sortedTables.push(...tablesWithoutFK);
  
  // 然后添加有外键的表
  sortedTables.push(...tablesWithFK);
  
  return sortedTables;
}

// 修复JSON数据
function fixJsonData(row: any) {
  const fixedRow = { ...row };
  
  for (const [key, value] of Object.entries(fixedRow)) {
    if (typeof value === 'string' && (key.includes('meta') || key.includes('json') || key.includes('data') || key.includes('blanks') || key.includes('keys') || key.includes('ai_') || key.includes('cloze_'))) {
      try {
        // 尝试解析JSON
        JSON.parse(value);
      } catch {
        // 如果解析失败，尝试修复常见的JSON问题
        let fixedValue = value;
        
        // 如果值为空或null，设置为空对象
        if (!fixedValue || fixedValue.trim() === '' || fixedValue === 'null') {
          fixedRow[key] = '{}';
          continue;
        }
        
        // 修复单引号问题
        fixedValue = fixedValue.replace(/'/g, '"');
        
        // 修复缺少引号的键
        fixedValue = fixedValue.replace(/(\w+):/g, '"$1":');
        
        // 修复布尔值
        fixedValue = fixedValue.replace(/:\s*(true|false)\s*([,}])/g, ': $1$2');
        
        // 修复null值
        fixedValue = fixedValue.replace(/:\s*null\s*([,}])/g, ': null$1');
        
        // 修复数组格式
        fixedValue = fixedValue.replace(/\[([^\[\]]*)\]/g, (match, content) => {
          if (content.trim() === '') return '[]';
          return match;
        });
        
        // 修复对象格式
        if (!fixedValue.startsWith('{') && !fixedValue.startsWith('[')) {
          fixedValue = '{' + fixedValue + '}';
        }
        
        try {
          JSON.parse(fixedValue);
          fixedRow[key] = fixedValue;
        } catch {
          // 如果还是无法修复，根据内容类型设置默认值
          if (key.includes('blanks') || key.includes('cloze_')) {
            fixedRow[key] = '[]'; // 数组类型
          } else {
            fixedRow[key] = '{}'; // 对象类型
          }
        }
      }
    }
  }
  
  return fixedRow;
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

// 创建数据库连接池
function createPools() {
  const localPool = new Pool({
    connectionString: process.env.LOCAL_DB_URL,
    max: 5,
    idleTimeoutMillis: 30000,
  });

  const prodPool = new Pool({
    connectionString: process.env.PROD_DB_URL,
    max: 5,
    idleTimeoutMillis: 30000,
  });

  return { localPool, prodPool };
}

// 同步单个表（基于成功页面的实现）
async function syncTableAdvanced(localPool: Pool, prodPool: Pool, tableName: string, onProgress?: (progress: number) => void): Promise<SyncResult> {
  const startTime = Date.now();
  const errors: string[] = [];
  let localClient: any = null;
  let prodClient: any = null;
  
  try {
    // 获取连接
    localClient = await localPool.connect();
    prodClient = await prodPool.connect();
    
    // 获取本地数据
    const localResult = await localClient.query(`SELECT * FROM "${tableName}"`);
    const localRows = localResult.rows;
    
    if (localRows.length === 0) {
      return {
        table: tableName,
        success: true,
        rowsProcessed: 0,
        message: '本地表为空',
        duration: Date.now() - startTime,
        localRows: 0,
        remoteRows: 0,
        progress: 100
      };
    }
    
    // 获取表结构信息
    const columnInfos = await getTableColumns(localClient, tableName);
    const columnMap = new Map(columnInfos.map((col: any) => [col.column_name, col]));
    
    // 开始事务
    await prodClient.query('BEGIN');
    
    try {
      // 临时禁用外键检查
      await prodClient.query('SET session_replication_role = replica');
      
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
        
        let successCount = 0;
        for (let i = 0; i < localRows.length; i++) {
          const row = localRows[i];
          try {
            // 修复JSON数据
            const fixedRow = fixJsonData(row);
            const values = columns.map(col => {
              const value = fixedRow[col];
              const columnInfo = columnMap.get(col);
              return processColumnValue(value, columnInfo);
            });
            await prodClient.query(insertQuery, values);
            successCount++;
          } catch (error) {
            const errorMsg = error instanceof Error ? error.message : String(error);
            const rowData = JSON.stringify(row, null, 2).substring(0, 200) + '...';
            errors.push(`行 ${i + 1}: ${errorMsg}\n数据: ${rowData}`);
            console.warn(`跳过有问题的行 ${i + 1}: ${errorMsg}`);
          }
          
          // 更新进度
          const progress = Math.round(((i + 1) / localRows.length) * 100);
          if (onProgress) {
            onProgress(progress);
          }
        }
        
        if (successCount === 0) {
          const firstError = errors[0] || '未知错误';
          throw new Error(`所有行都插入失败。第一个错误: ${firstError}`);
        }
        
        if (successCount < localRows.length) {
          errors.push(`跳过了 ${localRows.length - successCount} 行有问题的数据`);
        }
      }
      
      // 恢复外键检查
      await prodClient.query('SET session_replication_role = DEFAULT');
      
      // 提交事务
      await prodClient.query('COMMIT');
      
      // 验证同步结果
      const prodCount = await prodClient.query(`SELECT COUNT(*) as count FROM "${tableName}"`);
      const finalCount = parseInt(prodCount.rows[0].count);
      
      // 检查行数是否一致
      const isRowCountMatch = finalCount === localRows.length;
      const success = isRowCountMatch && errors.length === 0;
      
      return {
        table: tableName,
        success,
        rowsProcessed: finalCount,
        message: success ? '同步成功' : 
                 !isRowCountMatch ? `行数不匹配: 本地${localRows.length}行，远程${finalCount}行` :
                 errors.length > 0 ? `同步成功，但有警告` : '同步失败',
        duration: Date.now() - startTime,
        errors: errors.length > 0 ? errors : undefined,
        localRows: localRows.length,
        remoteRows: finalCount,
        progress: 100
      };
      
    } catch (error) {
      await prodClient.query('ROLLBACK');
      // 恢复外键检查
      await prodClient.query('SET session_replication_role = DEFAULT');
      throw error;
    }
    
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    return {
      table: tableName,
      success: false,
      rowsProcessed: 0,
      message: errorMsg,
      duration: Date.now() - startTime,
      errors: [errorMsg],
      localRows: 0,
      remoteRows: 0,
      progress: 0
    };
  } finally {
    // 释放连接
    if (localClient) localClient.release();
    if (prodClient) prodClient.release();
  }
}

// 预览同步（改进版）
async function previewSyncAdvanced(localClient: any, tables: string[]): Promise<SyncResult[]> {
  const results: SyncResult[] = [];
  
  for (const tableName of tables) {
    const startTime = Date.now();
    
    try {
      const localCount = await localClient.query(`SELECT COUNT(*) as count FROM "${tableName}"`);
      const count = parseInt(localCount.rows[0].count);
      
      // 检查是否有JSON列
      const columns = await localClient.query(`
        SELECT column_name, data_type
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = $1
        AND data_type = 'jsonb'
      `, [tableName]);
      
      const hasJsonColumns = columns.rows.length > 0;
      
      results.push({
        table: tableName,
        success: true,
        rowsProcessed: count,
        message: hasJsonColumns ? '预览模式（包含JSON列）' : '预览模式',
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

    // 创建连接池
    const { localPool, prodPool } = createPools();
    let localClient: any = null;
    let prodClient: any = null;

    try {
      // 获取连接
      localClient = await localPool.connect();
      prodClient = await prodPool.connect();

      // 获取所有表并按依赖关系排序
      const allTables = await getTablesInOrder(localClient);
      
      // 确定要同步的表
      let tablesToSync = allTables;
      if (tablesParam) {
        const requestedTables = tablesParam.split(',').map(t => t.trim());
        tablesToSync = requestedTables.filter(table => allTables.includes(table));
      }

      if (action === 'preview') {
        // 预览模式
        const results = await previewSyncAdvanced(localClient, tablesToSync);
        
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
        
        for (let i = 0; i < tablesToSync.length; i++) {
          const tableName = tablesToSync[i];
          const result = await syncTableAdvanced(localPool, prodPool, tableName);
          results.push(result);
          
          // 记录进度
          console.log(`同步进度: ${i + 1}/${tablesToSync.length} - ${tableName}: ${result.success ? '成功' : '失败'}`);
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
      // 释放连接
      if (localClient) localClient.release();
      if (prodClient) prodClient.release();
      // 关闭连接池
      await localPool.end();
      await prodPool.end();
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

    // 创建连接池
    const { localPool, prodPool } = createPools();
    let localClient: any = null;
    let prodClient: any = null;

    try {
      // 获取连接
      localClient = await localPool.connect();
      prodClient = await prodPool.connect();

      // 获取所有表并按依赖关系排序
      const allTables = await getTablesInOrder(localClient);
      
      // 确定要同步的表
      let tablesToSync = allTables;
      if (tables && Array.isArray(tables)) {
        tablesToSync = tables.filter(table => allTables.includes(table));
      }

      if (action === 'preview') {
        // 预览模式
        const results = await previewSyncAdvanced(localClient, tablesToSync);
        
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
        
        for (let i = 0; i < tablesToSync.length; i++) {
          const tableName = tablesToSync[i];
          const result = await syncTableAdvanced(localPool, prodPool, tableName);
          results.push(result);
          
          // 记录进度
          console.log(`同步进度: ${i + 1}/${tablesToSync.length} - ${tableName}: ${result.success ? '成功' : '失败'}`);
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
      // 释放连接
      if (localClient) localClient.release();
      if (prodClient) prodClient.release();
      // 关闭连接池
      await localPool.end();
      await prodPool.end();
    }

  } catch (error) {
    console.error('数据库同步错误:', error);
    return NextResponse.json({
      error: '数据库同步失败',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}
