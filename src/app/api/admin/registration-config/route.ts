import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin';
import type { UpdateRegistrationConfigRequest } from '@/types/registrationConfig';

// GET /api/admin/registration-config - 获取注册配置
export async function GET(req: NextRequest) {
  try {
    const adminCheck = await requireAdmin(req);
    if (!adminCheck.ok) {
      return NextResponse.json(
        { error: adminCheck.reason === 'unauthorized' ? '未登录' : '权限不足' },
        { status: adminCheck.reason === 'unauthorized' ? 401 : 403 }
      );
    }

    const { data: config, error } = await adminCheck.supabase
      .from('registration_config')
      .select('*')
      .eq('id', 'main')
      .single();

    if (error) {
      console.error('获取注册配置失败:', error);
      return NextResponse.json({ 
        error: '获取注册配置失败', 
        details: error instanceof Error ? error.message : String(error) 
      }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      config: config || {
        id: 'main',
        allow_direct_registration: false,
        allow_invitation_registration: true,
        require_email_verification: true,
        allow_google_oauth: false,
        allow_anonymous_login: false,
        maintenance_mode: false,
        maintenance_message: '系统维护中，请稍后再试'
      }
    });

  } catch (error) {
    console.error('获取注册配置错误:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

// PUT /api/admin/registration-config - 更新注册配置
export async function PUT(req: NextRequest) {
  try {
    const adminCheck = await requireAdmin(req);
    if (!adminCheck.ok) {
      return NextResponse.json(
        { error: adminCheck.reason === 'unauthorized' ? '未登录' : '权限不足' },
        { status: adminCheck.reason === 'unauthorized' ? 401 : 403 }
      );
    }

    const body: UpdateRegistrationConfigRequest = await req.json();

    const { data, error } = await adminCheck.supabase
      .from('registration_config')
      .upsert({
        id: 'main',
        ...body,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'id'
      })
      .select()
      .single();

    if (error) {
      console.error('更新注册配置失败:', error);
      return NextResponse.json({ 
        error: '更新注册配置失败', 
        details: error instanceof Error ? error.message : String(error) 
      }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      config: data,
      message: '注册配置更新成功'
    });

  } catch (error) {
    console.error('更新注册配置错误:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
