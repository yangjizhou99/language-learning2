import { Client } from 'pg';
import { createClient } from '@supabase/supabase-js';

export type DatabaseType = 'local' | 'prod' | 'supabase';

export interface DatabaseConnection {
  type: DatabaseType;
  name: string;
  client: Client | any;
  connectionString?: string;
}

// 创建PostgreSQL客户端连接
export function createPostgresClient(connectionString: string): Client {
  try {
    const url = new URL(connectionString);
    const hostname = url.hostname;
    const isLocalHost = hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1' || url.port === '54322';

    if (isLocalHost) {
      // 归一化为 IPv4，避免在 Windows 上解析为 ::1 导致连接失败
      if (hostname === 'localhost' || hostname === '::1') {
        url.hostname = '127.0.0.1';
      }
      // 本地未显式指定端口时，默认使用 Supabase 本地端口 54322（不再读取 PGPORT 以避免误导）
      if (!url.port || url.port === '') {
        url.port = '54322';
      }
      // 移除可能强制 SSL 的参数
      url.searchParams.delete('sslmode');

      return new Client({ connectionString: url.toString(), ssl: false });
    }
  } catch {
    // ignore URL parse error and fallback below
  }
  return new Client({ connectionString });
}

// 创建Supabase客户端连接
export function createSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  
  if (!url || !serviceKey) {
    throw new Error('Supabase配置不完整: 缺少 NEXT_PUBLIC_SUPABASE_URL 或 SUPABASE_SERVICE_ROLE_KEY');
  }
  
  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

// 根据数据库类型创建连接
export function createDatabaseConnection(type: DatabaseType): DatabaseConnection {
  switch (type) {
    case 'local':
      const localUrl = process.env.LOCAL_DB_URL_FORCE || process.env.LOCAL_DB_URL;
      if (!localUrl) {
        throw new Error('本地数据库配置未找到: 请设置 LOCAL_DB_URL 或 LOCAL_DB_URL_FORCE 环境变量');
      }
      return {
        type: 'local',
        name: '本地数据库',
        client: createPostgresClient(localUrl),
        connectionString: localUrl
      };
      
    case 'prod':
      const prodUrl = process.env.PROD_DB_URL;
      if (!prodUrl) {
        throw new Error('生产数据库配置未找到: 请设置 PROD_DB_URL 环境变量');
      }
      return {
        type: 'prod',
        name: '生产环境数据库',
        client: createPostgresClient(prodUrl),
        connectionString: prodUrl
      };
      
    case 'supabase':
      return {
        type: 'supabase',
        name: 'Supabase 数据库',
        client: createSupabaseClient()
      };
      
    default:
      throw new Error(`不支持的数据库类型: ${type}`);
  }
}

// 尝试以多端口回退方式建立本地连接（优先用于开发场景）
export async function connectPostgresWithFallback(connectionString: string): Promise<{ client: Client; effective: string }>
{
  // 优先使用传入端口；若为本地且端口为 5432/未写，则尝试 54340、54322
  let candidates: string[] = [];
  try {
    const url = new URL(connectionString);
    const isLocal = url.hostname === 'localhost' || url.hostname === '127.0.0.1' || url.hostname === '::1';
    const currentPort = url.port || '';
    const normalizedHost = (url.hostname === 'localhost' || url.hostname === '::1') ? '127.0.0.1' : url.hostname;

    if (isLocal) {
      if (!currentPort) {
        candidates = ['54340', '54322', '5432'];
      } else if (currentPort === '5432') {
        candidates = ['5432', '54340', '54322'];
      } else {
        candidates = [currentPort, '54340', '54322', '5432'];
      }

      let lastErr: unknown = null;
      for (const port of candidates) {
        try {
          const u = new URL(connectionString);
          u.hostname = normalizedHost;
          u.port = port;
          u.searchParams.delete('sslmode');
          const client = new Client({ connectionString: u.toString(), ssl: false });
          await client.connect();
          console.log(`本地连接成功: ${u.hostname}:${port}`);
          return { client, effective: u.toString() };
        } catch (err) {
          lastErr = err;
        }
      }
      throw lastErr instanceof Error ? lastErr : new Error('本地连接失败');
    }
  } catch {
    // 不是合法URL或非本地，走默认单次连接
  }

  // 非本地或解析失败，按原样连接一次
  const client = new Client({ connectionString, ssl: undefined as any });
  await client.connect();
  return { client, effective: connectionString };
}

