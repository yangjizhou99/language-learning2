import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const adminCheck = await requireAdmin(req);
    if (!adminCheck.ok) {
      return NextResponse.json({ error: adminCheck.reason }, { status: 401 });
    }

    const { supabase } = adminCheck;
    const { userId } = await params;

    // 获取用户基本信息
    const { data: user, error: userError } = await supabase
      .from('profiles')
      .select(`
        id,
        email,
        username,
        role,
        bio,
        goals,
        preferred_tone,
        domains,
        native_lang,
        target_langs,
        created_at,
        last_sign_in_at
      `)
      .eq('id', userId)
      .single();

    if (userError || !user) {
      return NextResponse.json({ error: '用户不存在' }, { status: 404 });
    }

    // 获取用户练习统计
    const practiceStats = await getDetailedPracticeStats(supabase, userId);

    // 获取用户最近活动
    const recentActivity = await getRecentActivity(supabase, userId);

    return NextResponse.json({
      user,
      practice_stats: practiceStats,
      recent_activity: recentActivity
    });

  } catch (error) {
    console.error('获取用户详情失败:', error);
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}

async function getDetailedPracticeStats(supabase: any, userId: string) {
  const stats = {
    total_shadowing_attempts: 0,
    total_cloze_attempts: 0,
    total_alignment_attempts: 0,
    total_vocab_entries: 0,
    shadowing_by_lang: {} as Record<string, number>,
    cloze_by_lang: {} as Record<string, number>,
    alignment_by_lang: {} as Record<string, number>,
    shadowing_by_level: {} as Record<number, number>,
    cloze_by_level: {} as Record<number, number>,
    alignment_by_level: {} as Record<number, number>,
    average_scores: { shadowing: 0, cloze: 0, alignment: 0 },
    last_activity: null as string | null,
    weekly_progress: [] as Array<{ date: string; count: number }>
  };

  try {
    // Shadowing 详细统计
    const { data: shadowingAttempts } = await supabase
      .from('shadowing_attempts')
      .select('lang, level, created_at, metrics')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    shadowingAttempts?.forEach(attempt => {
      stats.total_shadowing_attempts++;
      stats.shadowing_by_lang[attempt.lang] = (stats.shadowing_by_lang[attempt.lang] || 0) + 1;
      stats.shadowing_by_level[attempt.level] = (stats.shadowing_by_level[attempt.level] || 0) + 1;
      
      if (!stats.last_activity || attempt.created_at > stats.last_activity) {
        stats.last_activity = attempt.created_at;
      }

      if (attempt.metrics?.score) {
        const currentAvg = stats.average_scores.shadowing;
        const count = stats.total_shadowing_attempts;
        stats.average_scores.shadowing = 
          (currentAvg * (count - 1) + attempt.metrics.score) / count;
      }
    });

    // Cloze 详细统计
    const { data: clozeAttempts } = await supabase
      .from('cloze_attempts')
      .select('lang, level, created_at, ai_result')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    clozeAttempts?.forEach(attempt => {
      stats.total_cloze_attempts++;
      stats.cloze_by_lang[attempt.lang] = (stats.cloze_by_lang[attempt.lang] || 0) + 1;
      stats.cloze_by_level[attempt.level] = (stats.cloze_by_level[attempt.level] || 0) + 1;
      
      if (!stats.last_activity || attempt.created_at > stats.last_activity) {
        stats.last_activity = attempt.created_at;
      }

      if (attempt.ai_result?.overall?.score) {
        const currentAvg = stats.average_scores.cloze;
        const count = stats.total_cloze_attempts;
        stats.average_scores.cloze = 
          (currentAvg * (count - 1) + attempt.ai_result.overall.score) / count;
      }
    });

    // Alignment 详细统计
    const { data: alignmentAttempts } = await supabase
      .from('alignment_attempts')
      .select('created_at, scores')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    alignmentAttempts?.forEach(attempt => {
      stats.total_alignment_attempts++;
      
      if (!stats.last_activity || attempt.created_at > stats.last_activity) {
        stats.last_activity = attempt.created_at;
      }

      if (attempt.scores?.overall) {
        const currentAvg = stats.average_scores.alignment;
        const count = stats.total_alignment_attempts;
        stats.average_scores.alignment = 
          (currentAvg * (count - 1) + attempt.scores.overall) / count;
      }
    });

    // 词汇统计
    const { data: vocabEntries } = await supabase
      .from('vocab_entries')
      .select('created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    vocabEntries?.forEach(entry => {
      stats.total_vocab_entries++;
      if (!stats.last_activity || entry.created_at > stats.last_activity) {
        stats.last_activity = entry.created_at;
      }
    });

    // 计算周进度（最近7天）
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    
    const allAttempts = [
      ...(shadowingAttempts || []),
      ...(clozeAttempts || []),
      ...(alignmentAttempts || [])
    ].filter(attempt => new Date(attempt.created_at) >= sevenDaysAgo);

    // 按日期分组统计
    const dailyCounts: Record<string, number> = {};
    allAttempts.forEach(attempt => {
      const date = attempt.created_at.split('T')[0];
      dailyCounts[date] = (dailyCounts[date] || 0) + 1;
    });

    // 生成最近7天的数据
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      stats.weekly_progress.push({
        date: dateStr,
        count: dailyCounts[dateStr] || 0
      });
    }

  } catch (error) {
    console.error('获取详细练习统计失败:', error);
  }

  return stats;
}

async function getRecentActivity(supabase: any, userId: string, limit = 20) {
  const activities: any[] = [];

  try {
    // 获取最近的 Shadowing 活动
    const { data: shadowingActivity } = await supabase
      .from('shadowing_attempts')
      .select(`
        id,
        created_at,
        lang,
        level,
        metrics,
        shadowing_items!inner(title)
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);

    shadowingActivity?.forEach(attempt => {
      activities.push({
        id: attempt.id,
        type: 'shadowing',
        title: attempt.shadowing_items.title,
        lang: attempt.lang,
        level: attempt.level,
        score: attempt.metrics?.score,
        created_at: attempt.created_at
      });
    });

    // 获取最近的 Cloze 活动
    const { data: clozeActivity } = await supabase
      .from('cloze_attempts')
      .select(`
        id,
        created_at,
        lang,
        level,
        ai_result,
        cloze_items!inner(title)
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);

    clozeActivity?.forEach(attempt => {
      activities.push({
        id: attempt.id,
        type: 'cloze',
        title: attempt.cloze_items.title,
        lang: attempt.lang,
        level: attempt.level,
        score: attempt.ai_result?.overall?.score,
        created_at: attempt.created_at
      });
    });

    // 获取最近的 Alignment 活动
    const { data: alignmentActivity } = await supabase
      .from('alignment_attempts')
      .select(`
        id,
        created_at,
        scores,
        alignment_packs!inner(topic)
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);

    alignmentActivity?.forEach(attempt => {
      activities.push({
        id: attempt.id,
        type: 'alignment',
        title: attempt.alignment_packs.topic,
        score: attempt.scores?.overall,
        created_at: attempt.created_at
      });
    });

    // 按时间排序并限制数量
    return activities
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, limit);

  } catch (error) {
    console.error('获取最近活动失败:', error);
    return [];
  }
}
