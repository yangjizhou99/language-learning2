import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin';
import { testDatabaseConnection, DatabaseType } from '@/lib/backup-db';

export async function GET(req: NextRequest) {
  try {
    await requireAdmin(req);

    const { searchParams } = new URL(req.url);
    const databaseType = (searchParams.get('databaseType') || 'supabase') as DatabaseType;

    if (!['local', 'prod', 'supabase'].includes(databaseType)) {
      return NextResponse.json({ error: '无效的数据库类型' }, { status: 400 });
    }

    // 测试数据库连接
    const result = await testDatabaseConnection(databaseType);

    if (result.success) {
      return NextResponse.json({
        success: true,
        databaseType,
        tableCount: result.tableCount,
        tables: result.tables,
        message: `成功连接到${databaseType === 'local' ? '本地' : databaseType === 'prod' ? '生产环境' : 'Supabase'}数据库，找到 ${result.tableCount} 个表`
      });
    } else {
      return NextResponse.json({
        success: false,
        databaseType,
        error: result.error,
        message: `连接${databaseType === 'local' ? '本地' : databaseType === 'prod' ? '生产环境' : 'Supabase'}数据库失败: ${result.error}`
      });
    }

  } catch (error) {
    console.error('数据库连接测试失败:', error);
    return NextResponse.json(
      { 
        success: false,
        error: '数据库连接测试失败',
        message: error instanceof Error ? error.message : '未知错误'
      },
      { status: 500 }
    );
  }
}