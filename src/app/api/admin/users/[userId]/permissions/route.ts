import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";

export async function GET(
  req: NextRequest,
  { params }: { params: { userId: string } }
) {
  try {
    const adminCheck = await requireAdmin(req);
    if (!adminCheck.ok) {
      return NextResponse.json({ error: adminCheck.reason }, { status: 401 });
    }

    const { supabase } = adminCheck;
    const { userId } = params;

    // 获取用户权限设置
    const { data: permissions, error } = await supabase
      .from('user_permissions')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
      console.error('获取用户权限失败:', error);
      return NextResponse.json({ error: '获取用户权限失败' }, { status: 500 });
    }

    // 如果没有权限记录，返回默认权限
    const defaultPermissions = {
      user_id: userId,
      can_access_shadowing: true,
      can_access_cloze: true,
      can_access_alignment: true,
      can_access_articles: true,
      allowed_languages: ['en', 'ja', 'zh'],
      allowed_levels: [1, 2, 3, 4, 5],
      max_daily_attempts: 50,
      custom_restrictions: {}
    };

    return NextResponse.json({
      permissions: permissions || defaultPermissions
    });

  } catch (error) {
    console.error('获取用户权限失败:', error);
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: { userId: string } }
) {
  try {
    const adminCheck = await requireAdmin(req);
    if (!adminCheck.ok) {
      return NextResponse.json({ error: adminCheck.reason }, { status: 401 });
    }

    const { supabase } = adminCheck;
    const { userId } = params;
    const body = await req.json();

    const {
      can_access_shadowing,
      can_access_cloze,
      can_access_alignment,
      can_access_articles,
      allowed_languages,
      allowed_levels,
      max_daily_attempts,
      custom_restrictions
    } = body;

    // 验证数据
    if (!Array.isArray(allowed_languages) || !Array.isArray(allowed_levels)) {
      return NextResponse.json({ error: '无效的权限数据' }, { status: 400 });
    }

    const permissionsData = {
      user_id: userId,
      can_access_shadowing: Boolean(can_access_shadowing),
      can_access_cloze: Boolean(can_access_cloze),
      can_access_alignment: Boolean(can_access_alignment),
      can_access_articles: Boolean(can_access_articles),
      allowed_languages,
      allowed_levels,
      max_daily_attempts: Math.max(0, parseInt(max_daily_attempts) || 50),
      custom_restrictions: custom_restrictions || {}
    };

    // 使用 upsert 更新或创建权限记录
    const { data, error } = await supabase
      .from('user_permissions')
      .upsert(permissionsData, {
        onConflict: 'user_id'
      })
      .select()
      .single();

    if (error) {
      console.error('更新用户权限失败:', error);
      return NextResponse.json({ error: '更新用户权限失败' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      permissions: data
    });

  } catch (error) {
    console.error('更新用户权限失败:', error);
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}
