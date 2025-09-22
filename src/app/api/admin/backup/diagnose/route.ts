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

    const diagnostics: any[] = [];

    const supabase = getSupabaseFor(databaseType);

    // 1. 检查 Supabase 连接
    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      diagnostics.push({
        test: 'Supabase 连接',
        status: authError ? 'failed' : 'success',
        message: authError ? `认证失败: ${authError.message}` : '连接正常',
        details: authError
      });
    } catch (err) {
      diagnostics.push({
        test: 'Supabase 连接',
        status: 'failed',
        message: `连接失败: ${err instanceof Error ? err.message : '未知错误'}`,
        details: err
      });
    }

    // 2. 检查 RPC 函数是否存在
    try {
      const { data: functions, error: functionsError } = await supabase
        .from('pg_proc')
        .select('proname, prosrc')
        .in('proname', ['get_table_list', 'get_table_columns', 'exec_sql']);

      diagnostics.push({
        test: 'RPC 函数检查',
        status: functionsError ? 'failed' : 'success',
        message: functionsError ? `查询失败: ${functionsError.message}` : `找到 ${functions?.length || 0} 个函数`,
        details: { functions, error: functionsError }
      });
    } catch (err) {
      diagnostics.push({
        test: 'RPC 函数检查',
        status: 'failed',
        message: `检查失败: ${err instanceof Error ? err.message : '未知错误'}`,
        details: err
      });
    }

    // 3. 测试 get_table_list 函数
    try {
      const { data: tables, error: tablesError } = await supabase.rpc('get_table_list');
      diagnostics.push({
        test: 'get_table_list 函数',
        status: tablesError ? 'failed' : 'success',
        message: tablesError ? `调用失败: ${tablesError.message}` : `成功获取 ${tables?.length || 0} 个表`,
        details: { tables: tables?.slice(0, 5), error: tablesError }
      });
    } catch (err) {
      diagnostics.push({
        test: 'get_table_list 函数',
        status: 'failed',
        message: `调用失败: ${err instanceof Error ? err.message : '未知错误'}`,
        details: err
      });
    }

    // 4. 检查存储桶
    try {
      const { data: buckets, error: bucketsError } = await supabase.storage.listBuckets();
      diagnostics.push({
        test: '存储桶检查',
        status: bucketsError ? 'failed' : 'success',
        message: bucketsError ? `获取失败: ${bucketsError.message}` : `找到 ${buckets?.length || 0} 个存储桶`,
        details: { buckets, error: bucketsError }
      });
    } catch (err) {
      diagnostics.push({
        test: '存储桶检查',
        status: 'failed',
        message: `检查失败: ${err instanceof Error ? err.message : '未知错误'}`,
        details: err
      });
    }

    // 5. 检查环境变量
    const envCheck = {
      NEXT_PUBLIC_SUPABASE_URL: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
      SUPABASE_SERVICE_ROLE_KEY: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    };

    diagnostics.push({
      test: '环境变量检查',
      status: Object.values(envCheck).every(Boolean) ? 'success' : 'failed',
      message: Object.values(envCheck).every(Boolean) ? '所有必需的环境变量已设置' : '缺少必需的环境变量',
      details: envCheck
    });

    const allPassed = diagnostics.every(d => d.status === 'success');

    return NextResponse.json({
      success: allPassed,
      diagnostics,
      summary: {
        total: diagnostics.length,
        passed: diagnostics.filter(d => d.status === 'success').length,
        failed: diagnostics.filter(d => d.status === 'failed').length
      }
    });

  } catch (error) {
    console.error('诊断失败:', error);
    return NextResponse.json(
      { 
        success: false,
        error: '诊断失败', 
        details: error instanceof Error ? error.message : '未知错误' 
      },
      { status: 500 }
    );
  }
}

