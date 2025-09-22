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
      const localUrl = process.env.LOCAL_DB_URL;
      if (!localUrl) {
        throw new Error('本地数据库配置未找到: 请设置 LOCAL_DB_URL 环境变量');
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
      // 测试PostgreSQL连接
      const client = connection.client as Client;
      await client.connect();
      
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
      const client = connection.client as Client;
      await client.connect();
      
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
      const client = connection.client as Client;
      await client.connect();
      
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
      const client = connection.client as Client;
      await client.connect();
      
      const result = await client.query(`SELECT * FROM "${tableName}"`);
      
      await client.end();
      
      return result.rows;
    }
  } catch (error) {
    throw new Error(`获取表数据失败: ${error instanceof Error ? error.message : '未知错误'}`);
  }
}
