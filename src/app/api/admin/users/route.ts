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
    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const search = searchParams.get('search') || '';
    const role = searchParams.get('role') || '';

    const offset = (page - 1) * limit;

    // 构建查询条件
    let query = supabase
      .from('profiles')
      .select(
        `
        id,
        username,
        role,
        bio,
        goals,
        preferred_tone,
        domains,
        native_lang,
        target_langs,
        created_at
      `,
        { count: 'exact' },
      )
      .order('created_at', { ascending: false });

    // 添加搜索条件
    if (search) {
      query = query.ilike('username', `%${search}%`);
    }

    if (role && role !== 'all') {
      query = query.eq('role', role);
    }

    // 获取分页数据和总数
    const { data: users, error, count } = await query.range(offset, offset + limit - 1);

    if (error) {
      console.error('获取用户列表失败:', error);
      return NextResponse.json({ error: '获取用户列表失败' }, { status: 500 });
    }

    // 获取每个用户的练习统计
    const userIds = users?.map((u) => u.id) || [];
    const practiceStats = await getPracticeStats(supabase, userIds);

    const usersWithStats = users?.map((user) => ({
      ...user,
      practice_stats: practiceStats[user.id] || {
        total_shadowing_attempts: 0,
        total_cloze_attempts: 0,
        total_alignment_attempts: 0,
        total_vocab_entries: 0,
        last_activity: null,
        average_scores: { shadowing: 0, cloze: 0, alignment: 0 },
      },
    }));

    return NextResponse.json({
      users: usersWithStats,
      pagination: {
        page,
        limit,
        total: count || 0,
        pages: Math.ceil((count || 0) / limit),
      },
    });
  } catch (error) {
    console.error('用户列表API错误:', error);
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}

async function getPracticeStats(supabase: any, userIds: string[]) {
  if (userIds.length === 0) return {};

  const stats: Record<string, any> = {};

  // 初始化统计
  userIds.forEach((id) => {
    stats[id] = {
      total_shadowing_attempts: 0,
      total_cloze_attempts: 0,
      total_alignment_attempts: 0,
      total_vocab_entries: 0,
      last_activity: null,
      average_scores: { shadowing: 0, cloze: 0, alignment: 0 },
    };
  });

  try {
    // Shadowing 统计
    const { data: shadowingStats } = await supabase
      .from('shadowing_attempts')
      .select('user_id, created_at, metrics')
      .in('user_id', userIds);

    shadowingStats?.forEach((attempt: any) => {
      const userId = attempt.user_id;
      if (stats[userId]) {
        stats[userId].total_shadowing_attempts++;
        if (!stats[userId].last_activity || attempt.created_at > stats[userId].last_activity) {
          stats[userId].last_activity = attempt.created_at;
        }
        // 计算平均分数（如果有的话）
        if (attempt.metrics?.score) {
          const currentAvg = stats[userId].average_scores.shadowing;
          const count = stats[userId].total_shadowing_attempts;
          stats[userId].average_scores.shadowing =
            (currentAvg * (count - 1) + attempt.metrics.score) / count;
        }
      }
    });

    // Cloze 统计
    const { data: clozeStats } = await supabase
      .from('cloze_attempts')
      .select('user_id, created_at, ai_result')
      .in('user_id', userIds);

    clozeStats?.forEach((attempt: any) => {
      const userId = attempt.user_id;
      if (stats[userId]) {
        stats[userId].total_cloze_attempts++;
        if (!stats[userId].last_activity || attempt.created_at > stats[userId].last_activity) {
          stats[userId].last_activity = attempt.created_at;
        }
        // 计算平均分数
        if (attempt.ai_result?.overall?.score) {
          const currentAvg = stats[userId].average_scores.cloze;
          const count = stats[userId].total_cloze_attempts;
          stats[userId].average_scores.cloze =
            (currentAvg * (count - 1) + attempt.ai_result.overall.score) / count;
        }
      }
    });

    // Alignment 统计
    const { data: alignmentStats } = await supabase
      .from('alignment_attempts')
      .select('user_id, created_at, scores')
      .in('user_id', userIds);

    alignmentStats?.forEach((attempt: any) => {
      const userId = attempt.user_id;
      if (stats[userId]) {
        stats[userId].total_alignment_attempts++;
        if (!stats[userId].last_activity || attempt.created_at > stats[userId].last_activity) {
          stats[userId].last_activity = attempt.created_at;
        }
        // 计算平均分数
        if (attempt.scores?.overall) {
          const currentAvg = stats[userId].average_scores.alignment;
          const count = stats[userId].total_alignment_attempts;
          stats[userId].average_scores.alignment =
            (currentAvg * (count - 1) + attempt.scores.overall) / count;
        }
      }
    });

    // 词汇统计
    const { data: vocabStats } = await supabase
      .from('vocab_entries')
      .select('user_id, created_at')
      .in('user_id', userIds);

    vocabStats?.forEach((entry: any) => {
      const userId = entry.user_id;
      if (stats[userId]) {
        stats[userId].total_vocab_entries++;
        if (!stats[userId].last_activity || entry.created_at > stats[userId].last_activity) {
          stats[userId].last_activity = entry.created_at;
        }
      }
    });
  } catch (error) {
    console.error('获取练习统计失败:', error);
  }

  return stats;
}
