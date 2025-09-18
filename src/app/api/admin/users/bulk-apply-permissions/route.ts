import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin';

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
    const { user_ids, permissions } = body;

    if (!user_ids || !Array.isArray(user_ids) || user_ids.length === 0) {
      return NextResponse.json({ error: '用户ID列表不能为空' }, { status: 400 });
    }

    if (!permissions) {
      return NextResponse.json({ error: '权限数据不能为空' }, { status: 400 });
    }

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
    } = permissions;

    let updatedCount = 0;
    const errors: string[] = [];

    // 为每个用户创建或更新权限记录
    for (const userId of user_ids) {
      try {
        // 构建权限数据
        const permissionsData = {
          user_id: userId,
          can_access_shadowing:
            can_access_shadowing !== undefined ? Boolean(can_access_shadowing) : true,
          can_access_cloze: can_access_cloze !== undefined ? Boolean(can_access_cloze) : true,
          can_access_alignment:
            can_access_alignment !== undefined ? Boolean(can_access_alignment) : true,
          can_access_articles:
            can_access_articles !== undefined ? Boolean(can_access_articles) : true,
          allowed_languages: allowed_languages || ['en', 'ja', 'zh'],
          allowed_levels: allowed_levels || [1, 2, 3, 4, 5],
          max_daily_attempts:
            max_daily_attempts !== undefined ? Math.max(0, parseInt(max_daily_attempts) || 50) : 50,
          custom_restrictions: {
            ...custom_restrictions,
            model_permissions: model_permissions || [],
            ai_enabled: ai_enabled || false,
            api_keys: api_keys || { deepseek: '', openrouter: '' },
          },
        };

        // 使用 upsert 更新或创建权限记录
        const { error: upsertError } = await supabase
          .from('user_permissions')
          .upsert(permissionsData, {
            onConflict: 'user_id',
          });

        if (upsertError) {
          console.error(`更新用户 ${userId} 权限失败:`, upsertError);
          errors.push(`用户 ${userId}: ${upsertError.message}`);
          continue; // 继续处理其他用户
        }

        updatedCount++;
      } catch (error) {
        console.error(`处理用户 ${userId} 时出错:`, error);
        errors.push(`用户 ${userId}: ${error instanceof Error ? error.message : '未知错误'}`);
      }
    }

    return NextResponse.json({
      success: true,
      updated_count: updatedCount,
      total_requested: user_ids.length,
      errors: errors.length > 0 ? errors : undefined,
      message: `成功为 ${updatedCount} 个用户应用了权限设置${errors.length > 0 ? `，${errors.length} 个用户处理失败` : ''}`,
    });
  } catch (error) {
    console.error('批量应用权限API错误:', error);
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}
