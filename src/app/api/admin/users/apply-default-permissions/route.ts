import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";

export async function POST(req: NextRequest) {
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
      custom_restrictions
    } = body;

    // 获取所有现有用户
    const { data: users, error: usersError } = await supabase
      .from('profiles')
      .select('id');

    if (usersError) {
      console.error('获取用户列表失败:', usersError);
      return NextResponse.json({ error: '获取用户列表失败' }, { status: 500 });
    }

    if (!users || users.length === 0) {
      return NextResponse.json({ 
        success: true, 
        updated_count: 0,
        message: '没有找到需要更新的用户' 
      });
    }

    // 为每个用户创建或更新权限记录
    const userIds = users.map(user => user.id);
    let updatedCount = 0;

    for (const userId of userIds) {
      // 检查用户是否已有权限记录
      const { data: existingPermissions } = await supabase
        .from('user_permissions')
        .select('id')
        .eq('user_id', userId)
        .single();

      // 构建权限数据
      const permissionsData = {
        user_id: userId,
        can_access_shadowing: can_access_shadowing !== undefined ? Boolean(can_access_shadowing) : true,
        can_access_cloze: can_access_cloze !== undefined ? Boolean(can_access_cloze) : true,
        can_access_alignment: can_access_alignment !== undefined ? Boolean(can_access_alignment) : true,
        can_access_articles: can_access_articles !== undefined ? Boolean(can_access_articles) : true,
        allowed_languages: allowed_languages || ['en', 'ja', 'zh'],
        allowed_levels: allowed_levels || [1, 2, 3, 4, 5],
        max_daily_attempts: max_daily_attempts !== undefined ? Math.max(0, parseInt(max_daily_attempts) || 50) : 50,
        custom_restrictions: {
          ...custom_restrictions,
          model_permissions: model_permissions || [],
          ai_enabled: ai_enabled || false,
          api_keys: api_keys || { deepseek: '', openrouter: '' }
        }
      };

      // 使用 upsert 更新或创建权限记录
      const { error: upsertError } = await supabase
        .from('user_permissions')
        .upsert(permissionsData, {
          onConflict: 'user_id'
        });

      if (upsertError) {
        console.error(`更新用户 ${userId} 权限失败:`, upsertError);
        continue; // 继续处理其他用户
      }

      updatedCount++;
    }

    return NextResponse.json({
      success: true,
      updated_count: updatedCount,
      total_users: userIds.length,
      message: `成功为 ${updatedCount} 个用户应用了默认权限设置`
    });

  } catch (error) {
    console.error('批量应用默认权限API错误:', error);
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}
