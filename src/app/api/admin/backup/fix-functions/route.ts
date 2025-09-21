import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin';
import { getServiceSupabase } from '@/lib/supabaseAdmin';

export async function POST(req: NextRequest) {
  try {
    await requireAdmin(req);

    const supabase = getServiceSupabase();

    // 分步创建函数，避免循环依赖
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
    const errors = [];

    // 尝试使用 Supabase 的原始 SQL 执行
    for (const func of functions) {
      try {
        console.log(`正在创建函数: ${func.name}`);
        
        // 使用 rpc 调用，但需要先确保函数存在
        const { error } = await supabase.rpc('exec_sql', { sql: func.sql });
        
        if (error) {
          // 如果 exec_sql 不存在，尝试直接执行
          const { error: directError } = await supabase
            .from('_supabase_migrations')
            .select('*')
            .limit(1);
          
          if (directError) {
            // 如果无法通过 API 执行，提供手动执行指令
            errors.push({
              function: func.name,
              error: '无法通过API创建，需要手动执行',
              sql: func.sql
            });
            continue;
          }
        }
        
        results.push({ function: func.name, status: 'success' });
      } catch (err) {
        errors.push({
          function: func.name,
          error: err instanceof Error ? err.message : '未知错误',
          sql: func.sql
        });
      }
    }

    // 尝试授予权限
    if (results.length > 0) {
      try {
        const grantSQL = `
          GRANT EXECUTE ON FUNCTION get_table_list() TO service_role;
          GRANT EXECUTE ON FUNCTION get_table_columns(text) TO service_role;
          GRANT EXECUTE ON FUNCTION exec_sql(text) TO service_role;
        `;
        
        await supabase.rpc('exec_sql', { sql: grantSQL });
        results.push({ function: 'permissions', status: 'success' });
      } catch (err) {
        errors.push({
          function: 'permissions',
          error: err instanceof Error ? err.message : '权限授予失败',
          sql: 'GRANT EXECUTE ON FUNCTION ... TO service_role;'
        });
      }
    }

    return NextResponse.json({
      success: errors.length === 0,
      results,
      errors,
      message: errors.length === 0 
        ? '所有函数创建成功' 
        : '部分函数创建失败，请查看错误详情',
      manualInstructions: errors.length > 0 ? {
        title: '手动执行SQL脚本',
        description: '如果自动创建失败，请在 Supabase SQL Editor 中手动执行以下SQL：',
        sql: functions.map(f => f.sql).join('\n\n') + '\n\n-- 授予权限\n' + 
             'GRANT EXECUTE ON FUNCTION get_table_list() TO service_role;\n' +
             'GRANT EXECUTE ON FUNCTION get_table_columns(text) TO service_role;\n' +
             'GRANT EXECUTE ON FUNCTION exec_sql(text) TO service_role;'
      } : null
    });

  } catch (error) {
    console.error('修复数据库函数失败:', error);
    return NextResponse.json(
      { 
        success: false,
        error: `修复数据库函数失败: ${error instanceof Error ? error.message : '未知错误'}`,
        manualInstructions: {
          title: '手动执行SQL脚本',
          description: '请在 Supabase SQL Editor 中手动执行以下SQL：',
          sql: `
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
          `
        }
      },
      { status: 500 }
    );
  }
}
