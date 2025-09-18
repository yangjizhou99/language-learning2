'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { Container } from '@/components/Container';
import { Breadcrumbs } from '@/components/Breadcrumbs';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import {
  ArrowLeft,
  User,
  Calendar,
  Activity,
  TrendingUp,
  BarChart3,
  Globe,
  Target,
  BookOpen,
  Settings,
} from 'lucide-react';

interface UserProfile {
  id: string;
  email: string;
  username?: string;
  role: 'admin' | 'user';
  bio?: string;
  goals?: string;
  preferred_tone?: string;
  domains?: string[];
  native_lang?: string;
  target_langs?: string[];
  created_at: string;
  last_sign_in_at?: string;
}

interface PracticeStats {
  total_shadowing_attempts: number;
  total_cloze_attempts: number;
  total_alignment_attempts: number;
  total_vocab_entries: number;
  shadowing_by_lang: Record<string, number>;
  cloze_by_lang: Record<string, number>;
  alignment_by_lang: Record<string, number>;
  shadowing_by_level: Record<number, number>;
  cloze_by_level: Record<number, number>;
  alignment_by_level: Record<number, number>;
  average_scores: {
    shadowing: number;
    cloze: number;
    alignment: number;
  };
  last_activity?: string | null;
  weekly_progress: Array<{ date: string; count: number }>;
}

interface UserActivity {
  id: string;
  type: 'shadowing' | 'cloze' | 'alignment' | 'vocab';
  title: string;
  lang?: string;
  level?: number;
  score?: number;
  created_at: string;
}

