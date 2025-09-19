import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin';
import { getServiceSupabase } from '@/lib/supabaseAdmin';

export async function POST(req: NextRequest) {
  try {
    await requireAdmin(req);

    const supabase = getServiceSupabase();

    // 直接执行SQL创建函数
    const createFunctionsSQL = `
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
    `;

    // 使用原始SQL查询执行
    const { data, error } = await supabase
      .from('_supabase_migrations')
      .select('*')
      .limit(1);

    if (error) {
      // 如果无法访问迁移表，尝试直接执行SQL
      console.log('无法访问迁移表，尝试其他方法');
    }

    // 尝试通过RPC调用执行SQL
    try {
      const { error: execError } = await supabase.rpc('exec_sql', {
        sql: createFunctionsSQL
      });

      if (execError) {
        return NextResponse.json({
          success: false,
          error: '创建函数失败',
          details: execError.message,
          suggestion: '请手动在Supabase SQL Editor中执行以下SQL脚本：',
          sql: createFunctionsSQL
        });
      }

      return NextResponse.json({
        success: true,
        message: '数据库函数创建成功'
      });

    } catch (rpcError) {
      // 如果RPC调用失败，提供手动执行的SQL
      return NextResponse.json({
        success: false,
        error: '无法通过API创建函数',
        details: rpcError instanceof Error ? rpcError.message : '未知错误',
        suggestion: '请手动在Supabase SQL Editor中执行以下SQL脚本：',
        sql: createFunctionsSQL
      });
    }

  } catch (error) {
    console.error('创建数据库函数失败:', error);
    return NextResponse.json(
      { error: `创建数据库函数失败: ${error instanceof Error ? error.message : '未知错误'}` },
      { status: 500 }
    );
  }
}
