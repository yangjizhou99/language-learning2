import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin';
import { getServiceSupabase } from '@/lib/supabaseAdmin';

export async function GET(req: NextRequest) {
  try {
    await requireAdmin(req);

    const supabase = getServiceSupabase();

    // 测试获取表列表
    const { data: tables, error: tablesError } = await supabase.rpc('get_table_list');

    if (tablesError) {
      return NextResponse.json({ 
        error: '获取表列表失败', 
        details: tablesError 
      }, { status: 500 });
    }

    // 测试获取第一个表的列信息
    if (tables && tables.length > 0) {
      const firstTable = tables[0].table_name;
      const { data: columns, error: columnsError } = await supabase.rpc('get_table_columns', {
        table_name_param: firstTable
      });

      return NextResponse.json({
        success: true,
        tableCount: tables.length,
        tables: tables.slice(0, 5), // 只返回前5个表
        firstTableColumns: columnsError ? { error: columnsError } : columns?.slice(0, 3), // 只返回前3列
      });
    }

    return NextResponse.json({
      success: true,
      tableCount: 0,
      message: '没有找到表'
    });

  } catch (error) {
    console.error('测试备份功能失败:', error);
    return NextResponse.json(
      { error: '测试失败' },
      { status: 500 }
    );
  }
}