export default function UserDetailPage() {
  const params = useParams();
  const userId = params?.userId as string;

  const [user, setUser] = useState<UserProfile | null>(null);
  const [practiceStats, setPracticeStats] = useState<PracticeStats | null>(null);
  const [recentActivity, setRecentActivity] = useState<UserActivity[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (userId) {
      fetchUserDetail();
    }
  }, [userId]);

  const fetchUserDetail = async () => {
    setLoading(true);
    try {
      console.log('正在获取用户详情，用户ID:', userId);

      // 首先检查用户ID是否有效
      if (!userId || userId === 'undefined') {
        throw new Error('无效的用户ID');
      }

      // 获取用户基本信息
      const { data: user, error: userError } = await supabase
        .from('profiles')
        .select(
          `
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
          created_at
        `,
        )
        .eq('id', userId)
        .single();

      console.log('用户查询结果:', { user, userError });

      if (userError) {
        console.error('用户查询错误:', userError);
        // 如果是"未找到"错误，提供更友好的消息
        if (userError.code === 'PGRST116') {
          throw new Error('用户不存在');
        }
        throw new Error(`用户查询失败: ${userError.message}`);
      }

      if (!user) {
        throw new Error('用户不存在');
      }

      setUser(user);

      // 获取用户练习统计
      const practiceStats = await getDetailedPracticeStats(userId);
      setPracticeStats(practiceStats);

      // 获取用户最近活动
      const recentActivity = await getRecentActivity(userId);
      setRecentActivity(recentActivity);
    } catch (error) {
      console.error('获取用户详情失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const getDetailedPracticeStats = async (userId: string) => {
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
      weekly_progress: [] as Array<{ date: string; count: number }>,
    };

    try {
      // Shadowing 详细统计
      const { data: shadowingAttempts } = await supabase
        .from('shadowing_attempts')
        .select('lang, level, created_at, metrics')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      shadowingAttempts?.forEach((attempt) => {
        stats.total_shadowing_attempts++;
        stats.shadowing_by_lang[attempt.lang] = (stats.shadowing_by_lang[attempt.lang] || 0) + 1;
        stats.shadowing_by_level[attempt.level] =
          (stats.shadowing_by_level[attempt.level] || 0) + 1;

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

      clozeAttempts?.forEach((attempt) => {
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

      alignmentAttempts?.forEach((attempt) => {
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

      vocabEntries?.forEach((entry) => {
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
        ...(alignmentAttempts || []),
      ].filter((attempt) => new Date(attempt.created_at) >= sevenDaysAgo);

      // 按日期分组统计
      const dailyCounts: Record<string, number> = {};
      allAttempts.forEach((attempt) => {
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
          count: dailyCounts[dateStr] || 0,
        });
      }
    } catch (error) {
      console.error('获取详细练习统计失败:', error);
    }

    return stats;
  };

  const getRecentActivity = async (userId: string, limit = 20) => {
    const activities: any[] = [];

    try {
      // 获取最近的 Shadowing 活动
      const { data: shadowingActivity } = await supabase
        .from('shadowing_attempts')
        .select(
          `
          id,
          created_at,
          lang,
          level,
          metrics,
          shadowing_items!inner(title)
        `,
        )
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(limit);

      shadowingActivity?.forEach((attempt) => {
        activities.push({
          id: attempt.id,
          type: 'shadowing',
          title: attempt.shadowing_items?.[0]?.title || '未知标题',
          lang: attempt.lang,
          level: attempt.level,
          score: attempt.metrics?.score,
          created_at: attempt.created_at,
        });
      });

      // 获取最近的 Cloze 活动
      const { data: clozeActivity } = await supabase
        .from('cloze_attempts')
        .select(
          `
          id,
          created_at,
          lang,
          level,
          ai_result,
          cloze_items!inner(title)
        `,
        )
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(limit);

      clozeActivity?.forEach((attempt) => {
        activities.push({
          id: attempt.id,
          type: 'cloze',
          title: attempt.cloze_items?.[0]?.title || '未知标题',
          lang: attempt.lang,
          level: attempt.level,
          score: attempt.ai_result?.overall?.score,
          created_at: attempt.created_at,
        });
      });

      // 获取最近的 Alignment 活动
      const { data: alignmentActivity } = await supabase
        .from('alignment_attempts')
        .select(
          `
          id,
          created_at,
          scores,
          alignment_packs!inner(topic)
        `,
        )
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(limit);

      alignmentActivity?.forEach((attempt) => {
        activities.push({
          id: attempt.id,
          type: 'alignment',
          title: attempt.alignment_packs?.[0]?.topic || '未知主题',
          score: attempt.scores?.overall,
          created_at: attempt.created_at,
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
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return '未知';
    try {
      return new Date(dateString).toLocaleDateString('zh-CN', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch (error) {
      return '无效日期';
    }
  };

  const getInitials = (primary: string, username?: string) => {
    if (username && username.length >= 2) {
      return username.substring(0, 2).toUpperCase();
    }
    if (primary && primary.length >= 2) {
      return primary.substring(0, 2).toUpperCase();
    }
    return '??';
  };

  const getTotalPracticeCount = (stats: PracticeStats) => {
    return (
      stats.total_shadowing_attempts + stats.total_cloze_attempts + stats.total_alignment_attempts
    );
  };

  const getAverageScore = (stats: PracticeStats) => {
    const scores = [
      stats.average_scores.shadowing,
      stats.average_scores.cloze,
      stats.average_scores.alignment,
    ];
    const validScores = scores.filter((score) => score > 0);
    if (validScores.length === 0) return 0;
    return validScores.reduce((sum, score) => sum + score, 0) / validScores.length;
  };

  const getActivityTypeLabel = (type: string) => {
    const labels = {
      shadowing: 'Shadowing',
      cloze: 'Cloze',
      alignment: 'Alignment',
      vocab: '词汇',
    };
    return labels[type as keyof typeof labels] || type;
  };

  const getActivityTypeColor = (type: string) => {
    const colors = {
      shadowing: 'bg-blue-100 text-blue-800',
      cloze: 'bg-green-100 text-green-800',
      alignment: 'bg-purple-100 text-purple-800',
      vocab: 'bg-orange-100 text-orange-800',
    };
    return colors[type as keyof typeof colors] || 'bg-gray-100 text-gray-800';
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

  if (!user) {
    return (
      <Container>
        <div className="text-center py-8">
          <h2 className="text-2xl font-bold mb-4">用户不存在</h2>
          <Link href="/admin/users">
            <Button>返回用户列表</Button>
          </Link>
        </div>
      </Container>
    );
  }

  return (
    <Container>
      <div className="space-y-6">
        {/* 头部 */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/admin/users">
              <Button variant="outline" size="sm">
                <ArrowLeft className="h-4 w-4 mr-2" />
                返回
              </Button>
            </Link>
            <div>
              <h1 className="text-3xl font-bold">用户详情</h1>
              <p className="text-muted-foreground">查看用户信息和练习数据</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link href={`/admin/users/${userId}/permissions`}>
              <Button variant="outline">
                <Settings className="h-4 w-4 mr-2" />
                权限管理
              </Button>
            </Link>
          </div>
        </div>

        <Breadcrumbs
          items={[
            { label: '管理员', href: '/admin' },
            { label: '用户管理', href: '/admin/users' },
            {
              label: user.username || `用户 ${user.id.slice(0, 8)}`,
              href: `/admin/users/${userId}`,
            },
          ]}
        />

        {/* 用户基本信息 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              基本信息
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-start gap-6">
              <Avatar className="h-20 w-20">
                <AvatarFallback className="text-lg">
                  {getInitials(user.username || user.id, user.username)}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">用户名</label>
                    <p className="text-lg font-semibold">{user.username || '未设置'}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">用户ID</label>
                    <p className="text-sm font-mono">{user.id}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">角色</label>
                    <div className="mt-1">
                      <Badge variant={user.role === 'admin' ? 'default' : 'secondary'}>
                        {user.role === 'admin' ? '管理员' : '用户'}
                      </Badge>
                    </div>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">注册时间</label>
                    <p className="text-sm">{formatDate(user.created_at)}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">母语</label>
                    <p className="text-sm">{user.native_lang || '未设置'}</p>
                  </div>
                </div>
                {user.bio && (
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">个人简介</label>
                    <p className="text-sm mt-1">{user.bio}</p>
                  </div>
                )}
                {user.goals && (
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">学习目标</label>
                    <p className="text-sm mt-1">{user.goals}</p>
                  </div>
                )}
                {user.target_langs && user.target_langs.length > 0 && (
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">目标语言</label>
                    <div className="flex gap-2 mt-1">
                      {user.target_langs.map((lang) => (
                        <Badge key={lang} variant="outline">
                          {lang.toUpperCase()}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 练习统计和活动 */}
        <Tabs defaultValue="stats" className="space-y-6">
          <TabsList>
            <TabsTrigger value="stats">练习统计</TabsTrigger>
            <TabsTrigger value="activity">最近活动</TabsTrigger>
            <TabsTrigger value="progress">学习进度</TabsTrigger>
          </TabsList>

          <TabsContent value="stats" className="space-y-6">
            {practiceStats && (
              <>
                {/* 总体统计 */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <Card>
                    <CardContent className="p-6">
                      <div className="flex items-center gap-2">
                        <TrendingUp className="h-5 w-5 text-blue-500" />
                        <div>
                          <p className="text-sm font-medium text-muted-foreground">总练习次数</p>
                          <p className="text-2xl font-bold">
                            {getTotalPracticeCount(practiceStats)}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-6">
                      <div className="flex items-center gap-2">
                        <BarChart3 className="h-5 w-5 text-green-500" />
                        <div>
                          <p className="text-sm font-medium text-muted-foreground">平均分数</p>
                          <p className="text-2xl font-bold">
                            {getAverageScore(practiceStats).toFixed(1)}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-6">
                      <div className="flex items-center gap-2">
                        <BookOpen className="h-5 w-5 text-purple-500" />
                        <div>
                          <p className="text-sm font-medium text-muted-foreground">词汇量</p>
                          <p className="text-2xl font-bold">{practiceStats.total_vocab_entries}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-6">
                      <div className="flex items-center gap-2">
                        <Activity className="h-5 w-5 text-orange-500" />
                        <div>
                          <p className="text-sm font-medium text-muted-foreground">最后活动</p>
                          <p className="text-sm font-bold">
                            {practiceStats.last_activity
                              ? formatDate(practiceStats.last_activity)
                              : '无活动'}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* 详细统计 */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <Card>
                    <CardHeader>
                      <CardTitle>练习类型分布</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <span>Shadowing</span>
                          <span className="font-medium">
                            {practiceStats.total_shadowing_attempts}
                          </span>
                        </div>
                        <Progress
                          value={
                            (practiceStats.total_shadowing_attempts /
                              getTotalPracticeCount(practiceStats)) *
                            100
                          }
                          className="h-2"
                        />
                      </div>
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <span>Cloze</span>
                          <span className="font-medium">{practiceStats.total_cloze_attempts}</span>
                        </div>
                        <Progress
                          value={
                            (practiceStats.total_cloze_attempts /
                              getTotalPracticeCount(practiceStats)) *
                            100
                          }
                          className="h-2"
                        />
                      </div>
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <span>Alignment</span>
                          <span className="font-medium">
                            {practiceStats.total_alignment_attempts}
                          </span>
                        </div>
                        <Progress
                          value={
                            (practiceStats.total_alignment_attempts /
                              getTotalPracticeCount(practiceStats)) *
                            100
                          }
                          className="h-2"
                        />
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle>语言分布</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {Object.entries(practiceStats.shadowing_by_lang).map(([lang, count]) => (
                        <div key={lang} className="space-y-2">
                          <div className="flex justify-between">
                            <span className="uppercase">{lang}</span>
                            <span className="font-medium">{count}</span>
                          </div>
                          <Progress
                            value={(count / getTotalPracticeCount(practiceStats)) * 100}
                            className="h-2"
                          />
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                </div>
              </>
            )}
          </TabsContent>

          <TabsContent value="activity" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>最近活动</CardTitle>
              </CardHeader>
              <CardContent>
                {recentActivity.length > 0 ? (
                  <div className="space-y-4">
                    {recentActivity.map((activity) => (
                      <div
                        key={activity.id}
                        className="flex items-center gap-4 p-4 border rounded-lg"
                      >
                        <Badge className={getActivityTypeColor(activity.type)}>
                          {getActivityTypeLabel(activity.type)}
                        </Badge>
                        <div className="flex-1">
                          <p className="font-medium">{activity.title}</p>
                          <div className="flex items-center gap-4 text-sm text-muted-foreground">
                            {activity.lang && <span className="uppercase">{activity.lang}</span>}
                            {activity.level && <span>等级 {activity.level}</span>}
                            {activity.score && <span>分数: {activity.score.toFixed(1)}</span>}
                          </div>
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {formatDate(activity.created_at)}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">暂无活动记录</div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="progress" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>最近7天学习进度</CardTitle>
              </CardHeader>
              <CardContent>
                {practiceStats && practiceStats.weekly_progress.length > 0 ? (
                  <div className="space-y-4">
                    {practiceStats.weekly_progress.map((day) => (
                      <div key={day.date} className="space-y-2">
                        <div className="flex justify-between">
                          <span>
                            {new Date(day.date).toLocaleDateString('zh-CN', {
                              month: 'short',
                              day: 'numeric',
                              weekday: 'short',
                            })}
                          </span>
                          <span className="font-medium">{day.count} 次练习</span>
                        </div>
                        <Progress
                          value={
                            (day.count /
                              Math.max(...practiceStats.weekly_progress.map((d) => d.count))) *
                            100
                          }
                          className="h-2"
                        />
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">暂无进度数据</div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </Container>
  );
}
