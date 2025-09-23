import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin';
import { getSupabaseFor, DatabaseType } from '@/lib/supabaseEnv';

export async function GET(req: NextRequest) {
  try {
    await requireAdmin(req);

    const { searchParams } = new URL(req.url);
    const databaseType = (searchParams.get('databaseType') || 'supabase') as DatabaseType;
    if (!(['local','prod','supabase'] as const).includes(databaseType)) {
      return NextResponse.json({ error: '无效的数据库类型' }, { status: 400 });
    }

    const supabase = getSupabaseFor(databaseType);

    // 检查RPC函数是否存在
    const { data: functions, error: functionsError } = await supabase
      .from('pg_proc')
      .select('proname')
      .eq('proname', 'get_table_list');

    if (functionsError) {
      return NextResponse.json({ 
        error: '检查函数失败', 
        details: functionsError 
      }, { status: 500 });
    }

    const hasGetTableList = functions && functions.length > 0;
    
    // 尝试直接调用函数
    let functionTest = null;
    if (hasGetTableList) {
      const { data, error } = await supabase.rpc('get_table_list');
      functionTest = { data, error };
    }

    return NextResponse.json({
      success: true,
      hasGetTableList,
      functionTest,
      message: hasGetTableList ? 'RPC函数已存在' : 'RPC函数不存在，需要执行迁移'
    });

  } catch (error) {
    console.error('检查函数失败:', error);
    return NextResponse.json(
      { error: '检查失败', details: error instanceof Error ? error.message : '未知错误' },
      { status: 500 }
    );
  }
}

