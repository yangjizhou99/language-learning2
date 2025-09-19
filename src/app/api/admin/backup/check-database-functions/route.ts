import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin';
import { getServiceSupabase } from '@/lib/supabaseAdmin';

export async function GET(req: NextRequest) {
  try {
    await requireAdmin(req);

    const supabase = getServiceSupabase();

    // 检查函数是否存在 - 使用RPC调用方式
    let hasGetTableList = false;
    let hasGetTableColumns = false;
    let hasExecSql = false;

    try {
      // 尝试调用 get_table_list 函数
      const { data: tableList, error: tableListError } = await supabase.rpc('get_table_list');
      if (!tableListError) {
        hasGetTableList = true;
      }
    } catch (err) {
      console.log('get_table_list 函数不存在或调用失败');
    }

    try {
      // 尝试调用 get_table_columns 函数
      const { data: columns, error: columnsError } = await supabase.rpc('get_table_columns', {
        table_name_param: 'users'
      });
      if (!columnsError) {
        hasGetTableColumns = true;
      }
    } catch (err) {
      console.log('get_table_columns 函数不存在或调用失败');
    }

    try {
      // 尝试调用 exec_sql 函数
      const { data: execResult, error: execError } = await supabase.rpc('exec_sql', {
        sql: 'SELECT 1 as test'
      });
      if (!execError) {
        hasExecSql = true;
      }
    } catch (err) {
      console.log('exec_sql 函数不存在或调用失败');
    }

    // 如果函数不存在，提供创建脚本
    let createScript = '';
    if (!hasGetTableList) {
      createScript = `
-- 创建获取表列表的函数
CREATE OR REPLACE FUNCTION get_table_list()
RETURNS TABLE(table_name text)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT t.table_name::text
  FROM information_schema.tables t
  WHERE t.table_schema = 'public'
    AND t.table_name != 'spatial_ref_sys'
    AND t.table_type = 'BASE TABLE'
  ORDER BY t.table_name;
END;
$$;

-- 创建获取表列信息的函数
CREATE OR REPLACE FUNCTION get_table_columns(table_name_param text)
RETURNS TABLE(
  column_name text,
  data_type text,
  is_nullable text,
  column_default text,
  ordinal_position integer
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    c.column_name::text,
    c.data_type::text,
    c.is_nullable::text,
    c.column_default::text,
    c.ordinal_position::integer
  FROM information_schema.columns c
  WHERE c.table_schema = 'public'
    AND c.table_name = table_name_param
  ORDER BY c.ordinal_position;
END;
$$;

-- 创建执行SQL的函数
CREATE OR REPLACE FUNCTION exec_sql(sql text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  EXECUTE sql;
END;
$$;

-- 授予服务角色执行权限
GRANT EXECUTE ON FUNCTION get_table_list() TO service_role;
GRANT EXECUTE ON FUNCTION get_table_columns(text) TO service_role;
GRANT EXECUTE ON FUNCTION exec_sql(text) TO service_role;
      `.trim();
    }

    return NextResponse.json({
      hasGetTableList,
      hasGetTableColumns,
      hasExecSql,
      createScript,
      message: hasGetTableList && hasGetTableColumns && hasExecSql
        ? '数据库函数已存在，可以正常备份' 
        : '数据库函数不存在，需要执行创建脚本'
    });

  } catch (error) {
    console.error('检查数据库函数失败:', error);
    return NextResponse.json(
      { error: `检查数据库函数失败: ${error instanceof Error ? error.message : '未知错误'}` },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    await requireAdmin(req);

    const supabase = getServiceSupabase();

    // 分别创建每个函数
    const functions = [
      {
        name: 'get_table_list',
        sql: `
          CREATE OR REPLACE FUNCTION get_table_list()
          RETURNS TABLE(table_name text)
          LANGUAGE plpgsql
          SECURITY DEFINER
          AS $$
          BEGIN
            RETURN QUERY
            SELECT t.table_name::text
            FROM information_schema.tables t
            WHERE t.table_schema = 'public'
              AND t.table_name != 'spatial_ref_sys'
              AND t.table_type = 'BASE TABLE'
            ORDER BY t.table_name;
          END;
          $$;
        `
      },
      {
        name: 'get_table_columns',
        sql: `
          CREATE OR REPLACE FUNCTION get_table_columns(table_name_param text)
          RETURNS TABLE(
            column_name text,
            data_type text,
            is_nullable text,
            column_default text,
            ordinal_position integer
          )
          LANGUAGE plpgsql
          SECURITY DEFINER
          AS $$
          BEGIN
            RETURN QUERY
            SELECT 
              c.column_name::text,
              c.data_type::text,
              c.is_nullable::text,
              c.column_default::text,
              c.ordinal_position::integer
            FROM information_schema.columns c
            WHERE c.table_schema = 'public'
              AND c.table_name = table_name_param
            ORDER BY c.ordinal_position;
          END;
          $$;
        `
      },
      {
        name: 'exec_sql',
        sql: `
          CREATE OR REPLACE FUNCTION exec_sql(sql text)
          RETURNS void
          LANGUAGE plpgsql
          SECURITY DEFINER
          AS $$
          BEGIN
            EXECUTE sql;
          END;
          $$;
        `
      }
    ];

    const results = [];
    let successCount = 0;

    for (const func of functions) {
      try {
        const { error } = await supabase.rpc('exec_sql', { sql: func.sql });
        if (error) {
          results.push({ name: func.name, success: false, error: error.message });
        } else {
          results.push({ name: func.name, success: true });
          successCount++;
        }
      } catch (err) {
        results.push({ 
          name: func.name, 
          success: false, 
          error: err instanceof Error ? err.message : '未知错误' 
        });
      }
    }

    // 设置权限
    try {
      await supabase.rpc('exec_sql', {
        sql: `
          GRANT EXECUTE ON FUNCTION get_table_list() TO service_role;
          GRANT EXECUTE ON FUNCTION get_table_columns(text) TO service_role;
          GRANT EXECUTE ON FUNCTION exec_sql(text) TO service_role;
        `
      });
    } catch (err) {
      console.log('设置权限失败，但函数可能已创建成功');
    }

    return NextResponse.json({
      success: successCount > 0,
      message: `成功创建 ${successCount}/${functions.length} 个函数`,
      results,
      details: results
    });

  } catch (error) {
    console.error('创建数据库函数失败:', error);
    return NextResponse.json(
      { error: `创建数据库函数失败: ${error instanceof Error ? error.message : '未知错误'}` },
      { status: 500 }
    );
  }
}
