import { NextResponse } from 'next/server';

export async function GET() {
  try {
    // 获取环境变量
    const config = {
      localDbUrl: process.env.LOCAL_DB_URL || '',
      prodDbUrl: process.env.PROD_DB_URL || '',
      supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL || '',
      supabaseKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
    };

    return NextResponse.json({
      success: true,
      config
    });
  } catch (error) {
    console.error('获取环境变量失败:', error);
    return NextResponse.json({
      success: false,
      error: '获取环境变量失败'
    }, { status: 500 });
  }
}
