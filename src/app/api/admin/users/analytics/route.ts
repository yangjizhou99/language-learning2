import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin';
import type { SupabaseClient } from '@supabase/supabase-js';

export async function GET(req: NextRequest) {
  try {
    const adminCheck = await requireAdmin(req);
    if (!adminCheck.ok) {
      return NextResponse.json({ error: adminCheck.reason }, { status: 401 });
    }

    const { supabase } = adminCheck;
    const { searchParams } = new URL(req.url);
    const period = searchParams.get('period') || '30d'; // 7d, 30d, 90d

    const analytics = await getUserAnalytics(supabase, period);

    return NextResponse.json(analytics);
  } catch (error) {
    console.error('获取用户分析失败:', error);
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}

type IdRow = { user_id: string };
type LangRow = { lang: string };
type LevelRow = { level: number };

async function getUserAnalytics(supabase: SupabaseClient, period: string) {
  const analytics = {
    total_users: 0,
    active_users_7d: 0,
    active_users_30d: 0,
    new_users_7d: 0,
    new_users_30d: 0,
    practice_completion_rate: 0,
    average_session_duration: 0,
    most_popular_languages: [] as Array<{ lang: string; count: number }>,
    most_popular_levels: [] as Array<{ level: number; count: number }>,
    user_retention_rate: 0,
    daily_active_users: [] as Array<{ date: string; count: number }>,
    practice_type_distribution: {} as Record<string, number>,
    level_distribution: {} as Record<number, number>,
    language_distribution: {} as Record<string, number>,
  };

  try {
    // 计算日期范围
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    // 总用户数
    const { count: totalUsers } = await supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true });
    analytics.total_users = totalUsers || 0;

    // 新用户统计
    const { count: newUsers7d } = await supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', sevenDaysAgo.toISOString());
    analytics.new_users_7d = newUsers7d || 0;

    const { count: newUsers30d } = await supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', thirtyDaysAgo.toISOString());
    analytics.new_users_30d = newUsers30d || 0;

    // 活跃用户统计（基于练习记录）
    const { data: activeUsers7dA } = await supabase
      .from('shadowing_attempts')
      .select('user_id')
      .gte('created_at', sevenDaysAgo.toISOString());
    const { data: activeUsers7dB } = await supabase
      .from('cloze_attempts')
      .select('user_id')
      .gte('created_at', sevenDaysAgo.toISOString());
    const { data: activeUsers7dC } = await supabase
      .from('alignment_attempts')
      .select('user_id')
      .gte('created_at', sevenDaysAgo.toISOString());
    const uniqueActiveUsers7d = new Set(
      ([...(activeUsers7dA || []), ...(activeUsers7dB || []), ...(activeUsers7dC || [])] as IdRow[]).map(
        (u) => u.user_id,
      ),
    );
    analytics.active_users_7d = uniqueActiveUsers7d.size;

    const { data: activeUsers30dA } = await supabase
      .from('shadowing_attempts')
      .select('user_id')
      .gte('created_at', thirtyDaysAgo.toISOString());
    const { data: activeUsers30dB } = await supabase
      .from('cloze_attempts')
      .select('user_id')
      .gte('created_at', thirtyDaysAgo.toISOString());
    const { data: activeUsers30dC } = await supabase
      .from('alignment_attempts')
      .select('user_id')
      .gte('created_at', thirtyDaysAgo.toISOString());
    const uniqueActiveUsers30d = new Set(
      ([...(activeUsers30dA || []), ...(activeUsers30dB || []), ...(activeUsers30dC || [])] as IdRow[]).map(
        (u) => u.user_id,
      ),
    );
    analytics.active_users_30d = uniqueActiveUsers30d.size;

    // 练习类型分布
    const { count: shadowingCount } = await supabase
      .from('shadowing_attempts')
      .select('*', { count: 'exact', head: true });
    analytics.practice_type_distribution.shadowing = shadowingCount ?? 0;

    const { count: clozeCount } = await supabase
      .from('cloze_attempts')
      .select('*', { count: 'exact', head: true });
    analytics.practice_type_distribution.cloze = clozeCount ?? 0;

    const { count: alignmentCount } = await supabase
      .from('alignment_attempts')
      .select('*', { count: 'exact', head: true });
    analytics.practice_type_distribution.alignment = alignmentCount ?? 0;

    // 语言分布
    const { data: shadowingByLang } = await supabase.from('shadowing_attempts').select('lang');
    const { data: clozeByLang } = await supabase.from('cloze_attempts').select('lang');

    const langCounts: Record<string, number> = {};
    ;[(shadowingByLang as LangRow[] | null) || [], (clozeByLang as LangRow[] | null) || []].flat()
      .forEach((attempt) => {
        langCounts[attempt.lang] = (langCounts[attempt.lang] || 0) + 1;
      });

    analytics.language_distribution = langCounts;
    analytics.most_popular_languages = Object.entries(langCounts)
      .map(([lang, count]) => ({ lang, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    // 等级分布
    const { data: shadowingByLevel } = await supabase.from('shadowing_attempts').select('level');
    const { data: clozeByLevel } = await supabase.from('cloze_attempts').select('level');

    const levelCounts: Record<number, number> = {};
    ;[(shadowingByLevel as LevelRow[] | null) || [], (clozeByLevel as LevelRow[] | null) || []].flat()
      .forEach((attempt) => {
        levelCounts[attempt.level] = (levelCounts[attempt.level] || 0) + 1;
      });

    analytics.level_distribution = levelCounts;
    analytics.most_popular_levels = Object.entries(levelCounts)
      .map(([level, count]) => ({ level: parseInt(level), count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    // 计算每日活跃用户（最近30天）
    for (let i = 29; i >= 0; i--) {
      const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      const dateStr = date.toISOString().split('T')[0];
      const nextDate = new Date(date.getTime() + 24 * 60 * 60 * 1000);

      const { data: dailyA } = await supabase
        .from('shadowing_attempts')
        .select('user_id')
        .gte('created_at', date.toISOString())
        .lt('created_at', nextDate.toISOString());
      const { data: dailyB } = await supabase
        .from('cloze_attempts')
        .select('user_id')
        .gte('created_at', date.toISOString())
        .lt('created_at', nextDate.toISOString());
      const { data: dailyC } = await supabase
        .from('alignment_attempts')
        .select('user_id')
        .gte('created_at', date.toISOString())
        .lt('created_at', nextDate.toISOString());

      const uniqueDailyUsers = new Set(
        ([...(dailyA || []), ...(dailyB || []), ...(dailyC || [])] as IdRow[]).map((u) => u.user_id),
      );
      analytics.daily_active_users.push({
        date: dateStr,
        count: uniqueDailyUsers.size,
      });
    }

    // 计算用户留存率（简化版）
    if (analytics.new_users_30d > 0) {
      analytics.user_retention_rate = (analytics.active_users_30d / analytics.new_users_30d) * 100;
    }
  } catch (error) {
    console.error('计算用户分析数据失败:', error);
  }

  return analytics;
}
