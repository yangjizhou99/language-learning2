"use client";

import { useState, useEffect } from "react";
import { Container } from "@/components/Container";
import { supabase } from "@/lib/supabase";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { 
  Users, 
  UserPlus, 
  Activity, 
  TrendingUp, 
  Globe, 
  Target,
  BarChart3,
  PieChart,
  Calendar
} from "lucide-react";

interface UserAnalytics {
  total_users: number;
  active_users_7d: number;
  active_users_30d: number;
  new_users_7d: number;
  new_users_30d: number;
  practice_completion_rate: number;
  average_session_duration: number;
  most_popular_languages: Array<{ lang: string; count: number }>;
  most_popular_levels: Array<{ level: number; count: number }>;
  user_retention_rate: number;
  daily_active_users: Array<{ date: string; count: number }>;
  practice_type_distribution: Record<string, number>;
  level_distribution: Record<number, number>;
  language_distribution: Record<string, number>;
}

export default function UserAnalyticsPage() {
  const [analytics, setAnalytics] = useState<UserAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState('30d');

  useEffect(() => {
    fetchAnalytics();
  }, [period]);

  const fetchAnalytics = async () => {
    setLoading(true);
    try {
      const analytics = await getUserAnalytics(period);
      setAnalytics(analytics);
    } catch (error) {
      console.error('获取分析数据失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const getUserAnalytics = async (period: string) => {
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
      language_distribution: {} as Record<string, number>
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
      const [shadowingUsers, clozeUsers, alignmentUsers] = await Promise.all([
        supabase
          .from('shadowing_attempts')
          .select('user_id')
          .gte('created_at', sevenDaysAgo.toISOString()),
        supabase
          .from('cloze_attempts')
          .select('user_id')
          .gte('created_at', sevenDaysAgo.toISOString()),
        supabase
          .from('alignment_attempts')
          .select('user_id')
          .gte('created_at', sevenDaysAgo.toISOString())
      ]);

      // 合并所有活跃用户ID
      const allActiveUserIds = new Set([
        ...(shadowingUsers.data?.map(u => u.user_id) || []),
        ...(clozeUsers.data?.map(u => u.user_id) || []),
        ...(alignmentUsers.data?.map(u => u.user_id) || [])
      ]);

      analytics.active_users_7d = allActiveUserIds.size;

      // 30天活跃用户统计
      const [shadowingUsers30d, clozeUsers30d, alignmentUsers30d] = await Promise.all([
        supabase
          .from('shadowing_attempts')
          .select('user_id')
          .gte('created_at', thirtyDaysAgo.toISOString()),
        supabase
          .from('cloze_attempts')
          .select('user_id')
          .gte('created_at', thirtyDaysAgo.toISOString()),
        supabase
          .from('alignment_attempts')
          .select('user_id')
          .gte('created_at', thirtyDaysAgo.toISOString())
      ]);

      // 合并所有30天活跃用户ID
      const allActiveUserIds30d = new Set([
        ...(shadowingUsers30d.data?.map(u => u.user_id) || []),
        ...(clozeUsers30d.data?.map(u => u.user_id) || []),
        ...(alignmentUsers30d.data?.map(u => u.user_id) || [])
      ]);

      analytics.active_users_30d = allActiveUserIds30d.size;

      // 练习类型分布
      const { count: shadowingCount } = await supabase
        .from('shadowing_attempts')
        .select('*', { count: 'exact', head: true });
      analytics.practice_type_distribution.shadowing = shadowingCount || 0;

      const { count: clozeCount } = await supabase
        .from('cloze_attempts')
        .select('*', { count: 'exact', head: true });
      analytics.practice_type_distribution.cloze = clozeCount || 0;

      const { count: alignmentCount } = await supabase
        .from('alignment_attempts')
        .select('*', { count: 'exact', head: true });
      analytics.practice_type_distribution.alignment = alignmentCount || 0;

      // 语言分布
      const { data: shadowingByLang } = await supabase
        .from('shadowing_attempts')
        .select('lang');

      const { data: clozeByLang } = await supabase
        .from('cloze_attempts')
        .select('lang');

      const langCounts: Record<string, number> = {};
      [...(shadowingByLang || []), ...(clozeByLang || [])].forEach(attempt => {
        langCounts[attempt.lang] = (langCounts[attempt.lang] || 0) + 1;
      });

      analytics.language_distribution = langCounts;
      analytics.most_popular_languages = Object.entries(langCounts)
        .map(([lang, count]) => ({ lang, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);

      // 等级分布
      const { data: shadowingByLevel } = await supabase
        .from('shadowing_attempts')
        .select('level');

      const { data: clozeByLevel } = await supabase
        .from('cloze_attempts')
        .select('level');

      const levelCounts: Record<number, number> = {};
      [...(shadowingByLevel || []), ...(clozeByLevel || [])].forEach(attempt => {
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

        const [dailyShadowing, dailyCloze, dailyAlignment] = await Promise.all([
          supabase
            .from('shadowing_attempts')
            .select('user_id')
            .gte('created_at', date.toISOString())
            .lt('created_at', nextDate.toISOString()),
          supabase
            .from('cloze_attempts')
            .select('user_id')
            .gte('created_at', date.toISOString())
            .lt('created_at', nextDate.toISOString()),
          supabase
            .from('alignment_attempts')
            .select('user_id')
            .gte('created_at', date.toISOString())
            .lt('created_at', nextDate.toISOString())
        ]);

        // 合并当日所有活跃用户ID
        const dailyUserIds = new Set([
          ...(dailyShadowing.data?.map(u => u.user_id) || []),
          ...(dailyCloze.data?.map(u => u.user_id) || []),
          ...(dailyAlignment.data?.map(u => u.user_id) || [])
        ]);

        analytics.daily_active_users.push({
          date: dateStr,
          count: dailyUserIds.size
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
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('zh-CN', {
      month: 'short',
      day: 'numeric'
    });
  };

  const getLanguageName = (code: string) => {
    const names: Record<string, string> = {
      'en': '英语',
      'ja': '日语',
      'zh': '中文'
    };
    return names[code] || code.toUpperCase();
  };

  const getLevelName = (level: number) => {
    const names: Record<number, string> = {
      1: '初级',
      2: '初中级',
      3: '中级',
      4: '中高级',
      5: '高级'
    };
    return names[level] || `等级 ${level}`;
  };

  const getPracticeTypeName = (type: string) => {
    const names: Record<string, string> = {
      'shadowing': 'Shadowing',
      'cloze': 'Cloze',
      'alignment': 'Alignment'
    };
    return names[type] || type;
  };

  if (loading) {
    return (
      <Container>
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </Container>
    );
  }

  if (!analytics) {
    return (
      <Container>
        <div className="text-center py-8">
          <h2 className="text-2xl font-bold mb-4">无法加载分析数据</h2>
        </div>
      </Container>
    );
  }

  const totalPracticeCount = Object.values(analytics.practice_type_distribution).reduce((sum, count) => sum + count, 0);

  return (
    <Container>
      <div className="space-y-6">
        {/* 头部 */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">用户分析</h1>
            <p className="text-muted-foreground">用户行为数据和系统使用统计</p>
          </div>
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7d">最近7天</SelectItem>
              <SelectItem value="30d">最近30天</SelectItem>
              <SelectItem value="90d">最近90天</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Breadcrumbs items={[
          { label: "管理员", href: "/admin" },
          { label: "用户管理", href: "/admin/users" },
          { label: "用户分析", href: "/admin/users/analytics" }
        ]} />

        {/* 关键指标 */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-2">
                <Users className="h-5 w-5 text-blue-500" />
                <div>
                  <p className="text-sm font-medium text-muted-foreground">总用户数</p>
                  <p className="text-2xl font-bold">{analytics.total_users}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-2">
                <UserPlus className="h-5 w-5 text-green-500" />
                <div>
                  <p className="text-sm font-medium text-muted-foreground">新用户 (7天)</p>
                  <p className="text-2xl font-bold">{analytics.new_users_7d}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-2">
                <Activity className="h-5 w-5 text-orange-500" />
                <div>
                  <p className="text-sm font-medium text-muted-foreground">活跃用户 (7天)</p>
                  <p className="text-2xl font-bold">{analytics.active_users_7d}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-purple-500" />
                <div>
                  <p className="text-sm font-medium text-muted-foreground">用户留存率</p>
                  <p className="text-2xl font-bold">{analytics.user_retention_rate.toFixed(1)}%</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* 图表区域 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* 每日活跃用户趋势 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                每日活跃用户趋势
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {analytics.daily_active_users.slice(-7).map((day) => (
                  <div key={day.date} className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>{formatDate(day.date)}</span>
                      <span className="font-medium">{day.count} 人</span>
                    </div>
                    <Progress 
                      value={(day.count / Math.max(...analytics.daily_active_users.map(d => d.count))) * 100} 
                      className="h-2"
                    />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* 练习类型分布 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <PieChart className="h-5 w-5" />
                练习类型分布
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {Object.entries(analytics.practice_type_distribution).map(([type, count]) => (
                  <div key={type} className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>{getPracticeTypeName(type)}</span>
                      <span className="font-medium">{count}</span>
                    </div>
                    <Progress 
                      value={(count / totalPracticeCount) * 100} 
                      className="h-2"
                    />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* 详细统计 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* 热门语言 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Globe className="h-5 w-5" />
                热门语言
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {analytics.most_popular_languages.map((item, index) => (
                  <div key={item.lang} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Badge variant="outline">#{index + 1}</Badge>
                      <span className="font-medium">{getLanguageName(item.lang)}</span>
                    </div>
                    <span className="text-sm text-muted-foreground">{item.count} 次</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* 热门等级 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="h-5 w-5" />
                热门等级
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {analytics.most_popular_levels.map((item, index) => (
                  <div key={item.level} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Badge variant="outline">#{index + 1}</Badge>
                      <span className="font-medium">{getLevelName(item.level)}</span>
                    </div>
                    <span className="text-sm text-muted-foreground">{item.count} 次</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* 语言分布详情 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              语言使用分布
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {Object.entries(analytics.language_distribution).map(([lang, count]) => (
                <div key={lang} className="space-y-2">
                  <div className="flex justify-between">
                    <span className="font-medium">{getLanguageName(lang)}</span>
                    <span className="text-sm text-muted-foreground">{count} 次</span>
                  </div>
                  <Progress 
                    value={(count / Math.max(...Object.values(analytics.language_distribution))) * 100} 
                    className="h-2"
                  />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* 等级分布详情 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="h-5 w-5" />
              等级使用分布
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
              {Object.entries(analytics.level_distribution).map(([level, count]) => (
                <div key={level} className="space-y-2">
                  <div className="text-center">
                    <div className="font-medium">{getLevelName(parseInt(level))}</div>
                    <div className="text-sm text-muted-foreground">{count} 次</div>
                  </div>
                  <Progress 
                    value={(count / Math.max(...Object.values(analytics.level_distribution))) * 100} 
                    className="h-2"
                  />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </Container>
  );
}
