import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAdmin(req);
    if (!auth.ok) {
      return NextResponse.json(
        {
          error: '权限检查失败',
          reason: auth.reason,
        },
        { status: 403 },
      );
    }

    // 1. 检查表是否存在
    const { data: tableCheck, error: tableError } = await auth.supabase
      .from('article_drafts')
      .select('count')
      .limit(1);

    if (tableError) {
      return NextResponse.json(
        {
          error: '表不存在或无法访问',
          table_error: tableError.message,
        },
        { status: 500 },
      );
    }

    // 2. 检查所有草稿（不限状态）
    const { data: allDrafts, error: allError } = await auth.supabase
      .from('article_drafts')
      .select('*')
      .order('created_at', { ascending: false });

    if (allError) {
      return NextResponse.json(
        {
          error: '查询所有草稿失败',
          query_error: allError.message,
        },
        { status: 500 },
      );
    }

    // 3. 按状态分组统计
    const statusCounts: Record<string, number> = {};
    allDrafts?.forEach((draft) => {
      statusCounts[draft.status] = (statusCounts[draft.status] || 0) + 1;
    });

    // 4. 检查当前用户创建的草稿
    const { data: userDrafts, error: userError } = await auth.supabase
      .from('article_drafts')
      .select('*')
      .eq('created_by', auth.user.id)
      .order('created_at', { ascending: false });

    if (userError) {
      return NextResponse.json(
        {
          error: '查询用户草稿失败',
          user_error: userError.message,
        },
        { status: 500 },
      );
    }

    // 5. 最近的几条记录详情
    const recentDrafts = allDrafts?.slice(0, 3).map((draft) => ({
      id: draft.id,
      title: draft.title,
      status: draft.status,
      created_at: draft.created_at,
      created_by: draft.created_by,
      source: draft.source,
      ai_provider: draft.ai_provider,
      ai_model: draft.ai_model,
    }));

    return NextResponse.json({
      success: true,
      total_drafts: allDrafts?.length || 0,
      status_counts: statusCounts,
      user_drafts_count: userDrafts?.length || 0,
      current_user: auth.user.id,
      recent_drafts: recentDrafts,
      debug_info: {
        table_accessible: !tableError,
        all_query_success: !allError,
        user_query_success: !userError,
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: '调试失败',
        details: String(error),
      },
      { status: 500 },
    );
  }
}
