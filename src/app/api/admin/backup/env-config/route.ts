import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin';

export async function GET(req: NextRequest) {
  try {
    await requireAdmin(req);

    // 检查环境变量
    const localDbUrl = process.env.LOCAL_DB_URL;
    const prodDbUrl = process.env.PROD_DB_URL;
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    const config = {
      local: {
        available: !!localDbUrl,
        url: localDbUrl ? maskConnectionString(localDbUrl) : null,
        name: '本地数据库'
      },
      prod: {
        available: !!prodDbUrl,
        url: prodDbUrl ? maskConnectionString(prodDbUrl) : null,
        name: '生产环境数据库'
      },
      supabase: {
        available: !!(supabaseUrl && supabaseServiceKey),
        url: supabaseUrl ? maskUrl(supabaseUrl) : null,
        name: 'Supabase 数据库'
      }
    };

    return NextResponse.json({
      success: true,
      config,
      summary: {
        localAvailable: config.local.available,
        prodAvailable: config.prod.available,
        supabaseAvailable: config.supabase.available,
        totalAvailable: Object.values(config).filter(c => c.available).length
      }
    });

  } catch (error) {
    console.error('获取环境配置失败:', error);
    return NextResponse.json(
      { error: '获取环境配置失败' },
      { status: 500 }
    );
  }
}

// 掩码连接字符串中的敏感信息
function maskConnectionString(connectionString: string): string {
  try {
    const url = new URL(connectionString);
    if (url.password) {
      url.password = '***';
    }
    return url.toString();
  } catch {
    return connectionString.replace(/:\/\/[^:]+:[^@]+@/, '://***:***@');
  }
}

// 掩码URL中的敏感信息
function maskUrl(url: string): string {
  try {
    const urlObj = new URL(url);
    return `${urlObj.protocol}//${urlObj.hostname}`;
  } catch {
    return url;
  }
}