// 测试数据库连接
export async function testDatabaseConnection(type: DatabaseType): Promise<{
  success: boolean;
  error?: string;
  tableCount?: number;
  tables?: string[];
}> {
  const connection = createDatabaseConnection(type);
  
  try {
    if (type === 'supabase') {
      // 测试Supabase连接
      const supabase = connection.client;
      const { data: tables, error } = await supabase.rpc('get_table_list');
      
      if (error) {
        return {
          success: false,
          error: `Supabase连接失败: ${error.message}`
        };
      }
      
      return {
        success: true,
        tableCount: tables?.length || 0,
        tables: tables?.map((t: any) => t.table_name) || []
      };
    } else {
      // 测试PostgreSQL连接（带端口回退）
      const { client } = await connectPostgresWithFallback(connection.connectionString!);
      
      // 获取表列表
      const result = await client.query(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_type = 'BASE TABLE'
        ORDER BY table_name
      `);
      
      const tables = result.rows.map(row => row.table_name);
      
      await client.end();
      
      return {
        success: true,
        tableCount: tables.length,
        tables
      };
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : '未知错误'
    };
  }
}

// 获取表列表
export async function getTableList(type: DatabaseType): Promise<string[]> {
  const connection = createDatabaseConnection(type);
  
  try {
    if (type === 'supabase') {
      const supabase = connection.client;
      const { data: tables, error } = await supabase.rpc('get_table_list');
      
      if (error) {
        throw new Error(`获取表列表失败: ${error.message}`);
      }
      
      return tables?.map((t: any) => t.table_name) || [];
    } else {
      const { client, effective } = await connectPostgresWithFallback(connection.connectionString!);
      try {
        const u = new URL(effective);
        console.log(`正在连接 Postgres: ${u.hostname}:${u.port || '5432'} (${type})`);
      } catch {}
      
      const result = await client.query(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_type = 'BASE TABLE'
        ORDER BY table_name
      `);
      
      await client.end();
      
      return result.rows.map(row => row.table_name);
    }
  } catch (error) {
    throw new Error(`获取表列表失败: ${error instanceof Error ? error.message : '未知错误'}`);
  }
}

// 获取表列信息
export async function getTableColumns(type: DatabaseType, tableName: string): Promise<any[]> {
  const connection = createDatabaseConnection(type);
  
  try {
    if (type === 'supabase') {
      const supabase = connection.client;
      const { data: columns, error } = await supabase.rpc('get_table_columns', {
        table_name_param: tableName
      });
      
      if (error) {
        throw new Error(`获取表列信息失败: ${error.message}`);
      }
      
      return columns || [];
    } else {
      const { client, effective } = await connectPostgresWithFallback(connection.connectionString!);
      try {
        const u = new URL(effective);
        console.log(`正在连接 Postgres: ${u.hostname}:${u.port || '5432'} (${type})`);
      } catch {}
      
      const result = await client.query(`
        SELECT column_name, data_type, is_nullable, column_default
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = $1
        ORDER BY ordinal_position
      `, [tableName]);
      
      await client.end();
      
      return result.rows.map(row => ({
        column_name: row.column_name,
        data_type: row.data_type,
        is_nullable: row.is_nullable === 'YES',
        column_default: row.column_default
      }));
    }
  } catch (error) {
    throw new Error(`获取表列信息失败: ${error instanceof Error ? error.message : '未知错误'}`);
  }
}

// 获取表数据
export async function getTableData(type: DatabaseType, tableName: string): Promise<any[]> {
  const connection = createDatabaseConnection(type);
  
  try {
    if (type === 'supabase') {
      const supabase = connection.client;
      const { data: rows, error } = await supabase
        .from(tableName)
        .select('*');
      
      if (error) {
        throw new Error(`获取表数据失败: ${error.message}`);
      }
      
      return rows || [];
    } else {
      const { client, effective } = await connectPostgresWithFallback(connection.connectionString!);
      try {
        const u = new URL(effective);
        console.log(`正在连接 Postgres: ${u.hostname}:${u.port || '5432'} (${type})`);
      } catch {}
      
      const result = await client.query(`SELECT * FROM "${tableName}"`);
      
      await client.end();
      
      return result.rows;
    }
  } catch (error) {
    throw new Error(`获取表数据失败: ${error instanceof Error ? error.message : '未知错误'}`);
  }
}
