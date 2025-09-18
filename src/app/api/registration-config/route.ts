import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// GET /api/registration-config - 获取注册配置（公开API）
export async function GET(req: NextRequest) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

    const supabase = createClient(supabaseUrl, supabaseAnon);

    const { data: config, error } = await supabase
      .from('registration_config')
      .select('*')
      .eq('id', 'main')
      .single();

    if (error) {
      console.error('获取注册配置失败:', error);
      // 如果是表不存在或其他数据库错误，返回默认配置
      if (
        error.code === 'PGRST116' ||
        error.message?.includes('relation') ||
        error.message?.includes('does not exist')
      ) {
        console.log('注册配置表不存在，返回默认配置');
        return NextResponse.json({
          success: true,
          config: {
            id: 'main',
            allow_direct_registration: false,
            allow_invitation_registration: true,
            require_email_verification: true,
            allow_google_oauth: false,
            allow_anonymous_login: false,
            maintenance_mode: false,
            maintenance_message: '系统维护中，请稍后再试',
          },
        });
      }

      // 其他错误也返回默认配置
      return NextResponse.json({
        success: true,
        config: {
          id: 'main',
          allow_direct_registration: false,
          allow_invitation_registration: true,
          require_email_verification: true,
          allow_google_oauth: false,
          allow_anonymous_login: false,
          maintenance_mode: false,
          maintenance_message: '系统维护中，请稍后再试',
        },
      });
    }

    return NextResponse.json({
      success: true,
      config,
    });
  } catch (error) {
    console.error('获取注册配置错误:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
