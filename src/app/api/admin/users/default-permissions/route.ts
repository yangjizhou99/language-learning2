import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin';

export async function GET(req: NextRequest) {
  try {
    // 检查认证
    const auth = await requireAdmin(req);

    if (!auth.ok) {
      return NextResponse.json({ error: auth.reason }, { status: 403 });
    }

    // 使用 getServiceSupabase 来查询数据，绕过 RLS 限制
    const { getServiceSupabase } = await import('@/lib/supabaseAdmin');
    const supabase = getServiceSupabase();

    // 获取默认权限设置
    const { data: defaultPerms, error } = await supabase
      .from('default_user_permissions')
      .select('*')
      .eq('id', 'default')
      .single();

    if (error && error.code !== 'PGRST116') {
      // PGRST116 = no rows returned
      console.error('获取默认权限设置失败:', error);
      return NextResponse.json({ error: '获取默认权限设置失败' }, { status: 500 });
    }

    // 如果没有默认权限记录，返回默认值
    const defaultPermissions = {
      id: 'default',
      can_access_shadowing: true,
      can_access_cloze: true,
      can_access_alignment: true,
      can_access_articles: true,
      allowed_languages: ['en', 'ja', 'zh'],
      allowed_levels: [1, 2, 3, 4, 5],
      max_daily_attempts: 50,
      ai_enabled: false,
      api_keys: { deepseek: '', openrouter: '' },
      model_permissions: [
        {
          model_id: 'deepseek-chat',
          model_name: 'DeepSeek Chat',
          provider: 'deepseek',
          daily_limit: 50,
          token_limit: 100000,
          enabled: true,
        },
        {
          model_id: 'openrouter/auto',
          model_name: 'OpenRouter Auto (推荐)',
          provider: 'openrouter',
          daily_limit: 30,
          token_limit: 80000,
          enabled: true,
        },
      ],
      custom_restrictions: {},
    };

    return NextResponse.json({
      permissions: defaultPerms || defaultPermissions,
    });
  } catch (error) {
    console.error('获取默认权限设置API错误:', error);
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    // 检查认证
    const auth = await requireAdmin(req);

    if (!auth.ok) {
      return NextResponse.json({ error: auth.reason }, { status: 403 });
    }

    // 使用 getServiceSupabase 来查询数据，绕过 RLS 限制
    const { getServiceSupabase } = await import('@/lib/supabaseAdmin');
    const supabase = getServiceSupabase();

    const body = await req.json();

    const {
      can_access_shadowing,
      can_access_cloze,
      can_access_alignment,
      can_access_articles,
      allowed_languages,
      allowed_levels,
      max_daily_attempts,
      ai_enabled,
      api_keys,
      model_permissions,
      custom_restrictions,
    } = body;

    // 验证数据
    if (allowed_languages !== undefined && !Array.isArray(allowed_languages)) {
      return NextResponse.json({ error: '无效的语言设置' }, { status: 400 });
    }

    if (allowed_levels !== undefined && !Array.isArray(allowed_levels)) {
      return NextResponse.json({ error: '无效的等级设置' }, { status: 400 });
    }

    // 构建权限数据
    const permissionsData = {
      id: 'default',
      can_access_shadowing:
        can_access_shadowing !== undefined ? Boolean(can_access_shadowing) : true,
      can_access_cloze: can_access_cloze !== undefined ? Boolean(can_access_cloze) : true,
      can_access_alignment:
        can_access_alignment !== undefined ? Boolean(can_access_alignment) : true,
      can_access_articles: can_access_articles !== undefined ? Boolean(can_access_articles) : true,
      allowed_languages: allowed_languages || ['en', 'ja', 'zh'],
      allowed_levels: allowed_levels || [1, 2, 3, 4, 5],
      max_daily_attempts:
        max_daily_attempts !== undefined ? Math.max(0, parseInt(max_daily_attempts) || 50) : 50,
      ai_enabled: ai_enabled !== undefined ? Boolean(ai_enabled) : false,
      api_keys: api_keys || { deepseek: '', openrouter: '' },
      model_permissions: model_permissions || [],
      custom_restrictions: custom_restrictions || {},
    };

    // 使用 upsert 更新或创建默认权限记录
    const { data, error } = await supabase
      .from('default_user_permissions')
      .upsert(permissionsData, {
        onConflict: 'id',
      })
      .select()
      .single();

    if (error) {
      console.error('更新默认权限设置失败:', error);
      return NextResponse.json({ error: '更新默认权限设置失败' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      permissions: data,
    });
  } catch (error) {
    console.error('更新默认权限设置API错误:', error);
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}
