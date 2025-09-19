import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin';
import { getServiceSupabase } from '@/lib/supabaseAdmin';

export async function GET(req: NextRequest) {
  try {
    await requireAdmin(req);

    const supabase = getServiceSupabase();

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
